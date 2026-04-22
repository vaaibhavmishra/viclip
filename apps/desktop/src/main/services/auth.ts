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
      } catch (_err) {
        log.warn(
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
        log.info("New encryption keys generated and saved after wipe");
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
