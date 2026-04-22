import {
  createUserWithEmailAndPassword,
  getAuth,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  updateProfile,
} from "@react-native-firebase/auth";
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
    await addDevice(userCredential.user.uid);
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

    try {
      const dek = unwrapKey(wrappedKey, kek);
      // 4. Save/Activate Keys
      authStorage.saveMasterKey(dek);
      setActiveDEK(dek);
      // console.info('Encryption keys successfully loaded')
    } catch (_err) {
      console.warn(
        "Failed to unwrap key. Password was likely reset. Wiping old data and regenerating keys.",
      );
      // 4.a Password was reset and the old data can't be decrypted
      // Wipe existing data to start fresh
      await wipeUserClips(uid);
      await wipeUserDevices(uid);
      await wipeEncryptionMetadata(uid);

      // 4.b Generate new keys
      const dek = generateDEK();
      const newSalt = generateSalt();
      const newKek = deriveKEK(password, newSalt);
      const newWrappedKey = wrapKey(dek, newKek);

      await saveEncryptionMetadata(uid, newSalt, newWrappedKey);
      authStorage.saveMasterKey(dek);
      setActiveDEK(dek);
      console.info("New encryption keys generated and saved after wipe");
    }

    await addDevice(uid);
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Error logging in:", error.message);
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
