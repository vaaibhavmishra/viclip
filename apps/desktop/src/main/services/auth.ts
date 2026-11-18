import log from "electron-log/main";
import {
  type Auth,
  createUserWithEmailAndPassword,
  getAuth,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { clearCachedClips } from "../globalStates";
import { stopClipboardSync } from "./clipboard";
import {
  clearActiveDEK,
  deriveKEK,
  generateDEK,
  generateSalt,
  isKeyLoaded,
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

let authGeneration = 0;
let interactiveGeneration: number | null = null;
let authenticationInFlight = false;
let logoutInFlight: Promise<void> | null = null;
let sessionRevoked = false;
const sessionRevocationListeners = new Set<() => void>();

function notifySessionRevoked(): void {
  for (const listener of [...sessionRevocationListeners]) {
    try {
      listener();
    } catch {
      log.error("Failed to notify local session revocation");
    }
  }
}

/** Observe when local account access ends, including a new authentication attempt. */
export function subscribeSessionRevoked(listener: () => void): () => void {
  sessionRevocationListeners.add(listener);
  return () => sessionRevocationListeners.delete(listener);
}

/** Requested logout stays locked until an explicit new authentication attempt. */
export function isSessionRevoked(): boolean {
  return sessionRevoked;
}

function beginAuthentication(): number {
  if (authenticationInFlight || logoutInFlight) {
    throw new Error("Another authentication operation is already in progress");
  }
  authenticationInFlight = true;
  authGeneration++;
  interactiveGeneration = authGeneration;
  sessionRevoked = false;
  clearActiveDEK();
  clearCachedClips();
  stopClipboardSync();
  notifySessionRevoked();
  return authGeneration;
}

function assertCurrentSession(
  auth: Auth,
  userId: string,
  generation: number,
): void {
  if (generation !== authGeneration || auth.currentUser?.uid !== userId) {
    throw new Error("Authentication session changed");
  }
}

async function cleanupFailedAuthentication(): Promise<void> {
  // Interactive attempts are serialized until cleanup finishes, including late sign-in after logout.
  await logoutUser();
  // A late sign-in may have installed a user while a prior sign-out was finishing.
  if (getAuth().currentUser) await logoutUser();
}

export function isInteractiveAuthSession(): boolean {
  return interactiveGeneration === authGeneration;
}

export function isAuthenticationPending(): boolean {
  return authenticationInFlight;
}

export function getAuthGeneration(): number {
  return authGeneration;
}

/** Cancels pending authentication work without removing a persisted session. */
export function invalidateAuthWork(): void {
  authGeneration++;
}

async function saveAndActivateMasterKey(
  auth: Auth,
  userId: string,
  key: Buffer,
  generation: number,
): Promise<void> {
  const isCurrentSession = (): boolean =>
    generation === authGeneration && auth.currentUser?.uid === userId;
  assertCurrentSession(auth, userId, generation);
  await authStorage.saveMasterKey(key, isCurrentSession, userId);
  if (!isCurrentSession()) {
    throw new Error(
      "Authentication session changed while saving the encryption key",
    );
  }
  setActiveDEK(key, userId);
}

export async function signupUser(
  email: string,
  username: string,
  password: string,
): Promise<void> {
  const generation = beginAuthentication();
  const auth = getAuth();
  try {
    // 1. Create User in Firebase
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password,
    );
    const uid = userCredential.user.uid;
    assertCurrentSession(auth, uid, generation);
    log.info("User signed up:", uid);

    // 2. Generate Zero-Trust Encryption Keys
    const dek = generateDEK(); // Data Encryption Key (Random)
    const salt = generateSalt(); // Random Salt
    const kek = deriveKEK(password, salt); // Key Encryption Key (from Password)
    const wrappedKey = wrapKey(dek, kek); // Encrypt DEK with KEK

    // 3. Save Encryption Metadata to Firebase
    // (We store the Salt and the Encrypted DEK. NOT the password or the raw DEK)
    assertCurrentSession(auth, uid, generation);
    await saveEncryptionMetadata(uid, salt, wrappedKey);

    // 4. Save Raw DEK locally for this session (and future sessions on this device)

    try {
      assertCurrentSession(auth, uid, generation);
      await updateProfile(userCredential.user, {
        displayName: username,
      });
      log.info("User profile updated:", uid);
    } catch (error: unknown) {
      if (error instanceof Error) {
        log.error("Error updating user profile");
      }
      // Non-critical, continue
    }

    assertCurrentSession(auth, uid, generation);
    await addUserProfile(userCredential.user, username);
    assertCurrentSession(auth, uid, generation);
    await addDevice(userCredential.user.uid);
    assertCurrentSession(auth, uid, generation);
    await saveAndActivateMasterKey(auth, uid, dek, generation); // Set in memory for immediate use
  } catch (error: unknown) {
    try {
      await cleanupFailedAuthentication();
    } catch {
      log.error("Failed to sign out after authentication failure");
    }
    const message = error instanceof Error ? error.message : String(error);
    log.error("Error signing up:");
    throw error instanceof Error ? error : new Error(message);
  } finally {
    authenticationInFlight = false;
  }
}

export async function loginUser(
  email: string,
  password: string,
): Promise<void> {
  const generation = beginAuthentication();
  const auth = getAuth();
  try {
    // 1. Authenticate with Firebase
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password,
    );
    const uid = userCredential.user.uid;
    assertCurrentSession(auth, uid, generation);
    log.info("User logged in:", uid);

    // 2. Retrieve Encryption Metadata
    const metadata = await getEncryptionMetadata(uid);
    assertCurrentSession(auth, uid, generation);

    if (!metadata) {
      log.warn(
        "No encryption metadata found for user. Is this a legacy account?",
      );
      // TODO: Handle legacy account migration or error
      // For now, we might want to generate keys if missing, but that means data loss for old data?
      // Since this is a new feature, we assume new users.
      // If missing, we could treat it as a fresh start logic or throw.
      // Let's generate new keys to be safe for now, or throw to prompt reset.
      throw new Error(
        "ERR_ENCRYPTION_METADATA_MISSING: Encryption metadata is unavailable. Account recovery is required; existing data will not be overwritten.",
      );
    } else {
      // 3. Derive KEK and Unwrap DEK
      const { salt, wrappedKey } = metadata;
      const kek = deriveKEK(password, salt);

      let dek: ReturnType<typeof unwrapKey>;
      try {
        dek = unwrapKey(wrappedKey, kek);
      } catch {
        log.error("Failed to unwrap encryption key with provided password:");
        // Sign out to prevent unauthenticated/keyless state
        assertCurrentSession(auth, uid, generation);
        throw new Error(
          "ERR_KEY_DECRYPTION_FAILED: Unable to decrypt your data with this password. If your password was reset, you can recover using your previous password or start fresh.",
        );
      }
      // 4. Save/Activate Keys
      await addDevice(uid);
      assertCurrentSession(auth, uid, generation);
      await saveAndActivateMasterKey(auth, uid, dek, generation);
      log.info("Encryption keys successfully loaded");
    }
  } catch (error: unknown) {
    try {
      await cleanupFailedAuthentication();
    } catch {
      log.error("Failed to sign out after authentication failure");
    }
    const message = error instanceof Error ? error.message : String(error);
    log.error("Error logging in:");
    throw error instanceof Error ? error : new Error(message);
  } finally {
    authenticationInFlight = false;
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
  const generation = beginAuthentication();
  const auth = getAuth();
  try {
    log.warn("Explicit account reset initiated");
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password,
    );
    const uid = userCredential.user.uid;
    assertCurrentSession(auth, uid, generation);

    // 1. Wipe existing remote data
    assertCurrentSession(auth, uid, generation);
    await wipeUserClips(uid);
    assertCurrentSession(auth, uid, generation);
    await wipeUserDevices(uid);
    assertCurrentSession(auth, uid, generation);
    await wipeEncryptionMetadata(uid);

    // 2. Generate and store fresh keys
    const dek = generateDEK();
    const salt = generateSalt();
    const kek = deriveKEK(password, salt);
    const wrappedKey = wrapKey(dek, kek);

    assertCurrentSession(auth, uid, generation);
    await saveEncryptionMetadata(uid, salt, wrappedKey);
    assertCurrentSession(auth, uid, generation);
    await addDevice(uid);
    assertCurrentSession(auth, uid, generation);
    await saveAndActivateMasterKey(auth, uid, dek, generation);

    log.info("Account data reset and new keys initialized successfully");
  } catch (error: unknown) {
    try {
      await cleanupFailedAuthentication();
    } catch {
      log.error("Failed to sign out after authentication failure");
    }
    const message = error instanceof Error ? error.message : String(error);
    log.error("Error resetting account data:");
    throw error instanceof Error ? error : new Error(message);
  } finally {
    authenticationInFlight = false;
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
  const generation = beginAuthentication();
  const auth = getAuth();
  try {
    log.info("Account recovery with old password initiated");
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      currentPassword,
    );
    const uid = userCredential.user.uid;
    assertCurrentSession(auth, uid, generation);

    const metadata = await getEncryptionMetadata(uid);
    assertCurrentSession(auth, uid, generation);
    if (!metadata) {
      throw new Error("No encryption metadata found to recover.");
    }

    const { salt, wrappedKey } = metadata;
    const oldKek = deriveKEK(oldPassword, salt);

    let dek: ReturnType<typeof unwrapKey>;
    try {
      dek = unwrapKey(wrappedKey, oldKek);
    } catch {
      log.error("Failed to unwrap encryption key with old password");
      assertCurrentSession(auth, uid, generation);
      throw new Error(
        "ERR_OLD_PASSWORD_INVALID: The previous password entered is incorrect.",
      );
    }

    // Re-wrap the existing DEK with current password
    const newSalt = generateSalt();
    const newKek = deriveKEK(currentPassword, newSalt);
    const newWrappedKey = wrapKey(dek, newKek);

    assertCurrentSession(auth, uid, generation);
    await saveEncryptionMetadata(uid, newSalt, newWrappedKey);
    assertCurrentSession(auth, uid, generation);
    await addDevice(uid);
    assertCurrentSession(auth, uid, generation);
    await saveAndActivateMasterKey(auth, uid, dek, generation);

    log.info(
      "Account successfully recovered and re-encrypted with new password",
    );
  } catch (error: unknown) {
    try {
      await cleanupFailedAuthentication();
    } catch {
      log.error("Failed to sign out after authentication failure");
    }
    const message = error instanceof Error ? error.message : String(error);
    log.error("Error recovering account:");
    throw error instanceof Error ? error : new Error(message);
  } finally {
    authenticationInFlight = false;
  }
}

export function logoutUser(): Promise<void> {
  authGeneration++;
  sessionRevoked = true;
  clearActiveDEK();
  clearCachedClips();
  stopClipboardSync();
  notifySessionRevoked();
  if (logoutInFlight) return logoutInFlight;
  const task = (async () => {
    // Always attempt Firebase sign-out, even when clearing secure storage fails.
    try {
      await authStorage.clearAuth();
    } finally {
      await getAuth().signOut();
    }
  })();
  logoutInFlight = task;
  const clearTask = (): void => {
    if (logoutInFlight === task) logoutInFlight = null;
  };
  task.then(clearTask, clearTask);
  return task;
}

export async function restoreAuthSession(): Promise<string | null> {
  if (sessionRevoked) return null;
  const generation = authGeneration;
  try {
    log.info("Attempting to restore auth session...");
    const auth = getAuth();
    await auth.authStateReady();
    if (
      generation !== authGeneration ||
      isAuthenticationPending() ||
      sessionRevoked
    )
      return null;

    const user = auth.currentUser;
    if (!user) {
      log.info("No persisted auth session found");
      return null;
    }

    const masterKey = await authStorage.getMasterKey(user.uid);
    if (generation !== authGeneration || auth.currentUser?.uid !== user.uid) {
      return null;
    }
    if (!isKeyLoaded(user.uid)) {
      if (!masterKey) {
        log.warn(
          "User session found, but master encryption key is missing. Re-authentication required.",
        );
        await logoutUser();
        return null;
      }
      setActiveDEK(masterKey, user.uid);
    }

    log.info("Auth session and master encryption key restored successfully", {
      userId: user.uid,
    });
    return user.displayName || user.email || "User";
  } catch {
    log.error("Session restoration failed");
    if (generation === authGeneration) await logoutUser().catch(() => {});
    return null;
  }
}

export async function resetPassword(email: string): Promise<void> {
  const auth = getAuth();
  try {
    await sendPasswordResetEmail(auth, email);
    log.info("Password reset email sent");
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    log.error("Error sending password reset email:");
    throw error instanceof Error ? error : new Error(message);
  }
}
