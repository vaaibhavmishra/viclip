import log from "electron-log/main";
import {
  createUserWithEmailAndPassword,
  getAuth,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
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
    log.info("User signed up:", uid);

    // 2. Generate Zero-Trust Encryption Keys
    const dek = generateDEK(); // Data Encryption Key (Random)
    const salt = generateSalt(); // Random Salt
    const kek = deriveKEK(password, salt); // Key Encryption Key (from Password)
    const wrappedKey = wrapKey(dek, kek); // Encrypt DEK with KEK

    // 3. Save Encryption Metadata to Firebase
    // (We store the Salt and the Encrypted DEK. NOT the password or the raw DEK)
    await saveEncryptionMetadata(uid, salt, wrappedKey);

    // 4. Save Raw DEK locally for this session (and future sessions on this device)
    authStorage.saveMasterKey(dek);
    setActiveDEK(dek); // Set in memory for immediate use

    try {
      await updateProfile(userCredential.user, {
        displayName: username,
      });
      log.info("User profile updated:", uid);
    } catch (error: unknown) {
      if (error instanceof Error) {
        log.error("Error updating user profile:", error.message);
      }
      // Non-critical, continue
    }

    await addUserProfile(userCredential.user);
    await addDevice(userCredential.user.uid);
    // Save credentials securely for session restoration
    authStorage.saveCredentials(email, password);
  } catch (error: unknown) {
    if (error instanceof Error) {
      log.error("Error signing up:", error.message);
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
    log.info("User logged in:", uid);

    // 2. Retrieve Encryption Metadata
    const metadata = await getEncryptionMetadata(uid);

    if (!metadata) {
      log.warn(
        "No encryption metadata found for user. Is this a legacy account?",
      );
      // TODO: Handle legacy account migration or error
      // For now, we might want to generate keys if missing, but that means data loss for old data?
      // Since this is a new feature, we assume new users.
      // If missing, we could treat it as a fresh start logic or throw.
      // Let's generate new keys to be safe for now, or throw to prompt reset.
      log.info("Generating new keys for user with missing metadata");
      const dek = generateDEK();
      const salt = generateSalt();
      const kek = deriveKEK(password, salt);
      const wrappedKey = wrapKey(dek, kek);

      await saveEncryptionMetadata(uid, salt, wrappedKey);
      authStorage.saveMasterKey(dek);
      setActiveDEK(dek);
    } else {
      // 3. Derive KEK and Unwrap DEK
      const { salt, wrappedKey } = metadata;
      const kek = deriveKEK(password, salt);

      try {
        const dek = unwrapKey(wrappedKey, kek);
        // 4. Save/Activate Keys
        authStorage.saveMasterKey(dek);
        setActiveDEK(dek);
        log.info("Encryption keys successfully loaded");
      } catch (err) {
        log.error(
          "Failed to unwrap encryption key with provided password:",
          err,
        );
        // Sign out to prevent unauthenticated/keyless state
        await auth.signOut();
        authStorage.clearCredentials();
        throw new Error(
          "ERR_KEY_DECRYPTION_FAILED: Unable to decrypt your data with this password. If your password was reset, you can recover using your previous password or start fresh.",
        );
      }
    }
    await addDevice(uid);
    // Save credentials securely for session restoration
    authStorage.saveCredentials(email, password);
  } catch (error: unknown) {
    if (error instanceof Error) {
      log.error("Error logging in:", error.message);
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
    log.warn("Explicit account reset initiated for:", email);
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

    await addDevice(uid);
    authStorage.saveCredentials(email, password);
    log.info("Account data reset and new keys initialized successfully");
  } catch (error: unknown) {
    if (error instanceof Error) {
      log.error("Error resetting account data:", error.message);
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
    log.info("Account recovery with old password initiated for:", email);
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
      log.error("Failed to unwrap encryption key with old password:", err);
      await auth.signOut();
      authStorage.clearCredentials();
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

    await addDevice(uid);
    authStorage.saveCredentials(email, currentPassword);
    log.info(
      "Account successfully recovered and re-encrypted with new password",
    );
  } catch (error: unknown) {
    if (error instanceof Error) {
      log.error("Error recovering account:", error.message);
      throw new Error(error.message);
    }
  }
}

export function logoutUser(): void {
  const auth = getAuth();
  authStorage.clearAuth();
  authStorage.clearCredentials();
  // Also clear memory DEK? Note: crypto.ts doesn't have clearActiveDEK, but it's fine as module reloads or we can add it.
  // ideally we should clear it.
  auth
    .signOut()
    .then(() => {
      log.info("User logged out");
    })
    .catch((error) => {
      log.error("Error logging out:", error.message);
    });
}

export async function restoreAuthSession(): Promise<string | null> {
  try {
    log.info("Attempting to restore auth session...");
    const credentials = authStorage.getCredentials();
    if (!credentials) {
      log.info("No stored credentials found");
      return null;
    }

    const { email, pass } = credentials;
    // Re-login to derive keys and ensure valid session
    await loginUser(email, pass);

    const auth = getAuth();
    const user = auth.currentUser;
    return user?.displayName || user?.email || "User";
  } catch (error) {
    log.error("Session restoration failed", error);
    return null;
  }
}

export async function resetPassword(email: string): Promise<void> {
  const auth = getAuth();
  try {
    await sendPasswordResetEmail(auth, email);
    log.info("Password reset email sent to:", email);
  } catch (error: unknown) {
    if (error instanceof Error) {
      log.error("Error sending password reset email:", error.message);
      throw new Error(error.message);
    }
  }
}
