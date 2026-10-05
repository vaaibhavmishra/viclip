import {
  createUserWithEmailAndPassword,
  getAuth,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  updateProfile,
} from "@react-native-firebase/auth";
import { getMessaging, getToken } from "@react-native-firebase/messaging";
import {
  deriveKEK,
  generateDEK,
  generateSalt,
  setActiveDEK,
  unwrapKey,
  wrapKey,
} from "./crypto";
import {
  addDevice,
  addUserProfile,
  getEncryptionMetadata,
  saveEncryptionMetadata,
  wipeEncryptionMetadata,
  wipeUserClips,
  wipeUserDevices,
} from "./firebase";
import { authStorage } from "./secureStorage";

export async function signupUser(
  email: string,
  username: string,
  password: string,
): Promise<void> {
  const auth = getAuth();
  try {
    // 1. Create User in Firebase
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password,
    );
    const uid = userCredential.user.uid;

    // 2. Generate Zero-Trust Encryption Keys
    const dek = generateDEK(); // Data Encryption Key (Random)
    const salt = generateSalt(); // Random Salt
    const kek = deriveKEK(password, salt); // Key Encryption Key (from Password)
    const wrappedKey = wrapKey(dek, kek); // Encrypt DEK with KEK

    // 3. Save Encryption Metadata to Firebase
    // (We store the Salt and the Encrypted DEK. NOT the password or the raw DEK)
    await saveEncryptionMetadata(uid, salt, wrappedKey);

    // 4. Save Raw DEK locally for this session (and future sessions on this device)
    // authStorage.saveMasterKey(dek)
    setActiveDEK(dek); // Set in memory for immediate use

    try {
      await updateProfile(userCredential.user, {
        displayName: username,
      });
      console.info("User profile updated:", uid);
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error("Error updating user profile:", error.message);
      }
      // Non-critical, continue
    }

    await addUserProfile(userCredential.user);
    let fcmToken: string | undefined;
    try {
      const messagingInstance = getMessaging();
      fcmToken = await getToken(messagingInstance);
    } catch {}
    await addDevice(userCredential.user.uid, fcmToken);
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Error signing up:", error.message);
      throw new Error(error.message);
    }
  }
}

export async function loginUser(
  email: string,
  password: string,
): Promise<void> {
  const auth = getAuth();
  try {
    // 1. Authenticate with Firebase
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password,
    );
    const uid = userCredential.user.uid;

    // 2. Retrieve Encryption Metadata
    const metadata = await getEncryptionMetadata(uid);

    if (!metadata) {
      throw new Error("No encryption metadata found for user.");
    }

    // 3. Derive KEK and Unwrap DEK
    const { salt, wrappedKey } = metadata;
    const kek = deriveKEK(password, salt);

    let dek: ReturnType<typeof unwrapKey>;
    try {
      dek = unwrapKey(wrappedKey, kek);
      // 4. Save/Activate Keys
      authStorage.saveMasterKey(dek);
      setActiveDEK(dek);
      // console.info('Encryption keys successfully loaded')
    } catch (err) {
      console.error(
        "Failed to unwrap encryption key with provided password:",
        err,
      );
      await auth.signOut();
      authStorage.clearAuth();
      throw new Error(
        "ERR_KEY_DECRYPTION_FAILED: Unable to decrypt your data with this password. If your password was reset, please use previous password to recover or start fresh.",
      );
    }

    let fcmToken: string | undefined;
    try {
      const messagingInstance = getMessaging();
      fcmToken = await getToken(messagingInstance);
    } catch {}
    await addDevice(uid, fcmToken);
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Error logging in:", error.message);
      throw new Error(error.message);
    }
  }
}

/**
 * Explicitly wipes existing clips, devices, and encryption metadata,
 * then generates fresh encryption keys. Must ONLY be called upon explicit user confirmation.
 */
export async function resetAccountData(
  email: string,
  password: string,
): Promise<void> {
  const auth = getAuth();
  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password,
    );
    const uid = userCredential.user.uid;

    // 1. Wipe existing remote data
    await wipeUserClips(uid);
    await wipeUserDevices(uid);
    await wipeEncryptionMetadata(uid);

    // 2. Generate and store fresh keys
    const dek = generateDEK();
    const salt = generateSalt();
    const kek = deriveKEK(password, salt);
    const wrappedKey = wrapKey(dek, kek);

    await saveEncryptionMetadata(uid, salt, wrappedKey);
    authStorage.saveMasterKey(dek);
    setActiveDEK(dek);

    let fcmToken: string | undefined;
    try {
      const messagingInstance = getMessaging();
      fcmToken = await getToken(messagingInstance);
    } catch {}
    await addDevice(uid, fcmToken);
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Error resetting account data:", error.message);
      throw new Error(error.message);
    }
  }
}

/**
 * Recovers an account after a password reset by unwrapping the DEK using
 * the old password, then re-wrapping it with the new password.
 */
export async function recoverAccountWithOldPassword(
  email: string,
  currentPassword: string,
  oldPassword: string,
): Promise<void> {
  const auth = getAuth();
  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      currentPassword,
    );
    const uid = userCredential.user.uid;

    const metadata = await getEncryptionMetadata(uid);
    if (!metadata) {
      throw new Error("No encryption metadata found to recover.");
    }

    const { salt, wrappedKey } = metadata;
    const oldKek = deriveKEK(oldPassword, salt);

    let dek: ReturnType<typeof unwrapKey>;
    try {
      dek = unwrapKey(wrappedKey, oldKek);
    } catch (err) {
      console.error("Failed to unwrap encryption key with old password:", err);
      await auth.signOut();
      authStorage.clearAuth();
      throw new Error(
        "ERR_OLD_PASSWORD_INVALID: The previous password entered is incorrect.",
      );
    }

    // Re-wrap the existing DEK with current password
    const newSalt = generateSalt();
    const newKek = deriveKEK(currentPassword, newSalt);
    const newWrappedKey = wrapKey(dek, newKek);

    await saveEncryptionMetadata(uid, newSalt, newWrappedKey);
    authStorage.saveMasterKey(dek);
    setActiveDEK(dek);

    let fcmToken: string | undefined;
    try {
      const messagingInstance = getMessaging();
      fcmToken = await getToken(messagingInstance);
    } catch {}
    await addDevice(uid, fcmToken);
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Error recovering account:", error.message);
      throw new Error(error.message);
    }
  }
}

export function logoutUser(): void {
  const auth = getAuth();
  authStorage.clearAuth();
  auth
    .signOut()
    .then(() => {
      console.info("User logged out");
    })
    .catch((error) => {
      console.error("Error logging out:", error.message);
    });
}

export async function resetPassword(email: string): Promise<void> {
  const auth = getAuth();
  try {
    await sendPasswordResetEmail(auth, email);
    console.info("Password reset email sent to:", email);
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Error sending password reset email:", error.message);
      throw new Error(error.message);
    }
  }
}
