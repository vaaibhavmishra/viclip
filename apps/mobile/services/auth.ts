import {
  createUserWithEmailAndPassword,
  getAuth,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  type UserCredential,
  updateProfile,
} from "@react-native-firebase/auth";
import {
  clearActiveDEK,
  deriveKEKAsync,
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
  clearDeviceFCMTokenForLogout,
  getEncryptionMetadata,
  saveEncryptionMetadata,
  wipeEncryptionMetadata,
  wipeUserClips,
  wipeUserDevices,
} from "./firebase";
import {
  beginPushSession,
  isPushSessionCurrent,
  type PushSession,
  suspendPushSession,
} from "./pushSession";
import { authStorage } from "./secureStorage";

const LOGOUT_CLEANUP_TIMEOUT_MS = 1000;
let logoutPromise: Promise<void> | null = null;
let authenticationGeneration = 0;
let authenticating = false;

async function runAuthentication(
  operation: (assertCurrent: () => void) => Promise<void>,
): Promise<void> {
  await waitForLogout();
  if (authenticating)
    throw new Error("An authentication operation is already in progress");
  authenticating = true;
  const generation = ++authenticationGeneration;
  suspendPushSession();
  clearActiveDEK();
  const assertCurrent = () => {
    if (generation !== authenticationGeneration)
      throw new Error("ERR_AUTH_CANCELLED: Authentication was interrupted");
  };
  try {
    await authStorage.clearAuth();
    assertCurrent();
    await operation(assertCurrent);
    assertCurrent();
  } catch (error) {
    // Serialize authentication attempts so cancellation cleanup cannot sign out a newer login.
    suspendPushSession();
    clearActiveDEK();
    await Promise.allSettled([getAuth().signOut(), authStorage.clearAuth()]);
    throw error;
  } finally {
    authenticating = false;
  }
}

async function waitForLogout(): Promise<void> {
  if (logoutPromise) await logoutPromise;
}

async function signupUserAttempt(
  email: string,
  username: string,
  password: string,
  assertCurrent: () => void,
): Promise<void> {
  await waitForLogout();
  const auth = getAuth();
  let userCredential: UserCredential | undefined;
  let pushSession: PushSession | null = null;
  try {
    // 1. Create User in Firebase
    userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password,
    );
    assertCurrent();
    const uid = userCredential.user.uid;
    pushSession = beginPushSession(uid);

    // 2. Generate Zero-Trust Encryption Keys
    const dek = generateDEK(); // Data Encryption Key (Random)
    const salt = generateSalt(); // Random Salt
    const kek = await deriveKEKAsync(password, salt); // Key Encryption Key (from Password)
    assertCurrent();
    if (!isPushSessionCurrent(pushSession))
      throw new Error("ERR_SESSION_CHANGED: Account session changed");
    const wrappedKey = wrapKey(dek, kek); // Encrypt DEK with KEK

    // 3. Save Encryption Metadata to Firebase
    // (We store the Salt and the Encrypted DEK. NOT the password or the raw DEK)
    await saveEncryptionMetadata(uid, salt, wrappedKey);
    if (!isPushSessionCurrent(pushSession))
      throw new Error("ERR_SESSION_CHANGED: Account session changed");

    // 4. Save Raw DEK locally for this session (and future sessions on this device)
    authStorage.saveMasterKey(dek, uid, pushSession.id);
    setActiveDEK(dek, uid); // Set in memory for immediate use

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

    if (!isPushSessionCurrent(pushSession))
      throw new Error("ERR_SESSION_CHANGED: Account session changed");
    await addUserProfile(userCredential.user, username);
    if (!isPushSessionCurrent(pushSession))
      throw new Error("ERR_SESSION_CHANGED: Account session changed");
    // The sync provider registers tokens only after checking permission and preferences.
    const fcmToken: string | undefined = undefined;
    if (!isPushSessionCurrent(pushSession))
      throw new Error("ERR_SESSION_CHANGED: Account session changed");
    await addDevice(userCredential.user.uid, fcmToken, pushSession);
    if (!isPushSessionCurrent(pushSession))
      throw new Error("ERR_SESSION_CHANGED: Account session changed");
  } catch (error: unknown) {
    if (
      userCredential?.user &&
      pushSession &&
      isPushSessionCurrent(pushSession)
    ) {
      try {
        await userCredential.user.delete();
      } catch {
        await auth.signOut();
      }
      await authStorage.clearAuth();
      clearActiveDEK();
    }
    const message = error instanceof Error ? error.message : String(error);
    console.error("Sign-up failed");
    throw new Error(message);
  }
}

async function loginUserAttempt(
  email: string,
  password: string,
  assertCurrent: () => void,
): Promise<void> {
  await waitForLogout();
  const auth = getAuth();
  let pushSession: PushSession | null = null;
  try {
    // 1. Authenticate with Firebase
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password,
    );
    assertCurrent();
    const uid = userCredential.user.uid;
    pushSession = beginPushSession(uid);

    // 2. Retrieve Encryption Metadata
    const metadata = await getEncryptionMetadata(uid);
    if (!isPushSessionCurrent(pushSession))
      throw new Error("ERR_SESSION_CHANGED: Account session changed");

    if (!metadata) {
      throw new Error(
        "ERR_KEY_METADATA_MISSING: Encryption metadata is unavailable. Restore it or explicitly reset the account to create new keys.",
      );
    } else {
      // 3. Derive KEK and Unwrap DEK
      const { salt, wrappedKey } = metadata;
      const kek = await deriveKEKAsync(password, salt);

      assertCurrent();
      if (!isPushSessionCurrent(pushSession))
        throw new Error("ERR_SESSION_CHANGED: Account session changed");
      let dek: ReturnType<typeof unwrapKey>;
      try {
        dek = unwrapKey(wrappedKey, kek);
        // 4. Save/Activate Keys
        // console.info('Encryption keys successfully loaded')
      } catch {
        console.error("Unable to unwrap the account encryption key");
        await auth.signOut();
        await authStorage.clearAuth();
        throw new Error(
          "ERR_KEY_DECRYPTION_FAILED: Unable to decrypt your data with this password. If your password was reset, please use previous password to recover or start fresh.",
        );
      }
      authStorage.saveMasterKey(dek, uid, pushSession.id);
      setActiveDEK(dek, uid);
    }

    if (!isPushSessionCurrent(pushSession))
      throw new Error("ERR_SESSION_CHANGED: Account session changed");
    await addUserProfile(userCredential.user);
    if (!isPushSessionCurrent(pushSession))
      throw new Error("ERR_SESSION_CHANGED: Account session changed");

    // The sync provider registers tokens only after checking permission and preferences.
    const fcmToken: string | undefined = undefined;
    if (!isPushSessionCurrent(pushSession))
      throw new Error("ERR_SESSION_CHANGED: Account session changed");
    await addDevice(uid, fcmToken, pushSession);
    if (!isPushSessionCurrent(pushSession))
      throw new Error("ERR_SESSION_CHANGED: Account session changed");
  } catch (error: unknown) {
    // If login failed, ensure partial auth state is cleaned up
    if (pushSession && isPushSessionCurrent(pushSession) && !isKeyLoaded()) {
      try {
        await auth.signOut();
        await authStorage.clearAuth();
      } catch {}
    }
    const message = error instanceof Error ? error.message : String(error);
    console.error("Login failed");
    throw new Error(message);
  }
}

/**
 * Explicitly wipes existing clips, devices, and encryption metadata,
 * then generates fresh encryption keys. Must ONLY be called upon explicit user confirmation.
 */
async function resetAccountDataAttempt(
  email: string,
  password: string,
  assertCurrent: () => void,
): Promise<void> {
  await waitForLogout();
  const auth = getAuth();
  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password,
    );
    assertCurrent();
    const uid = userCredential.user.uid;
    const pushSession = beginPushSession(uid);

    // 1. Wipe existing remote data
    await wipeUserClips(uid);
    if (!isPushSessionCurrent(pushSession))
      throw new Error("ERR_SESSION_CHANGED: Account session changed");
    await wipeUserDevices(uid);
    if (!isPushSessionCurrent(pushSession))
      throw new Error("ERR_SESSION_CHANGED: Account session changed");
    await wipeEncryptionMetadata(uid);
    if (!isPushSessionCurrent(pushSession))
      throw new Error("ERR_SESSION_CHANGED: Account session changed");

    // 2. Generate and store fresh keys
    const dek = generateDEK();
    const salt = generateSalt();
    const kek = await deriveKEKAsync(password, salt);
    assertCurrent();
    if (!isPushSessionCurrent(pushSession))
      throw new Error("ERR_SESSION_CHANGED: Account session changed");
    const wrappedKey = wrapKey(dek, kek);

    await saveEncryptionMetadata(uid, salt, wrappedKey);
    if (!isPushSessionCurrent(pushSession))
      throw new Error("ERR_SESSION_CHANGED: Account session changed");
    authStorage.saveMasterKey(dek, uid, pushSession.id);
    setActiveDEK(dek, uid);

    // The sync provider registers tokens only after checking permission and preferences.
    const fcmToken: string | undefined = undefined;
    if (!isPushSessionCurrent(pushSession))
      throw new Error("ERR_SESSION_CHANGED: Account session changed");
    await addDevice(uid, fcmToken, pushSession);
    if (!isPushSessionCurrent(pushSession))
      throw new Error("ERR_SESSION_CHANGED: Account session changed");
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Account reset failed");
    throw new Error(message);
  }
}

/**
 * Recovers an account after a password reset by unwrapping the DEK using
 * the old password, then re-wrapping it with the new password.
 */
async function recoverAccountWithOldPasswordAttempt(
  email: string,
  currentPassword: string,
  oldPassword: string,
  assertCurrent: () => void,
): Promise<void> {
  await waitForLogout();
  const auth = getAuth();
  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      currentPassword,
    );
    assertCurrent();
    const uid = userCredential.user.uid;
    const pushSession = beginPushSession(uid);

    const metadata = await getEncryptionMetadata(uid);
    if (!isPushSessionCurrent(pushSession))
      throw new Error("ERR_SESSION_CHANGED: Account session changed");
    if (!metadata) {
      throw new Error("No encryption metadata found to recover.");
    }

    const { salt, wrappedKey } = metadata;
    const oldKek = await deriveKEKAsync(oldPassword, salt);

    assertCurrent();
    if (!isPushSessionCurrent(pushSession))
      throw new Error("ERR_SESSION_CHANGED: Account session changed");
    let dek: ReturnType<typeof unwrapKey>;
    try {
      dek = unwrapKey(wrappedKey, oldKek);
    } catch {
      console.error("Unable to recover the account encryption key");
      await auth.signOut();
      await authStorage.clearAuth();
      throw new Error(
        "ERR_OLD_PASSWORD_INVALID: The previous password entered is incorrect.",
      );
    }

    // Re-wrap the existing DEK with current password
    const newSalt = generateSalt();
    const newKek = await deriveKEKAsync(currentPassword, newSalt);
    assertCurrent();
    if (!isPushSessionCurrent(pushSession))
      throw new Error("ERR_SESSION_CHANGED: Account session changed");
    const newWrappedKey = wrapKey(dek, newKek);

    await saveEncryptionMetadata(uid, newSalt, newWrappedKey);
    if (!isPushSessionCurrent(pushSession))
      throw new Error("ERR_SESSION_CHANGED: Account session changed");
    authStorage.saveMasterKey(dek, uid, pushSession.id);
    setActiveDEK(dek, uid);

    // The sync provider registers tokens only after checking permission and preferences.
    const fcmToken: string | undefined = undefined;
    if (!isPushSessionCurrent(pushSession))
      throw new Error("ERR_SESSION_CHANGED: Account session changed");
    await addDevice(uid, fcmToken, pushSession);
    if (!isPushSessionCurrent(pushSession))
      throw new Error("ERR_SESSION_CHANGED: Account session changed");
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Account recovery failed");
    throw new Error(message);
  }
}

export function logoutUser(): Promise<void> {
  authenticationGeneration += 1;
  if (!logoutPromise) {
    logoutPromise = logoutCurrentSession().finally(() => {
      logoutPromise = null;
    });
  }
  return logoutPromise;
}

async function logoutCurrentSession(): Promise<void> {
  const auth = getAuth();
  const currentUser = auth.currentUser;
  const isCurrentLogout = suspendPushSession();
  clearActiveDEK();

  let cleanupActive = true;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let localResults: PromiseSettledResult<void>[] = [];
  try {
    if (currentUser) {
      await Promise.race([
        clearDeviceFCMTokenForLogout(
          currentUser.uid,
          () =>
            cleanupActive &&
            isCurrentLogout() &&
            auth.currentUser?.uid === currentUser.uid,
        ),
        new Promise<void>((resolve) => {
          timeoutId = setTimeout(() => {
            cleanupActive = false;
            resolve();
          }, LOGOUT_CLEANUP_TIMEOUT_MS);
        }),
      ]);
    }
  } catch {
    console.warn("Unable to unlink notification token during logout");
  } finally {
    cleanupActive = false;
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    // Local logout must complete even when the server cannot acknowledge cleanup.
    // Retain the installation token: delayed deleteToken() can affect a new login.
    localResults = await Promise.allSettled([
      auth.signOut(),
      authStorage.clearAuth(),
    ]);
    clearActiveDEK();
  }
  for (const result of localResults) {
    if (result.status === "rejected") throw result.reason;
  }
  console.info("User logged out");
}

export async function resetPassword(email: string): Promise<void> {
  const auth = getAuth();
  try {
    await sendPasswordResetEmail(auth, email);
    console.info("Password reset email requested");
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error sending password reset email:", message);
    throw new Error(message);
  }
}

export function signupUser(
  email: string,
  username: string,
  password: string,
): Promise<void> {
  return runAuthentication((assertCurrent) =>
    signupUserAttempt(email, username, password, assertCurrent),
  );
}

export function loginUser(email: string, password: string): Promise<void> {
  return runAuthentication((assertCurrent) =>
    loginUserAttempt(email, password, assertCurrent),
  );
}

export function resetAccountData(
  email: string,
  password: string,
): Promise<void> {
  return runAuthentication((assertCurrent) =>
    resetAccountDataAttempt(email, password, assertCurrent),
  );
}

export function recoverAccountWithOldPassword(
  email: string,
  currentPassword: string,
  oldPassword: string,
): Promise<void> {
  return runAuthentication((assertCurrent) =>
    recoverAccountWithOldPasswordAttempt(
      email,
      currentPassword,
      oldPassword,
      assertCurrent,
    ),
  );
}
