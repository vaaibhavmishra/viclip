import { getApp } from "@react-native-firebase/app";
import { getAuth } from "@react-native-firebase/auth";
import {
  equalTo,
  get,
  getDatabase,
  orderByChild,
  push,
  query,
  ref,
  remove,
  set,
  update,
} from "@react-native-firebase/database";
import { CLIPBOARD_CONFIG, DB_PATHS } from "@viclip/constants";
import * as Crypto from "expo-crypto";
import * as Device from "expo-device";
import type { User, UserProfile } from "@/types/auth";
import type { ClipContentType, ClipData } from "@/types/clips";
import type { DeviceData } from "@/types/device";

export async function addUserProfile(user: User): Promise<void> {
  if (!user) {
    return;
  }
  const db = getDatabase(
    getApp(),
    "https://viclip-4c869-test.asia-southeast1.firebasedatabase.app/",
  );

  const userRef = ref(db, `${DB_PATHS.users}/${user.uid}/${DB_PATHS.profile}`);

  const existedUser = await get(userRef);

  if (existedUser.exists()) {
    return;
  }

  const userData: UserProfile = {
    email: user.email,
    name: user.displayName,
    createdAt: new Date().toISOString(),
  };

  await set(userRef, userData);
}

export async function addDevice(userId: string): Promise<void> {
  const db = getDatabase(
    getApp(),
    "https://viclip-4c869-test.asia-southeast1.firebasedatabase.app/",
  );
  const deviceName = Device.deviceName;
  const platform =
    Device.osName === "Android" || Device.osName === "iOS"
      ? Device.osName
      : "Android";

  const deviceRef = ref(db, `${DB_PATHS.users}/${userId}/${DB_PATHS.devices}/`);

  const deviceQuery = query(
    deviceRef,
    orderByChild("deviceName"),
    equalTo(deviceName),
  );

  const device = await get(deviceQuery);

  if (device.exists()) {
    const deviceKey = Object.keys(device.val())[0];

    const specificDeviceRef = ref(
      db,
      `${DB_PATHS.users}/${userId}/${DB_PATHS.devices}/${deviceKey}`,
    );

    await update(specificDeviceRef, {
      deviceName,
      platform,
      lastActive: new Date().toISOString(),
    });
    return;
  }

  const newDeviceRef = push(deviceRef);
  await set(newDeviceRef, {
    id: Crypto.randomUUID(),
    deviceName,
    platform,
    lastActive: new Date().toISOString(),
  });
}

export async function getDevices(): Promise<Record<string, DeviceData> | null> {
  const user = getAuth().currentUser;
  if (!user) {
    return null;
  }
  const db = getDatabase(
    getApp(),
    "https://viclip-4c869-test.asia-southeast1.firebasedatabase.app/",
  );
  const devicesRef = ref(
    db,
    `${DB_PATHS.users}/${user.uid}/${DB_PATHS.devices}/`,
  );
  const devices = await get(devicesRef);

  if (devices.exists()) {
    return devices.val();
  } else {
    return null;
  }
}

export async function addClip(
  content: string,
  type: ClipContentType,
): Promise<void> {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) {
    return;
  }
  const userId = user.uid;
  const db = getDatabase(
    getApp(),
    "https://viclip-4c869-test.asia-southeast1.firebasedatabase.app/",
  );
  // Create a properly typed clip object
  const clipData: ClipData = {
    id: Crypto.randomUUID(),
    content,
    type,
    timestamp: new Date().toISOString(),
    sourceDevice: Device.deviceName ?? "Unknown Device",
  };

  // Write data to the user's clipboard path
  const clipRef = ref(db, `${DB_PATHS.users}/${userId}/${DB_PATHS.clips}`);
  const newClipRef = push(clipRef);

  await set(newClipRef, clipData);
}

export async function getClips(): Promise<Record<string, ClipData> | null> {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) {
    return null;
  }
  const userId = user.uid;
  // Get a reference to the Firebase Realtime Database
  const db = getDatabase(
    getApp(),
    "https://viclip-4c869-test.asia-southeast1.firebasedatabase.app/",
  );
  // Create a reference to the specific data path
  const cloudData = ref(db, `${DB_PATHS.users}/${userId}/${DB_PATHS.clips}`);

  // Fetch the data from Firebase
  const snapshot = await get(cloudData);

  if (snapshot.exists()) {
    return snapshot.val();
  } else {
    return null;
  }
}

/**
 * Ensures the number of clips for a user stays below the maximum limit
 * by removing the oldest clips when necessary.
 */
export async function enforceClipLimit(): Promise<void> {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) {
    return;
  }
  const userId = user.uid;
  try {
    const db = getDatabase(
      getApp(),
      "https://viclip-4c869-test.asia-southeast1.firebasedatabase.app/",
    );
    const clipsRef = ref(db, `${DB_PATHS.users}/${userId}/${DB_PATHS.clips}`);
    // Order by timestamp to reliably get the oldest clips first
    const clipsQuery = query(clipsRef, orderByChild("timestamp"));
    const snapshot = await get(clipsQuery);

    if (!snapshot.exists()) {
      console.debug("No clips found to enforce limit", { userId });
      return;
    }

    const clips: Record<string, ClipData> = snapshot.val();
    const clipKeys = Object.keys(clips);

    if (clipKeys.length >= CLIPBOARD_CONFIG.maxClipCount) {
      // Find the oldest unpinned clip
      let oldestUnpinnedKey: string | null = null;
      for (const key of clipKeys) {
        if (!clips[key].pinned) {
          oldestUnpinnedKey = key;
          break; // Found the oldest unpinned because clipKeys is ordered by timestamp mostly, but we should sort it to be sure
        }
      }

      if (oldestUnpinnedKey) {
        console.debug(`Removing oldest unpinned clip to maintain limit`, {
          userId,
          clipId: oldestUnpinnedKey,
          currentCount: clipKeys.length,
          limit: CLIPBOARD_CONFIG.maxClipCount,
        });

        await remove(
          ref(
            db,
            `${DB_PATHS.users}/${userId}/${DB_PATHS.clips}/${oldestUnpinnedKey}`,
          ),
        );
      } else {
        console.warn("All clips are pinned, cannot enforce clip limit.", {
          userId,
          currentCount: clipKeys.length,
        });
      }
    }
  } catch (error) {
    console.error("Failed to enforce clip limit", error);
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
    const db = getDatabase(
      getApp(),
      "https://viclip-4c869-test.asia-southeast1.firebasedatabase.app/",
    );
    const refPath = ref(db, `${DB_PATHS.users}/${uid}/encryption`);
    await set(refPath, {
      salt,
      wrappedKey,
      createdAt: new Date().toISOString(),
    });
    console.info("Encryption metadata saved to Firebase");
  } catch (error) {
    console.error("Failed to save encryption metadata", error);
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
    const db = getDatabase(
      getApp(),
      "https://viclip-4c869-test.asia-southeast1.firebasedatabase.app/",
    );
    const refPath = ref(db, `${DB_PATHS.users}/${uid}/encryption`);
    const snapshot = await get(refPath);

    if (snapshot.exists()) {
      return snapshot.val();
    }
    return null;
  } catch (error) {
    console.error("Failed to get encryption metadata", error);
    return null;
  }
}

/**
 * Wipe all clips for a user.
 * Used during password resets when encryption keys become invalid.
 */
export async function wipeUserClips(userId: string): Promise<void> {
  try {
    const db = getDatabase(
      getApp(),
      "https://viclip-4c869-test.asia-southeast1.firebasedatabase.app/",
    );
    const clipsRef = ref(db, `${DB_PATHS.users}/${userId}/${DB_PATHS.clips}`);
    await remove(clipsRef);
    console.info("Successfully wiped all clips for user", { userId });
  } catch (error) {
    console.error("Failed to wipe user clips", error);
    throw error;
  }
}

/**
 * Wipe all devices for a user.
 * Used during password resets.
 */
export async function wipeUserDevices(userId: string): Promise<void> {
  try {
    const db = getDatabase(
      getApp(),
      "https://viclip-4c869-test.asia-southeast1.firebasedatabase.app/",
    );
    const devicesRef = ref(
      db,
      `${DB_PATHS.users}/${userId}/${DB_PATHS.devices}`,
    );
    await remove(devicesRef);
    console.info("Successfully wiped all devices for user", { userId });
  } catch (error) {
    console.error("Failed to wipe user devices", error);
    throw error;
  }
}

/**
 * Wipe encryption metadata for a user.
 * Used during password resets to force the generation of new keys.
 */
export async function wipeEncryptionMetadata(userId: string): Promise<void> {
  try {
    const db = getDatabase(
      getApp(),
      "https://viclip-4c869-test.asia-southeast1.firebasedatabase.app/",
    );
    const encryptionRef = ref(db, `${DB_PATHS.users}/${userId}/encryption`);
    await remove(encryptionRef);
    console.info("Successfully wiped encryption metadata for user", { userId });
  } catch (error) {
    console.error("Failed to wipe encryption metadata", error);
    throw error;
  }
}

export async function removeAllClips(): Promise<void> {
  try {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
      console.warn("No user is currently authenticated");
      return;
    }
    const userId = user.uid;
    console.debug("Removing unpinned clips from Firebase", { userId });
    // Get a reference to the Firebase Realtime Database
    const db = getDatabase(
      getApp(),
      "https://viclip-4c869-test.asia-southeast1.firebasedatabase.app/",
    );
    // Create a reference to the specific clip path
    const clipRef = ref(db, `${DB_PATHS.users}/${userId}/${DB_PATHS.clips}/`);

    // Fetch all clips first
    const snapshot = await get(clipRef);
    if (!snapshot.exists()) {
      console.debug("No clips to remove");
      return;
    }

    const clips = snapshot.val();
    const updates: Record<string, null> = {};
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
      console.debug(`Removed ${removedCount} unpinned clips from Firebase`, {
        userId,
      });
    } else {
      console.debug("No unpinned clips found to remove", { userId });
    }
  } catch (error) {
    console.error("Failed to remove clips from Firebase", error);
  }
}

export async function removeClip(clipId: string): Promise<void> {
  try {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
      console.warn("No user is currently authenticated");
      return;
    }
    const userId = user.uid;
    const db = getDatabase(
      getApp(),
      "https://viclip-4c869-test.asia-southeast1.firebasedatabase.app/",
    );
    const clipsRef = ref(db, `${DB_PATHS.users}/${userId}/${DB_PATHS.clips}`);

    // Find the clip by id field
    const clipQuery = query(clipsRef, orderByChild("id"), equalTo(clipId));
    const snapshot = await get(clipQuery);

    if (snapshot.exists()) {
      const key = Object.keys(snapshot.val())[0];
      await remove(
        ref(db, `${DB_PATHS.users}/${userId}/${DB_PATHS.clips}/${key}`),
      );
    }
  } catch (error) {
    console.error("Failed to remove clip", error);
    throw error;
  }
}

export async function togglePinClip(
  clipId: string,
  pinned: boolean,
): Promise<void> {
  try {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
      console.warn("No user is currently authenticated");
      return;
    }
    const userId = user.uid;

    const db = getDatabase(
      getApp(),
      "https://viclip-4c869-test.asia-southeast1.firebasedatabase.app/",
    );
    const clipsRef = ref(db, `${DB_PATHS.users}/${userId}/${DB_PATHS.clips}`);

    // Find the clip by id field
    const clipQuery = query(clipsRef, orderByChild("id"), equalTo(clipId));
    const snapshot = await get(clipQuery);

    if (snapshot.exists()) {
      const key = Object.keys(snapshot.val())[0];
      const specificClipRef = ref(
        db,
        `${DB_PATHS.users}/${userId}/${DB_PATHS.clips}/${key}`,
      );
      await update(specificClipRef, { pinned });
    }
  } catch (error) {
    console.error("Failed to toggle pin clip", error);
    throw error;
  }
}

export async function updateClip(clipId: string): Promise<void> {
  try {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
      console.warn("No user is currently authenticated");
      return;
    }
    const userId = user.uid;
    const db = getDatabase(
      getApp(),
      "https://viclip-4c869-test.asia-southeast1.firebasedatabase.app/",
    );
    const clipsRef = ref(db, `${DB_PATHS.users}/${userId}/${DB_PATHS.clips}`);

    // Find the clip by id field
    const clipQuery = query(clipsRef, orderByChild("id"), equalTo(clipId));
    const snapshot = await get(clipQuery);

    if (snapshot.exists()) {
      const key = Object.keys(snapshot.val())[0];
      await update(
        ref(db, `${DB_PATHS.users}/${userId}/${DB_PATHS.clips}/${key}`),
        {
          timestamp: new Date().toISOString(),
          sourceDevice: Device.deviceName,
        },
      );
    } else {
      console.warn(`Clip not found for update`, { userId, clipId });
    }
  } catch (error) {
    console.error("Failed to update clip", error);
    throw error;
  }
}
