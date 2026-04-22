/**
 * Firebase Integration Module
 *
 * This module handles Firebase initialization and provides functions
 * for reading from and writing to the Firebase Realtime Database.
 * It's used to synchronize clipboard data across devices.
 */

import os from "node:os";
import type {
  ClipContentType,
  ClipData,
  DeviceData,
} from "@shared/types/clipboard";
import log from "electron-log/main";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  initializeAuth,
  type User,
  type UserProfile,
} from "firebase/auth";
import {
  equalTo,
  get,
  getDatabase,
  onChildRemoved,
  onValue,
  orderByChild,
  push,
  query,
  ref,
  remove,
  set,
  update,
} from "firebase/database";
import { v4 as uuidv4 } from "uuid";

// Configuration constants
const MAX_CLIP_COUNT = 300; // Maximum number of clips to store per user

export function initFirebase(): void {
  log.debug("Initializing Firebase");

  // Check for required Firebase configuration variables
  const requiredEnvVars = [
    "MAIN_VITE_FIREBASE_API_KEY",
    "MAIN_VITE_FIREBASE_AUTH_DOMAIN",
    "MAIN_VITE_FIREBASE_DATABASE_URL",
    "MAIN_VITE_FIREBASE_PROJECT_ID",
  ];

  const missingVars = requiredEnvVars.filter(
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
  // Test calling initializeAuth without options to debug crash
  initializeAuth(app);
  log.info("Firebase initialized successfully (testing initializeAuth)");
}

export async function addUserProfile(user: User): Promise<void> {
  if (!user) {
    log.warn("Cannot add profile: user is not authenticated");
    return;
  }

  try {
    // Get a reference to the Firebase Realtime Database
    const db = getDatabase();
    // Create a reference to the user's profile path
    const userRef = ref(db, `users/${user.uid}/profile`);
    // Check if the user profile already exists
    const existedUser = await get(userRef);

    if (existedUser.exists()) {
      log.debug("User profile already exists", { userId: user.uid });
      return;
    }

    const userData: UserProfile = {
      email: user.email,
      name: user.displayName,
      createdAt: new Date().toISOString(),
      role: "user",
      subscription: "free",
    };

    // Set the user's profile data in the database
    await set(userRef, userData);

    log.info("User profile created", { userId: user.uid });
  } catch (error) {
    log.error(`Failed to add user profile for ${user.uid}`, error);
  }
}

export async function addClip(
  userId: string,
  content: string,
  type: ClipContentType,
): Promise<void> {
  try {
    // Get a reference to the Firebase Realtime Database
    const db = getDatabase();
    // Get the current device name
    const sourceDevice = os.hostname();

    log.debug("Adding clip to Firebase", {
      userId,
      contentLength: content.length,
      type,
      sourceDevice,
    });

    // Create a properly typed clip object
    const clipData: ClipData = {
      id: uuidv4(),
      content,
      type,
      timestamp: new Date().toISOString(),
      sourceDevice,
    };

    // Write data to the user's clipboard path
    const clipRef = ref(db, `users/${userId}/clips`);
    const newClipRef = push(clipRef);

    await set(newClipRef, clipData);
  } catch (error) {
    log.error("Failed to add clip to Firebase", error);
  }
}

export function listenClips(
  userId: string,
  onDataChange?: (clips: Record<string, ClipData>) => void,
): () => void {
  try {
    // Get a reference to the Firebase Realtime Database
    const db = getDatabase();
    // Create a reference to the specific data path
    const cloudData = ref(db, `users/${userId}/clips`);

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
        } catch (error) {
          log.error("Error processing Firebase clip data", error);
        }
      },
      (error) => {
        log.error("Firebase onValue error", error);
      },
    );

    // Return the unsubscribe function to allow caller to stop listening
    return unsubscribe;
  } catch (error) {
    log.error("Failed to set up Firebase clip listener", error);
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
    const db = getDatabase();
    // Create a reference to the specific data path
    const cloudData = ref(db, `users/${userId}/clips`);

    // Fetch the data from Firebase
    const snapshot = await get(cloudData);

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
    log.error("Failed to get clip data", error);
    return null;
  }
}

/**
 * Ensures the number of clips for a user stays below the maximum limit
 * by removing the oldest clips when necessary.
 *
 * @param userId - The user ID to check clips for
 */
export async function enforceClipLimit(userId: string): Promise<void> {
  try {
    const db = getDatabase();
    const clipsRef = ref(db, `users/${userId}/clips`);
    // Order by timestamp to reliably get the oldest clips first
    const clipsQuery = query(clipsRef, orderByChild("timestamp"));
    const snapshot = await get(clipsQuery);

    if (!snapshot.exists()) {
      log.debug("No clips found to enforce limit", { userId });
      return;
    }

    const clips: Record<string, ClipData> = snapshot.val();
    const clipKeys = Object.keys(clips);

    if (clipKeys.length >= MAX_CLIP_COUNT) {
      // Find the oldest unpinned clip
      let oldestUnpinnedKey: string | null = null;
      for (const key of clipKeys) {
        if (!clips[key].pinned) {
          oldestUnpinnedKey = key;
          break; // Found the oldest unpinned because clipKeys is ordered by timestamp mostly, but we should sort it to be sure
        }
      }

      if (oldestUnpinnedKey) {
        log.debug(`Removing oldest unpinned clip to maintain limit`, {
          userId,
          clipId: oldestUnpinnedKey,
          currentCount: clipKeys.length,
          limit: MAX_CLIP_COUNT,
        });

        await remove(ref(db, `users/${userId}/clips/${oldestUnpinnedKey}`));
      } else {
        log.warn("All clips are pinned, cannot enforce clip limit.", {
          userId,
          currentCount: clipKeys.length,
        });
      }
    }
  } catch (error) {
    log.error("Failed to enforce clip limit", error);
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
    const db = getDatabase();
    // Create a reference to the specific clip path
    const clipRef = ref(db, `users/${userId}/clips/`);

    // Fetch all clips first
    const snapshot = await get(clipRef);
    if (!snapshot.exists()) {
      log.debug("No clips to remove");
      return;
    }

    const clips = snapshot.val();
    const updates = {};
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
      await update(clipRef, updates);
      log.debug(`Removed ${removedCount} unpinned clips from Firebase`, {
        userId,
      });
    } else {
      log.debug("No unpinned clips found to remove", { userId });
    }
  } catch (error) {
    log.error("Failed to remove clips from Firebase", error);
  }
}

export async function removeClip(
  userId: string,
  clipId: string,
): Promise<void> {
  try {
    const db = getDatabase();
    const clipsRef = ref(db, `users/${userId}/clips`);

    // Find the clip by id field
    const clipQuery = query(clipsRef, orderByChild("id"), equalTo(clipId));
    const snapshot = await get(clipQuery);

    if (snapshot.exists()) {
      const key = Object.keys(snapshot.val())[0];
      await remove(ref(db, `users/${userId}/clips/${key}`));
    }
  } catch (error) {
    log.error("Failed to remove clip", error);
    throw error;
  }
}

export async function updateClip(
  userId: string,
  clipId: string,
  updates: Partial<ClipData>,
): Promise<void> {
  try {
    const db = getDatabase();
    const clipsRef = ref(db, `users/${userId}/clips`);

    // Find the clip by id field
    const clipQuery = query(clipsRef, orderByChild("id"), equalTo(clipId));
    const snapshot = await get(clipQuery);

    if (snapshot.exists()) {
      const key = Object.keys(snapshot.val())[0];
      await update(ref(db, `users/${userId}/clips/${key}`), updates);
      log.debug(`Clip updated`, { userId, clipId, updates });
    } else {
      log.warn(`Clip not found for update`, { userId, clipId });
    }
  } catch (error) {
    log.error("Failed to update clip", error);
    throw error;
  }
}

export async function pinClip(
  userId: string,
  clipId: string,
  pinned: boolean,
): Promise<void> {
  try {
    const db = getDatabase();
    const clipsRef = ref(db, `users/${userId}/clips`);

    // Find the clip by id field
    const clipQuery = query(clipsRef, orderByChild("id"), equalTo(clipId));
    const snapshot = await get(clipQuery);

    if (snapshot.exists()) {
      const key = Object.keys(snapshot.val())[0];
      await update(ref(db, `users/${userId}/clips/${key}`), { pinned });
      log.debug(`Clip pinned status updated`, { userId, clipId, pinned });
    } else {
      log.warn(`Clip not found for pinning`, { userId, clipId });
    }
  } catch (error) {
    log.error("Failed to update clip pin status", error);
    throw error;
  }
}

export async function addDevice(userId: string): Promise<void> {
  try {
    const db = getDatabase();
    const deviceName = os.hostname();
    const platform = os.platform();

    const deviceRef = ref(db, `users/${userId}/devices/`);
    const deviceQuery = query(
      deviceRef,
      orderByChild("deviceName"),
      equalTo(deviceName),
    );
    const device = await get(deviceQuery);

    if (device.exists()) {
      const deviceKey = Object.keys(device.val())[0];
      // Create reference to the specific device
      const specificDeviceRef = ref(db, `users/${userId}/devices/${deviceKey}`);
      // Update the last active timestamp if the device already exists
      await update(specificDeviceRef, {
        deviceName,
        platform,
        lastActive: new Date().toISOString(),
      });
      log.debug("Device updated", { userId, deviceName, deviceKey });
      return;
    }

    // Device doesn't exist, create new entry
    const newDeviceRef = push(deviceRef);
    await set(newDeviceRef, {
      id: uuidv4(),
      deviceName,
      platform,
      lastActive: new Date().toISOString(),
    });
    log.info("New device registered", { userId, deviceName, platform });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error("Error managing device registration:", errorMessage);
    throw new Error(errorMessage);
  }
}

export async function removeDevice(
  userId: string,
  deviceKey: string,
): Promise<void> {
  try {
    const db = getDatabase();
    const deviceRef = ref(db, `users/${userId}/devices/${deviceKey}`);
    await remove(deviceRef);
  } catch (error) {
    log.error("Failed to remove device", error);
  }
}

export function listenDeviceStatus(
  userId: string,
  onDeviceRemoved: () => void,
): () => void {
  try {
    const db = getDatabase();
    const deviceName = os.hostname();
    const devicesRef = ref(db, `users/${userId}/devices/`);

    log.debug("Setting up device status listener", { userId, deviceName });

    const unsubscribe = onChildRemoved(devicesRef, (snapshot) => {
      const deviceData = snapshot.val();
      if (deviceData && deviceData.deviceName === deviceName) {
        // Device record removed
        log.warn("Device record removed from Firebase, triggering logout", {
          userId,
          deviceName,
        });
        onDeviceRemoved();
      }
    });

    return unsubscribe;
  } catch (error) {
    log.error("Failed to set up device status listener", error);
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
    const db = getDatabase();
    const deviceRef = ref(db, `users/${user.uid}/devices/`);
    const devices = await get(deviceRef);

    if (devices.exists()) {
      log.debug("Devices found", devices.val());
      return devices.val();
    } else {
      log.debug("No device found");
      return null;
    }
  } catch (error) {
    log.error("Failed to get device data", error);
    return null;
  }
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
  try {
    const db = getDatabase();
    const refPath = ref(db, `users/${uid}/encryption`);
    await set(refPath, {
      salt,
      wrappedKey,
      createdAt: new Date().toISOString(),
    });
    log.info("Encryption metadata saved to Firebase");
  } catch (error) {
    log.error("Failed to save encryption metadata", error);
  }
}

/**
 * Get encryption metadata for the user
 * @param uid User ID
 */
export async function getEncryptionMetadata(
  uid: string,
): Promise<{ salt: string; wrappedKey: string } | null> {
  try {
    const db = getDatabase();
    const refPath = ref(db, `users/${uid}/encryption`);
    const snapshot = await get(refPath);

    if (snapshot.exists()) {
      return snapshot.val();
    }
    return null;
  } catch (error) {
    log.error("Failed to get encryption metadata", error);
    return null;
  }
}

/**
 * Wipe all clips for a user.
 * Used during password resets when encryption keys become invalid.
 */
export async function wipeUserClips(userId: string): Promise<void> {
  try {
    const db = getDatabase();
    const clipsRef = ref(db, `users/${userId}/clips`);
    await remove(clipsRef);
    log.info("Successfully wiped all clips for user", { userId });
  } catch (error) {
    log.error("Failed to wipe user clips", error);
    throw error;
  }
}

/**
 * Wipe all devices for a user.
 * Used during password resets.
 */
export async function wipeUserDevices(userId: string): Promise<void> {
  try {
    const db = getDatabase();
    const devicesRef = ref(db, `users/${userId}/devices`);
    await remove(devicesRef);
    log.info("Successfully wiped all devices for user", { userId });
  } catch (error) {
    log.error("Failed to wipe user devices", error);
    throw error;
  }
}

/**
 * Wipe encryption metadata for a user.
 * Used during password resets to force the generation of new keys.
 */
export async function wipeEncryptionMetadata(userId: string): Promise<void> {
  try {
    const db = getDatabase();
    const encryptionRef = ref(db, `users/${userId}/encryption`);
    await remove(encryptionRef);
    log.info("Successfully wiped encryption metadata for user", { userId });
  } catch (error) {
    log.error("Failed to wipe encryption metadata", error);
    throw error;
  }
}
