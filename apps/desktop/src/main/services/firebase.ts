/**
 * Firebase Integration Module
 *
 * This module handles Firebase initialization and provides functions
 * for reading from and writing to the Firebase Realtime Database.
 * It's used to synchronize clipboard data across devices.
 */

import os from "node:os";
import {
  CLIPBOARD_CONFIG,
  DB_PATHS,
  FIREBASE_ENV_KEYS,
} from "@viclip/constants";
import type { ClipContentType, ClipData, DeviceData } from "@viclip/types";
import { isEncryptedPayload } from "@viclip/utils";
import log from "electron-log/main";
import { getApps, initializeApp } from "firebase/app";
import { getAuth, initializeAuth, type User } from "firebase/auth";
import {
  equalTo,
  get,
  getDatabase,
  onValue,
  orderByChild,
  push,
  query,
  ref,
  remove,
  runTransaction,
  set,
  update,
} from "firebase/database";
import { v4 as uuidv4 } from "uuid";
import { getAuthGeneration } from "./auth";
import { ElectronAuthPersistence } from "./secureStorage";
import { settingsStorage } from "./settings";

function currentSession(userId: string): () => void {
  const generation = getAuthGeneration();
  const assertCurrent = (): void => {
    if (
      getAuth().currentUser?.uid !== userId ||
      generation !== getAuthGeneration()
    ) {
      throw new Error("Authentication session changed.");
    }
  };
  assertCurrent();
  return assertCurrent;
}

function assertDatabaseKey(value: string): void {
  if (
    !value ||
    value.length > 256 ||
    [...value].some((character) => {
      const code = character.charCodeAt(0);
      return code <= 31 || code === 127 || ".#$[]/".includes(character);
    })
  )
    throw new Error("Invalid database key.");
}

export function initFirebase(): void {
  log.debug("Initializing Firebase");

  if (getApps().length > 0) {
    log.debug("Firebase already initialized");
    return;
  }

  const missingVars = FIREBASE_ENV_KEYS.filter(
    (varName) => !import.meta.env[varName],
  );
  if (missingVars.length > 0) {
    throw new Error(
      `Missing required Firebase configuration: ${missingVars.join(", ")}`,
    );
  }

  // Firebase configuration from environment variables
  const firebaseConfig = {
    apiKey: import.meta.env.MAIN_VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.MAIN_VITE_FIREBASE_AUTH_DOMAIN,
    databaseURL: import.meta.env.MAIN_VITE_FIREBASE_DATABASE_URL,
    projectId: import.meta.env.MAIN_VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.MAIN_VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.MAIN_VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.MAIN_VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.MAIN_VITE_FIREBASE_MEASUREMENT_ID,
  };

  // Initialize Firebase with the configuration
  const app = initializeApp(firebaseConfig);
  initializeAuth(app, {
    // Firebase instantiates and caches the persistence class internally.
    persistence: ElectronAuthPersistence,
  });
  log.info("Firebase initialized successfully with ElectronAuthPersistence");
}

export async function addUserProfile(
  user: User,
  fallbackName?: string,
): Promise<void> {
  if (!user) {
    log.warn("Cannot add profile: user is not authenticated");
    return;
  }

  const assertCurrent = currentSession(user.uid);
  try {
    // Get a reference to the Firebase Realtime Database
    const db = getDatabase();
    // Create a reference to the user's profile path
    const userRef = ref(
      db,
      `${DB_PATHS.users}/${user.uid}/${DB_PATHS.profile}`,
    );
    // Check if the user profile already exists
    const existedUser = await get(userRef);
    assertCurrent();

    if (existedUser.exists()) {
      log.debug("User profile already exists", { userId: user.uid });
      return;
    }

    const userData = {
      email: user.email,
      name:
        fallbackName || user.displayName || user.email?.split("@")[0] || "User",
      createdAt: new Date().toISOString(),
      role: "user",
      subscription: "free",
    };

    // Set the user's profile data in the database
    assertCurrent();
    await set(userRef, userData);

    log.info("User profile created", { userId: user.uid });
  } catch (error) {
    log.error("Firebase operation failed: addUserProfile");
    throw error;
  }
}

export async function addClip(
  userId: string,
  content: string,
  type: ClipContentType,
): Promise<void> {
  const assertCurrent = currentSession(userId);
  if (
    !isEncryptedPayload(content) ||
    content.length > CLIPBOARD_CONFIG.maxContentLength * 8 + 58
  )
    throw new Error("Invalid encrypted clip payload.");
  try {
    // Get a reference to the Firebase Realtime Database
    const db = getDatabase();
    // Get the current device name
    const sourceDevice = os.hostname();
    const sourceDeviceId = settingsStorage.getOrCreateDeviceId();

    log.debug("Adding clip to Firebase", {
      userId,
      contentLength: content.length,
      type,
      sourceDevice,
      sourceDeviceId,
    });

    // Create a properly typed clip object
    const clipData: ClipData = {
      id: uuidv4(),
      content,
      type,
      timestamp: new Date().toISOString(),
      sourceDevice,
      sourceDeviceId,
    };

    // Write data to the user's clipboard path
    const clipRef = ref(db, `${DB_PATHS.users}/${userId}/${DB_PATHS.clips}`);
    const newClipRef = push(clipRef);

    assertCurrent();
    await set(newClipRef, clipData);
  } catch (error) {
    log.error("Firebase operation failed: addClip");
    throw error;
  }
}

export function listenClips(
  userId: string,
  onDataChange?: (clips: Record<string, ClipData>) => void,
  onError?: () => void,
): () => void {
  try {
    // Get a reference to the Firebase Realtime Database
    const db = getDatabase();
    // Create a reference to the specific data path
    const cloudData = ref(db, `${DB_PATHS.users}/${userId}/${DB_PATHS.clips}`);

    log.debug("Setting up Firebase clip listener", { userId });

    // Set up a real-time listener for changes
    const unsubscribe = onValue(
      cloudData,
      (snapshot) => {
        try {
          // Check if the snapshot exists and has data
          if (!snapshot.exists()) {
            log.debug("No clip data available in Firebase");
            if (onDataChange) {
              onDataChange({});
            }
            return;
          }

          // Get the data from the snapshot
          const clips: Record<string, ClipData> = snapshot.val();

          if (onDataChange) {
            onDataChange(clips);
          }
        } catch {
          log.error("Error processing Firebase clip data");
          onError?.();
        }
      },
      () => {
        log.error("Firebase clip listener canceled");
        onError?.();
      },
    );

    // Return the unsubscribe function to allow caller to stop listening
    return unsubscribe;
  } catch {
    log.error("Failed to set up Firebase clip listener");
    onError?.();
    return () => {
      log.debug("Using empty unsubscribe function (fallback)");
    };
  }
}

export async function getClips(): Promise<Record<string, ClipData> | null> {
  try {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
      log.warn("No user is currently authenticated");
      return null;
    }
    const userId = user.uid;
    log.debug("Fetching clips from Firebase", { userId });
    // Get a reference to the Firebase Realtime Database
    const assertCurrent = currentSession(user.uid);
    const db = getDatabase();
    // Create a reference to the specific data path
    const cloudData = ref(db, `${DB_PATHS.users}/${userId}/${DB_PATHS.clips}`);

    // Fetch the data from Firebase
    const snapshot = await get(cloudData);
    assertCurrent();

    if (snapshot.exists()) {
      const clips = snapshot.val();
      log.debug("Clips found", {
        userId,
        clipCount: Object.keys(clips).length,
      });
      return snapshot.val();
    } else {
      log.debug("No clip data available in Firebase");
      return null;
    }
  } catch (error) {
    log.error("Firebase operation failed: getClips");
    throw error;
  }
}

/**
 * Ensures the number of clips for a user stays below the maximum limit
 * by removing the oldest clips when necessary.
 *
 * @param userId - The user ID to check clips for
 */

export async function enforceClipLimit(userId: string): Promise<void> {
  const assertCurrent = currentSession(userId);
  try {
    const db = getDatabase();
    const clipsRef = ref(db, `${DB_PATHS.users}/${userId}/${DB_PATHS.clips}`);
    await runTransaction(
      clipsRef,
      (current: Record<string, ClipData> | null) => {
        assertCurrent();
        if (!current) return undefined;
        const entries = Object.entries(current);
        const excessCount = entries.length - CLIPBOARD_CONFIG.maxClipCount;
        if (excessCount <= 0) return undefined;
        // Order by timestamp to reliably get the oldest clips first
        // Get all unpinned clips sorted by timestamp ascending (oldest first)
        const toRemove = entries
          .filter(([, clip]) => !clip.pinned)
          .sort(
            ([, a], [, b]) =>
              new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
          )
          .slice(0, excessCount);
        if (toRemove.length === 0) {
          log.warn("All clips are pinned, cannot enforce clip limit.");
          return undefined;
        }
        const next = { ...current };
        for (const [key] of toRemove) delete next[key];
        return next;
      },
      { applyLocally: false },
    );
  } catch (error) {
    log.error("Firebase operation failed: enforceClipLimit");
    throw error;
  }
}

export async function removeAllClips(): Promise<void> {
  try {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
      log.warn("No user is currently authenticated");
      return;
    }
    const userId = user.uid;
    log.debug("Removing unpinned clips from Firebase", { userId });
    // Get a reference to the Firebase Realtime Database
    const assertCurrent = currentSession(user.uid);
    const db = getDatabase();
    // Create a reference to the specific clip path
    const clipRef = ref(db, `${DB_PATHS.users}/${userId}/${DB_PATHS.clips}/`);

    // Fetch all clips first
    const snapshot = await get(clipRef);
    assertCurrent();
    if (!snapshot.exists()) {
      log.debug("No clips to remove");
      return;
    }

    const clips = snapshot.val();
    const updates: Record<string, unknown> = {};
    let removedCount = 0;

    // Iterate through clips and identify unpinned ones
    for (const [key, clip] of Object.entries(clips)) {
      // explicit check for pinned property
      if (!(clip as ClipData).pinned) {
        updates[key] = null; // Mark for deletion
        removedCount++;
      }
    }

    if (removedCount > 0) {
      // Perform atomic update to remove unpinned clips
      assertCurrent();
      await runTransaction(
        clipRef,
        (current: Record<string, ClipData> | null) => {
          assertCurrent();
          if (!current) return current;
          return Object.fromEntries(
            Object.entries(current).filter(([, clip]) => clip.pinned),
          );
        },
        { applyLocally: false },
      );
      log.debug(`Removed ${removedCount} unpinned clips from Firebase`, {
        userId,
      });
    } else {
      log.debug("No unpinned clips found to remove", { userId });
    }
  } catch (error) {
    log.error("Firebase operation failed: removeAllClips");
    throw error;
  }
}

export async function removeClip(
  userId: string,
  clipId: string,
): Promise<void> {
  const assertCurrent = currentSession(userId);
  assertDatabaseKey(clipId);
  try {
    const db = getDatabase();
    const clipsRef = ref(db, `${DB_PATHS.users}/${userId}/${DB_PATHS.clips}`);

    // Find the clip by id field
    const clipQuery = query(clipsRef, orderByChild("id"), equalTo(clipId));
    const snapshot = await get(clipQuery);
    assertCurrent();

    let key: string | null = null;
    if (snapshot.exists()) {
      key = Object.keys(snapshot.val())[0];
    } else {
      // Fallback: check if clipId is already the direct node key
      const directRef = ref(
        db,
        `${DB_PATHS.users}/${userId}/${DB_PATHS.clips}/${clipId}`,
      );
      const directSnapshot = await get(directRef);
      assertCurrent();
      if (directSnapshot.exists()) {
        key = clipId;
      }
    }

    if (key) {
      assertCurrent();
      await remove(
        ref(db, `${DB_PATHS.users}/${userId}/${DB_PATHS.clips}/${key}`),
      );
    } else {
      log.warn(`Clip not found for removal`, { userId, clipId });
      throw new Error("Clip no longer exists.");
    }
  } catch (error) {
    log.error("Firebase operation failed: removeClip");
    throw error;
  }
}

export async function updateClip(
  userId: string,
  clipId: string,
  updates: Partial<ClipData>,
): Promise<void> {
  const assertCurrent = currentSession(userId);
  assertDatabaseKey(clipId);
  if (updates.content !== undefined && !isEncryptedPayload(updates.content))
    throw new Error("Invalid encrypted clip payload.");
  try {
    const db = getDatabase();
    const clipsRef = ref(db, `${DB_PATHS.users}/${userId}/${DB_PATHS.clips}`);

    // Find the clip by id field
    const clipQuery = query(clipsRef, orderByChild("id"), equalTo(clipId));
    const snapshot = await get(clipQuery);
    assertCurrent();

    let key: string | null = null;
    if (snapshot.exists()) {
      key = Object.keys(snapshot.val())[0];
    } else {
      // Fallback: check if clipId is already the direct node key
      const directRef = ref(
        db,
        `${DB_PATHS.users}/${userId}/${DB_PATHS.clips}/${clipId}`,
      );
      const directSnapshot = await get(directRef);
      assertCurrent();
      if (directSnapshot.exists()) {
        key = clipId;
      }
    }

    if (key) {
      assertCurrent();
      const result = await runTransaction(
        ref(db, `${DB_PATHS.users}/${userId}/${DB_PATHS.clips}/${key}`),
        (current: ClipData | null) => {
          assertCurrent();
          if (!current) return undefined;
          return { ...current, ...updates };
        },
        { applyLocally: false },
      );
      if (!result.committed) throw new Error("Clip no longer exists.");
      log.debug(`Clip updated`, { userId, clipId });
    } else {
      log.warn(`Clip not found for update`, { userId, clipId });
      throw new Error("Clip no longer exists.");
    }
  } catch (error) {
    log.error("Firebase operation failed: updateClip");
    throw error;
  }
}

export async function pinClip(
  userId: string,
  clipId: string,
  pinned: boolean,
): Promise<void> {
  const assertCurrent = currentSession(userId);
  assertDatabaseKey(clipId);
  try {
    const db = getDatabase();
    const clipsRef = ref(db, `${DB_PATHS.users}/${userId}/${DB_PATHS.clips}`);

    // Find the clip by id field
    const clipQuery = query(clipsRef, orderByChild("id"), equalTo(clipId));
    const snapshot = await get(clipQuery);
    assertCurrent();

    let key: string | null = null;
    if (snapshot.exists()) {
      key = Object.keys(snapshot.val())[0];
    } else {
      // Fallback: check if clipId is already the direct node key
      const directRef = ref(
        db,
        `${DB_PATHS.users}/${userId}/${DB_PATHS.clips}/${clipId}`,
      );
      const directSnapshot = await get(directRef);
      assertCurrent();
      if (directSnapshot.exists()) {
        key = clipId;
      }
    }

    if (key) {
      assertCurrent();
      await update(
        ref(db, `${DB_PATHS.users}/${userId}/${DB_PATHS.clips}/${key}`),
        { pinned },
      );
      log.debug(`Clip pinned status updated`, { userId, clipId, pinned });
    } else {
      log.warn(`Clip not found for pinning`, { userId, clipId });
      throw new Error("Clip no longer exists.");
    }
  } catch (error) {
    log.error("Firebase operation failed: pinClip");
    throw error;
  }
}

export async function addDevice(userId: string): Promise<void> {
  const assertCurrent = currentSession(userId);
  try {
    const db = getDatabase();
    const deviceId = settingsStorage.getOrCreateDeviceId();
    const deviceName = os.hostname();
    const nativePlatform = os.platform();
    const platform =
      nativePlatform === "darwin"
        ? "macOS"
        : nativePlatform === "win32"
          ? "Windows"
          : nativePlatform === "linux"
            ? "Linux"
            : null;
    if (!platform) {
      throw new Error(`Unsupported desktop platform: ${nativePlatform}`);
    }

    const specificDeviceRef = ref(
      db,
      `${DB_PATHS.users}/${userId}/${DB_PATHS.devices}/${deviceId}`,
    );

    assertCurrent();
    await set(specificDeviceRef, {
      id: deviceId,
      deviceName,
      platform,
      lastActive: new Date().toISOString(),
    });

    log.info("Device registered/updated successfully", {
      userId,
      deviceId,
      deviceName,
      platform,
    });
  } catch (error: unknown) {
    log.error("Firebase operation failed: addDevice");
    throw error instanceof Error
      ? error
      : new Error("Device registration failed.");
  }
}

export async function removeDevice(
  userId: string,
  deviceKey: string,
): Promise<void> {
  const assertCurrent = currentSession(userId);
  assertDatabaseKey(deviceKey);
  try {
    const db = getDatabase();
    const deviceRef = ref(
      db,
      `${DB_PATHS.users}/${userId}/${DB_PATHS.devices}/${deviceKey}`,
    );
    assertCurrent();
    await remove(deviceRef);
  } catch (error) {
    log.error("Firebase operation failed: removeDevice");
    throw error;
  }
}

export function listenDeviceStatus(
  userId: string,
  onDeviceRemoved: () => void,
): () => void {
  try {
    const db = getDatabase();
    const currentDeviceId = settingsStorage.getOrCreateDeviceId();
    const devicesRef = ref(
      db,
      `${DB_PATHS.users}/${userId}/${DB_PATHS.devices}/${currentDeviceId}`,
    );
    const assertCurrent = currentSession(userId);
    log.debug("Setting up device status listener", { userId, currentDeviceId });
    const unsubscribe = onValue(
      devicesRef,
      (snapshot) => {
        try {
          assertCurrent();
        } catch {
          return;
        }
        if (!snapshot.exists()) {
          // Device record removed
          log.warn("Device record removed from Firebase, triggering logout", {
            userId,
            currentDeviceId,
          });
          onDeviceRemoved();
        }
      },
      () => {
        try {
          assertCurrent();
        } catch {
          return;
        }
        log.warn("Device status listener failed");
        onDeviceRemoved();
      },
    );

    return unsubscribe;
  } catch {
    log.error("Failed to set up device status listener");
    onDeviceRemoved();
    return () => {};
  }
}

export async function getDevices(): Promise<Record<string, DeviceData> | null> {
  try {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
      log.warn("No user is currently authenticated");
      return null;
    }
    const assertCurrent = currentSession(user.uid);
    const db = getDatabase();
    const deviceRef = ref(
      db,
      `${DB_PATHS.users}/${user.uid}/${DB_PATHS.devices}/`,
    );
    const devices = await get(deviceRef);
    assertCurrent();

    if (devices.exists()) {
      log.debug("Devices fetched");
      return validateDevices(devices.val());
    } else {
      log.debug("No device found");
      return null;
    }
  } catch (error) {
    log.error("Firebase operation failed: getDevices");
    throw error;
  }
}

function validateDevices(value: unknown): Record<string, DeviceData> {
  const validated: Record<string, DeviceData> = {};
  if (!value || typeof value !== "object" || Array.isArray(value))
    return validated;
  for (const [key, record] of Object.entries(value)) {
    if (!record || typeof record !== "object" || Array.isArray(record))
      continue;
    const device = record as DeviceData;
    if (
      key === "__proto__" ||
      key.length > 256 ||
      typeof device.id !== "string" ||
      !device.id ||
      device.id.length > 256 ||
      typeof device.deviceName !== "string" ||
      device.deviceName.length > 256 ||
      typeof device.platform !== "string" ||
      device.platform.length > 64 ||
      typeof device.lastActive !== "string" ||
      device.lastActive.length > 64 ||
      !Number.isFinite(Date.parse(device.lastActive)) ||
      (device.fcmToken !== undefined && typeof device.fcmToken !== "string") ||
      (device.fcmTokenSessionId !== undefined &&
        typeof device.fcmTokenSessionId !== "string")
    )
      continue;
    validated[key] = { ...device };
  }
  return validated;
}

/**
 * Save encryption metadata for the user
 * @param uid User ID
 * @param salt Hex string of the salt
 * @param wrappedKey Hex string of the encrypted DEK
 */

export async function saveEncryptionMetadata(
  uid: string,
  salt: string,
  wrappedKey: string,
): Promise<void> {
  const assertCurrent = currentSession(uid);
  try {
    const db = getDatabase();
    const refPath = ref(db, `${DB_PATHS.users}/${uid}/encryption`);
    assertCurrent();
    await set(refPath, {
      salt,
      wrappedKey,
      createdAt: new Date().toISOString(),
    });
    log.info("Encryption metadata saved to Firebase");
  } catch (error) {
    log.error("Firebase operation failed: saveEncryptionMetadata");
    throw error;
  }
}

/**
 * Get encryption metadata for the user
 * @param uid User ID
 */

export async function getEncryptionMetadata(
  uid: string,
): Promise<{ salt: string; wrappedKey: string } | null> {
  const assertCurrent = currentSession(uid);
  try {
    const db = getDatabase();
    const refPath = ref(db, `${DB_PATHS.users}/${uid}/encryption`);
    const snapshot = await get(refPath);
    assertCurrent();

    if (snapshot.exists()) {
      const metadata = snapshot.val();
      if (
        !metadata ||
        typeof metadata !== "object" ||
        typeof metadata.salt !== "string" ||
        !/^[a-f\d]{32}$/i.test(metadata.salt) ||
        !isEncryptedPayload(metadata.wrappedKey)
      ) {
        throw new Error("Invalid encryption metadata.");
      }
      return { salt: metadata.salt, wrappedKey: metadata.wrappedKey };
    }
    return null;
  } catch (error) {
    log.error("Firebase operation failed: getEncryptionMetadata");
    throw error;
  }
}

/**
 * Wipe all clips for a user.
 * Used during password resets when encryption keys become invalid.
 */

export async function wipeUserClips(userId: string): Promise<void> {
  const assertCurrent = currentSession(userId);
  try {
    const db = getDatabase();
    const clipsRef = ref(db, `${DB_PATHS.users}/${userId}/${DB_PATHS.clips}`);
    assertCurrent();
    await remove(clipsRef);
    log.info("Successfully wiped all clips for user", { userId });
  } catch (error) {
    log.error("Firebase operation failed: wipeUserClips");
    throw error;
  }
}

/**
 * Wipe all devices for a user.
 * Used during password resets.
 */

export async function wipeUserDevices(userId: string): Promise<void> {
  const assertCurrent = currentSession(userId);
  try {
    const db = getDatabase();
    const devicesRef = ref(
      db,
      `${DB_PATHS.users}/${userId}/${DB_PATHS.devices}`,
    );
    assertCurrent();
    await remove(devicesRef);
    log.info("Successfully wiped all devices for user", { userId });
  } catch (error) {
    log.error("Firebase operation failed: wipeUserDevices");
    throw error;
  }
}

/**
 * Wipe encryption metadata for a user.
 * Used during password resets to force the generation of new keys.
 */

export async function wipeEncryptionMetadata(userId: string): Promise<void> {
  const assertCurrent = currentSession(userId);
  try {
    const db = getDatabase();
    const encryptionRef = ref(db, `${DB_PATHS.users}/${userId}/encryption`);
    assertCurrent();
    await remove(encryptionRef);
    log.info("Successfully wiped encryption metadata for user", { userId });
  } catch (error) {
    log.error("Firebase operation failed: wipeEncryptionMetadata");
    throw error;
  }
}
