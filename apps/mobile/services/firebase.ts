import { getApp } from "@react-native-firebase/app";
import { getAuth } from "@react-native-firebase/auth";
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
} from "@react-native-firebase/database";
import { CLIPBOARD_CONFIG, DB_PATHS } from "@viclip/constants";
import type {
  ClipContentType,
  ClipData,
  DeviceData,
  User,
  UserProfile,
} from "@viclip/types";
import { isEncryptedPayload } from "@viclip/utils";
import * as Crypto from "expo-crypto";
import * as Device from "expo-device";
import * as SecureStore from "expo-secure-store";
import { isKeyLoaded } from "./crypto";
import {
  capturePushSession,
  isPushSessionCurrent,
  type PushSession,
} from "./pushSession";

function getRTDB() {
  return getDatabase(getApp());
}

const MAX_ENCRYPTED_CONTENT = CLIPBOARD_CONFIG.maxContentLength * 8 + 58;
const CONTENT_TYPES = new Set([
  "text",
  "text-formatted",
  "url",
  "email",
  "color",
  "document",
  "spreadsheet",
  "presentation",
  "unknown",
]);

function currentSession(): PushSession | null {
  const uid = getAuth().currentUser?.uid;
  return uid ? capturePushSession(uid) : null;
}

/** Keep native SDK cleanup failures out of React's unmount lifecycle. */
function detachDatabaseListeners(...unsubscribes: Array<() => void>): void {
  for (const unsubscribe of unsubscribes) {
    try {
      unsubscribe();
    } catch {
      // Attempt every listener even if one native detach fails. Callbacks must
      // already be inactive before cleanup so retained listeners cannot act.
      console.warn("Unable to detach Firebase database listener");
    }
  }
}

function requireSession(
  session: PushSession | null | undefined,
  uid?: string,
): PushSession {
  if (
    !session ||
    !isPushSessionCurrent(session) ||
    (uid && session.userId !== uid)
  ) {
    throw new Error(
      "ERR_SESSION_CHANGED: An active account session is required",
    );
  }
  return session;
}

function requireClipboardSession(
  session: PushSession | null | undefined,
): PushSession {
  const owner = requireSession(session);
  if (!isKeyLoaded(owner.userId))
    throw new Error("The current account encryption key is unavailable");
  return owner;
}

function isIdentifier(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 256 &&
    value !== "__proto__" &&
    !Array.from(value).some(
      (char) =>
        ".#$[]/".includes(char) ||
        char.charCodeAt(0) < 32 ||
        char.charCodeAt(0) === 127,
    )
  );
}

function validateKey(value: string): void {
  if (!isIdentifier(value)) throw new Error("Invalid database identifier");
}

function boundedString(value: unknown, maximum = 256): value is string {
  return typeof value === "string" && value.length <= maximum;
}

function validateEncryptedContent(
  content: string,
  type?: ClipContentType,
): void {
  if (!isEncryptedPayload(content) || content.length > MAX_ENCRYPTED_CONTENT) {
    throw new Error("A valid encrypted clipboard payload is required");
  }
  if (type !== undefined && !CONTENT_TYPES.has(type))
    throw new Error("Unsupported clipboard content type");
}

function parseClips(value: unknown): Record<string, ClipData> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const result: Record<string, ClipData> = Object.create(null);
  for (const [key, raw] of Object.entries(value)) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const clip = raw as Record<string, unknown>;
    const timestamp =
      typeof clip.timestamp === "number"
        ? clip.timestamp
        : typeof clip.timestamp === "string"
          ? Date.parse(clip.timestamp)
          : Number.NaN;
    if (
      !isIdentifier(key) ||
      !isIdentifier(clip.id) ||
      typeof clip.content !== "string" ||
      !isEncryptedPayload(clip.content) ||
      clip.content.length > MAX_ENCRYPTED_CONTENT ||
      typeof clip.type !== "string" ||
      !CONTENT_TYPES.has(clip.type) ||
      !Number.isFinite(timestamp) ||
      Math.abs(timestamp) > 8640000000000000 ||
      !boundedString(clip.sourceDevice) ||
      (clip.sourceDeviceId !== undefined &&
        !boundedString(clip.sourceDeviceId)) ||
      (clip.pinned !== undefined && typeof clip.pinned !== "boolean")
    )
      continue;
    result[key] = {
      id: clip.id,
      content: clip.content,
      type: clip.type as ClipContentType,
      timestamp: new Date(timestamp).toISOString(),
      sourceDevice: clip.sourceDevice,
      ...(typeof clip.sourceDeviceId === "string"
        ? { sourceDeviceId: clip.sourceDeviceId }
        : {}),
      ...(typeof clip.pinned === "boolean" ? { pinned: clip.pinned } : {}),
    };
  }
  return Object.keys(result).length ? result : null;
}

function parseDevices(value: unknown): Record<string, DeviceData> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const result: Record<string, DeviceData> = Object.create(null);
  for (const [key, raw] of Object.entries(value)) {
    if (!raw || typeof raw !== "object") continue;
    const device = raw as Record<string, unknown>;
    // Older desktop registrations use Node's OS names instead of shared labels.
    const platform =
      device.platform === "darwin"
        ? "macOS"
        : device.platform === "win32"
          ? "Windows"
          : device.platform === "linux"
            ? "Linux"
            : device.platform;
    if (
      !isIdentifier(key) ||
      !isIdentifier(device.id) ||
      !boundedString(device.deviceName) ||
      !boundedString(device.lastActive, 64) ||
      (device.fcmToken !== undefined &&
        !boundedString(device.fcmToken, 4096)) ||
      (device.fcmTokenSessionId !== undefined &&
        !isIdentifier(device.fcmTokenSessionId)) ||
      !Number.isFinite(Date.parse(device.lastActive)) ||
      typeof platform !== "string" ||
      !["Android", "iOS", "Windows", "macOS", "Linux", "Web"].includes(platform)
    )
      continue;
    result[key] = {
      id: device.id,
      deviceName: device.deviceName,
      platform,
      lastActive: device.lastActive,
      ...(typeof device.fcmToken === "string"
        ? { fcmToken: device.fcmToken }
        : {}),
      ...(typeof device.fcmTokenSessionId === "string"
        ? { fcmTokenSessionId: device.fcmTokenSessionId }
        : {}),
    };
  }
  return Object.keys(result).length ? result : null;
}

const DEVICE_ID_KEY = "viclip_device_id";

let cachedDeviceId: string | null = null;
let deviceIdPromise: Promise<string> | null = null;

export async function getDeviceId(): Promise<string> {
  if (cachedDeviceId) {
    return cachedDeviceId;
  }
  if (deviceIdPromise) {
    return deviceIdPromise;
  }

  deviceIdPromise = (async () => {
    try {
      let id = await SecureStore.getItemAsync(DEVICE_ID_KEY);
      if (!id) {
        id = Crypto.randomUUID();
        await SecureStore.setItemAsync(DEVICE_ID_KEY, id);
      }
      validateKey(id);
      cachedDeviceId = id;
      return id;
    } finally {
      deviceIdPromise = null;
    }
  })();

  return deviceIdPromise;
}

export async function addUserProfile(
  user: User,
  fallbackName?: string,
): Promise<void> {
  const session = requireSession(currentSession(), user.uid ?? undefined);
  if (!user) {
    return;
  }
  const db = getRTDB();

  const userRef = ref(db, `${DB_PATHS.users}/${user.uid}/${DB_PATHS.profile}`);

  const existedUser = await get(userRef);
  requireSession(session);

  if (existedUser.exists()) {
    return;
  }

  const userData: UserProfile = {
    email: user.email || "",
    name:
      fallbackName || user.displayName || user.email?.split("@")[0] || "User",
    createdAt: new Date().toISOString(),
  };

  await set(userRef, userData);
  requireSession(session);
}

export function getCurrentDeviceName(): string {
  return (
    Device.deviceName ||
    (Device.osName === "Android" ? "Android Device" : "iOS Device")
  );
}

export async function addDevice(
  userId: string,
  fcmToken?: string,
  session: PushSession | null = capturePushSession(userId),
  isAllowed: () => boolean = () => true,
): Promise<void> {
  if (
    !session ||
    session.userId !== userId ||
    !isPushSessionCurrent(session) ||
    !isAllowed()
  ) {
    return;
  }
  const db = getRTDB();
  const deviceName = getCurrentDeviceName();
  const platform =
    Device.osName === "Android" || Device.osName === "iOS"
      ? Device.osName
      : "Android";

  const deviceId = await getDeviceId();
  if (!isPushSessionCurrent(session) || !isAllowed()) return;
  const deviceRef = ref(db, `${DB_PATHS.users}/${userId}/${DB_PATHS.devices}/`);

  const deviceQuery = query(deviceRef, orderByChild("id"), equalTo(deviceId));

  const device = await get(deviceQuery);
  if (!isPushSessionCurrent(session) || !isAllowed()) return;

  if (device.exists()) {
    const deviceEntries = Object.entries(device.val());
    const [primaryKey] = deviceEntries[0];

    const specificDeviceRef = ref(
      db,
      `${DB_PATHS.users}/${userId}/${DB_PATHS.devices}/${primaryKey}`,
    );

    const updatePayload: Partial<DeviceData> = {
      deviceName,
      platform,
      lastActive: new Date().toISOString(),
      fcmTokenSessionId: session.id,
    };
    updatePayload.fcmToken = fcmToken ?? "";

    await runTransaction(
      specificDeviceRef,
      (current: DeviceData | null) => {
        if (!isPushSessionCurrent(session) || !isAllowed() || !current)
          return undefined;
        return { ...current, ...updatePayload };
      },
      { applyLocally: false },
    );
    if (!isPushSessionCurrent(session) || !isAllowed()) return;

    // Clean up any stale duplicate entries for this deviceId
    if (deviceEntries.length > 1) {
      const cleanupUpdates: Record<string, null> = {};
      for (let i = 1; i < deviceEntries.length; i++) {
        cleanupUpdates[deviceEntries[i][0]] = null;
      }
      await update(deviceRef, cleanupUpdates);
    }
    return;
  }

  const newDeviceRef = ref(
    db,
    `${DB_PATHS.users}/${userId}/${DB_PATHS.devices}/${deviceId}`,
  );
  const newPayload: DeviceData = {
    id: deviceId,
    deviceName,
    platform,
    lastActive: new Date().toISOString(),
    fcmTokenSessionId: session.id,
    ...(fcmToken ? { fcmToken } : {}),
  };
  await runTransaction(
    newDeviceRef,
    (current: DeviceData | null) => {
      if (!isPushSessionCurrent(session) || !isAllowed()) return undefined;
      return { ...current, ...newPayload };
    },
    { applyLocally: false },
  );
}

export async function updateDeviceFCMToken(
  userId: string,
  fcmToken: string,
  session: PushSession | null = capturePushSession(userId),
  isAllowed: () => boolean = () => true,
): Promise<boolean> {
  if (
    !session ||
    session.userId !== userId ||
    !isPushSessionCurrent(session) ||
    !isAllowed()
  ) {
    return false;
  }
  const db = getRTDB();
  const deviceName = getCurrentDeviceName();

  const deviceId = await getDeviceId();
  if (!isPushSessionCurrent(session) || !isAllowed()) return false;
  const deviceRef = ref(db, `${DB_PATHS.users}/${userId}/${DB_PATHS.devices}/`);
  const deviceQuery = query(deviceRef, orderByChild("id"), equalTo(deviceId));

  const device = await get(deviceQuery);
  if (!isPushSessionCurrent(session) || !isAllowed()) return false;
  if (device.exists()) {
    const deviceEntries = Object.entries(device.val());
    const [primaryKey] = deviceEntries[0];
    const specificDeviceRef = ref(
      db,
      `${DB_PATHS.users}/${userId}/${DB_PATHS.devices}/${primaryKey}`,
    );
    const result = await runTransaction(
      specificDeviceRef,
      (current: DeviceData | null) => {
        if (
          !isPushSessionCurrent(session) ||
          !isAllowed() ||
          !current ||
          current.id !== deviceId
        )
          return undefined;
        return {
          ...current,
          fcmToken,
          fcmTokenSessionId: session.id,
          lastActive: new Date().toISOString(),
        };
      },
      { applyLocally: false },
    );
    if (!isPushSessionCurrent(session) || !isAllowed()) return false;

    if (deviceEntries.length > 1) {
      const cleanupUpdates: Record<string, null> = {};
      for (let i = 1; i < deviceEntries.length; i++) {
        cleanupUpdates[deviceEntries[i][0]] = null;
      }
      await update(deviceRef, cleanupUpdates);
    }
    console.info(`[FCM] Updated token for device: ${deviceName}`);
    return result.committed;
  }
  // A missing registration may be remote revocation. Only explicit authentication
  // may create a device; token refresh must not undo its removal.
  return false;
}

/** Clear only the captured account's unchanged token binding during logout. */
export async function clearDeviceFCMTokenForLogout(
  userId: string,
  isActive: () => boolean,
): Promise<void> {
  if (!isActive()) return;
  const db = getRTDB();
  const deviceId = await getDeviceId();
  if (!isActive()) return;

  const devicesRef = ref(
    db,
    `${DB_PATHS.users}/${userId}/${DB_PATHS.devices}/`,
  );
  const snapshot = await get(
    query(devicesRef, orderByChild("id"), equalTo(deviceId)),
  );
  if (!isActive() || !snapshot.exists()) return;

  const devices = snapshot.val() as Record<string, DeviceData>;
  for (const [key, device] of Object.entries(devices)) {
    if (!isActive()) return;
    if (!device.fcmToken) continue;
    const expectedToken = device.fcmToken;
    const expectedSessionId = device.fcmTokenSessionId;
    await runTransaction(
      ref(db, `${DB_PATHS.users}/${userId}/${DB_PATHS.devices}/${key}`),
      (current: DeviceData | null) => {
        // A timeout does not cancel Firebase work; abort retries after logout
        // or if a newer authentication session has registered the same token.
        if (
          !isActive() ||
          !current ||
          current.id !== deviceId ||
          current.fcmToken !== expectedToken ||
          current.fcmTokenSessionId !== expectedSessionId
        ) {
          return undefined;
        }
        return { ...current, fcmToken: "" };
      },
      { applyLocally: false },
    );
  }
}

export async function getDevices(
  session: PushSession | null = currentSession(),
): Promise<Record<string, DeviceData> | null> {
  requireSession(session);
  const user = getAuth().currentUser;
  if (!user) {
    return null;
  }
  const db = getRTDB();
  const devicesRef = ref(
    db,
    `${DB_PATHS.users}/${user.uid}/${DB_PATHS.devices}/`,
  );
  const devices = await get(devicesRef);
  requireSession(session);

  if (devices.exists()) {
    return parseDevices(devices.val());
  } else {
    return null;
  }
}

/**
 * Remove a device by its Firebase key.
 * Used for remote device logout from the devices screen.
 */
export async function removeDevice(
  deviceKey: string,
  session: PushSession | null = currentSession(),
): Promise<void> {
  requireSession(session);
  validateKey(deviceKey);
  const user = getAuth().currentUser;
  if (!user) {
    console.warn("No user is currently authenticated");
    return;
  }
  const db = getRTDB();
  const deviceRef = ref(
    db,
    `${DB_PATHS.users}/${user.uid}/${DB_PATHS.devices}/${deviceKey}`,
  );
  await remove(deviceRef);
}

/**
 * Subscribe to real-time changes on the devices list.
 * Returns an unsubscribe function.
 */
export function listenDevices(
  onDevicesChanged: (devices: Record<string, DeviceData> | null) => void,
  onError?: (error: Error) => void,
): () => void {
  const user = getAuth().currentUser;
  const session = user ? capturePushSession(user.uid) : null;
  let active = true;
  if (!user || !session) {
    console.warn("No user is currently authenticated");
    onDevicesChanged(null);
    return () => {};
  }
  const db = getRTDB();
  const devicesRef = ref(
    db,
    `${DB_PATHS.users}/${user.uid}/${DB_PATHS.devices}/`,
  );

  const unsubscribe = onValue(
    devicesRef,
    (snapshot) => {
      if (!active || !isPushSessionCurrent(session)) return;
      if (snapshot.exists()) {
        onDevicesChanged(parseDevices(snapshot.val()));
      } else {
        onDevicesChanged(null);
      }
    },
    (error) => {
      if (!active || !isPushSessionCurrent(session)) return;
      console.error("Device listener error:", error);
      if (onError) {
        onError(error);
      } else {
        onDevicesChanged(null);
      }
    },
  );

  return () => {
    if (!active) return;
    active = false;
    detachDatabaseListeners(unsubscribe);
  };
}

/**
 * Listen for the current device being removed from Firebase.
 * When another device removes this device's entry, the callback fires
 * so the app can trigger a logout.
 *
 * Uses an installation-ID query and confirms apparently missing cached data
 * while connected, so cold revocation and duplicate cleanup remain distinct.
 */
export function listenOwnDeviceRemoval(
  _currentDeviceName: string,
  onRemoved: () => void,
  currentDeviceId?: string,
): () => void {
  const user = getAuth().currentUser;
  const session = user ? capturePushSession(user.uid) : null;
  if (!user || !session || !currentDeviceId) return () => {};
  const db = getRTDB();
  const devicesRef = ref(
    db,
    `${DB_PATHS.users}/${user.uid}/${DB_PATHS.devices}`,
  );
  let active = true;
  let connected = false;
  let hasSnapshot = false;
  let exists = false;
  let removed = false;
  let checking = false;
  const ownDeviceQuery = query(
    devicesRef,
    orderByChild("id"),
    equalTo(currentDeviceId),
  );
  const checkRemoval = () => {
    if (
      !active ||
      !isPushSessionCurrent(session) ||
      !connected ||
      !hasSnapshot ||
      exists ||
      removed ||
      checking
    )
      return;
    checking = true;
    // Re-read an apparently missing cached registration before treating it as revocation.
    void get(ownDeviceQuery)
      .then((snapshot) => {
        if (
          active &&
          isPushSessionCurrent(session) &&
          connected &&
          !exists &&
          !snapshot.exists() &&
          !removed
        ) {
          removed = true;
          onRemoved();
        }
      })
      .catch(() => {
        console.warn("Unable to confirm device registration");
      })
      .finally(() => {
        checking = false;
      });
  };
  // When currentDeviceId is known, strictly match on ID to avoid collateral logouts
  // of other devices with the same name (such as generic "iPhone").
  const unsubscribeDevices = onValue(
    ownDeviceQuery,
    (snapshot) => {
      if (!active || !isPushSessionCurrent(session)) return;
      hasSnapshot = true;
      exists = snapshot.exists();
      checkRemoval();
    },
    () => {},
  );
  const unsubscribeConnected = onValue(
    ref(db, ".info/connected"),
    (snapshot) => {
      if (!active || !isPushSessionCurrent(session)) return;
      connected = snapshot.val() === true;
      checkRemoval();
    },
    () => {},
  );
  return () => {
    if (!active) return;
    active = false;
    detachDatabaseListeners(unsubscribeDevices, unsubscribeConnected);
  };
}

export async function addClip(
  content: string,
  type: ClipContentType,
  session: PushSession | null = currentSession(),
): Promise<void> {
  requireClipboardSession(session);
  validateEncryptedContent(content, type);
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) {
    throw new Error("No user is currently authenticated");
  }
  const userId = user.uid;
  const db = getRTDB();
  const deviceId = await getDeviceId();
  requireClipboardSession(session);
  // Create a properly typed clip object
  const clipData: ClipData = {
    id: Crypto.randomUUID(),
    content,
    type,
    timestamp: new Date().toISOString(),
    sourceDevice: getCurrentDeviceName(),
    sourceDeviceId: deviceId,
  };

  // Write data to the user's clipboard path
  const clipRef = ref(db, `${DB_PATHS.users}/${userId}/${DB_PATHS.clips}`);
  const newClipRef = push(clipRef);

  await set(newClipRef, clipData);
  requireClipboardSession(session);
}

export async function getClips(
  session: PushSession | null = currentSession(),
): Promise<Record<string, ClipData> | null> {
  requireSession(session);
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) {
    return null;
  }
  const userId = user.uid;
  // Get a reference to the Firebase Realtime Database
  const db = getRTDB();
  // Create a reference to the specific data path
  const cloudData = ref(db, `${DB_PATHS.users}/${userId}/${DB_PATHS.clips}`);

  // Fetch the data from Firebase
  const snapshot = await get(cloudData);
  requireSession(session);

  if (snapshot.exists()) {
    return parseClips(snapshot.val());
  } else {
    return null;
  }
}

/**
 * Live subscription to user clips in Firebase Realtime Database.
 * Returns an unsubscribe function.
 */
export function listenClips(
  onClipsChanged: (clips: Record<string, ClipData> | null) => void,
  onError?: (error: Error) => void,
): () => void {
  const auth = getAuth();
  const user = auth.currentUser;
  const session = user ? capturePushSession(user.uid) : null;
  let active = true;
  if (!user || !session) {
    onClipsChanged(null);
    return () => {};
  }
  const db = getRTDB();
  const clipsRef = ref(db, `${DB_PATHS.users}/${user.uid}/${DB_PATHS.clips}`);

  const unsubscribe = onValue(
    clipsRef,
    (snapshot) => {
      if (!active || !isPushSessionCurrent(session)) return;
      if (snapshot.exists()) {
        onClipsChanged(parseClips(snapshot.val()));
      } else {
        onClipsChanged(null);
      }
    },
    (error) => {
      if (!active || !isPushSessionCurrent(session)) return;
      console.error("Clips listener error:", error);
      if (onError) {
        onError(error);
      }
    },
  );

  return () => {
    if (!active) return;
    active = false;
    detachDatabaseListeners(unsubscribe);
  };
}

/**
 * Ensures the number of clips for a user stays below the maximum limit
 * by removing the oldest clips when necessary.
 */
export async function enforceClipLimit(
  session: PushSession | null = currentSession(),
): Promise<void> {
  const owner = requireClipboardSession(session);
  const clipsRef = ref(
    getRTDB(),
    `${DB_PATHS.users}/${owner.userId}/${DB_PATHS.clips}`,
  );
  // Order by timestamp to reliably get the oldest clips first
  await runTransaction(
    clipsRef,
    (current: Record<string, ClipData> | null) => {
      if (
        !isPushSessionCurrent(owner) ||
        !current ||
        typeof current !== "object"
      )
        return undefined;
      const keys = Object.keys(current);
      if (keys.length <= CLIPBOARD_CONFIG.maxClipCount) return undefined;
      // Find unpinned clips sorted by timestamp ascending
      const unpinned = Object.entries(current)
        .filter(([, clip]) => clip && !clip.pinned)
        .sort(
          (a, b) =>
            (new Date(a[1].timestamp).getTime() || 0) -
            (new Date(b[1].timestamp).getTime() || 0),
        );
      const next = { ...current };
      for (const [key] of unpinned.slice(
        0,
        keys.length - CLIPBOARD_CONFIG.maxClipCount,
      ))
        delete next[key];
      return next;
    },
    { applyLocally: false },
  );
  requireSession(owner);
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
  const session = requireSession(currentSession(), uid);
  validateKey(uid);
  if (!/^[0-9a-f]{32}$/i.test(salt) || !isEncryptedPayload(wrappedKey))
    throw new Error("Invalid encryption metadata");
  try {
    const db = getRTDB();
    const refPath = ref(db, `${DB_PATHS.users}/${uid}/encryption`);
    const metadata = { salt, wrappedKey, createdAt: new Date().toISOString() };
    const result = await runTransaction(
      refPath,
      () => {
        if (!isPushSessionCurrent(session)) return undefined;
        return metadata;
      },
      { applyLocally: false },
    );
    requireSession(session);
    if (!result.committed)
      throw new Error("Encryption metadata could not be saved");
    console.info("Encryption metadata saved to Firebase");
  } catch (error) {
    console.error("Failed to save encryption metadata", error);
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
  const session = requireSession(currentSession(), uid);
  validateKey(uid);
  try {
    const db = getRTDB();
    const refPath = ref(db, `${DB_PATHS.users}/${uid}/encryption`);
    const snapshot = await get(refPath);

    requireSession(session);
    if (snapshot.exists()) {
      const metadata = snapshot.val();
      if (
        !metadata ||
        typeof metadata.salt !== "string" ||
        !/^[0-9a-f]{32}$/i.test(metadata.salt) ||
        !isEncryptedPayload(metadata.wrappedKey)
      ) {
        throw new Error("Invalid encryption metadata");
      }
      return { salt: metadata.salt, wrappedKey: metadata.wrappedKey };
    }

    return null;
  } catch (error) {
    console.error("Failed to get encryption metadata", error);
    throw error;
  }
}

/**
 * Wipe all clips for a user.
 * Used during password resets when encryption keys become invalid.
 */
export async function wipeUserClips(userId: string): Promise<void> {
  requireSession(currentSession(), userId);
  validateKey(userId);
  try {
    const db = getRTDB();
    const clipsRef = ref(db, `${DB_PATHS.users}/${userId}/${DB_PATHS.clips}`);
    await remove(clipsRef);
    console.info("Successfully wiped all clips for user", { userId });
  } catch (error) {
    console.error("Failed to wipe user clips");
    throw error;
  }
}

/**
 * Wipe all devices for a user.
 * Used during password resets.
 */
export async function wipeUserDevices(userId: string): Promise<void> {
  requireSession(currentSession(), userId);
  validateKey(userId);
  try {
    const db = getRTDB();
    const devicesRef = ref(
      db,
      `${DB_PATHS.users}/${userId}/${DB_PATHS.devices}`,
    );
    await remove(devicesRef);
    console.info("Successfully wiped all devices for user", { userId });
  } catch (error) {
    console.error("Failed to wipe user devices");
    throw error;
  }
}

/**
 * Wipe encryption metadata for a user.
 * Used during password resets to force the generation of new keys.
 */
export async function wipeEncryptionMetadata(userId: string): Promise<void> {
  requireSession(currentSession(), userId);
  validateKey(userId);
  try {
    const db = getRTDB();
    const encryptionRef = ref(db, `${DB_PATHS.users}/${userId}/encryption`);
    await remove(encryptionRef);
    console.info("Successfully wiped encryption metadata for user", { userId });
  } catch (error) {
    console.error("Failed to wipe encryption metadata", error);
    throw error;
  }
}

export async function removeAllClips(
  session: PushSession | null = currentSession(),
): Promise<void> {
  requireClipboardSession(session);
  try {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
      throw new Error("No user is currently authenticated");
    }
    const userId = user.uid;
    console.debug("Removing unpinned clips from Firebase", { userId });
    // Get a reference to the Firebase Realtime Database
    const db = getRTDB();
    // Create a reference to the specific clip path
    const clipRef = ref(db, `${DB_PATHS.users}/${userId}/${DB_PATHS.clips}/`);

    // Fetch all clips first
    const snapshot = await get(clipRef);
    requireClipboardSession(session);
    if (!snapshot.exists()) {
      console.debug("No clips to remove");
      return;
    }

    const candidates = new Set(Object.keys(snapshot.val()));
    // Iterate through clips and identify unpinned ones
    // explicit check for pinned property
    // Mark for deletion
    // Perform atomic update to remove unpinned clips
    await runTransaction(
      clipRef,
      (current: Record<string, ClipData> | null) => {
        if (!session || !isPushSessionCurrent(session) || !current)
          return undefined;
        const next = { ...current };
        for (const key of candidates)
          if (next[key] && !next[key].pinned) delete next[key];
        return next;
      },
      { applyLocally: false },
    );
    requireClipboardSession(session);
  } catch (error) {
    console.error("Failed to remove clips from Firebase");
    throw error;
  }
}

export async function removeClip(
  clipId: string,
  session: PushSession | null = currentSession(),
): Promise<void> {
  requireClipboardSession(session);
  validateKey(clipId);
  try {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
      throw new Error("No user is currently authenticated");
    }
    const userId = user.uid;
    const db = getRTDB();
    const clipsRef = ref(db, `${DB_PATHS.users}/${userId}/${DB_PATHS.clips}`);

    // Find the clip by id field
    const clipQuery = query(clipsRef, orderByChild("id"), equalTo(clipId));
    const snapshot = await get(clipQuery);
    requireClipboardSession(session);

    if (snapshot.exists()) {
      const updates: Record<string, null> = {};
      for (const key of Object.keys(snapshot.val())) {
        updates[key] = null;
      }
      await update(clipsRef, updates);
    }
  } catch (error) {
    console.error("Failed to remove clip");
    throw error;
  }
}

export async function togglePinClip(
  clipId: string,
  pinned: boolean,
  session: PushSession | null = currentSession(),
): Promise<void> {
  requireClipboardSession(session);
  validateKey(clipId);
  try {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
      throw new Error("No user is currently authenticated");
    }
    const userId = user.uid;

    const db = getRTDB();
    const clipsRef = ref(db, `${DB_PATHS.users}/${userId}/${DB_PATHS.clips}`);

    // Find the clip by id field
    const clipQuery = query(clipsRef, orderByChild("id"), equalTo(clipId));
    const snapshot = await get(clipQuery);
    requireClipboardSession(session);

    if (snapshot.exists()) {
      const keys = Object.keys(snapshot.val());
      for (const key of keys) {
        const result = await runTransaction(
          ref(db, `${DB_PATHS.users}/${userId}/${DB_PATHS.clips}/${key}`),
          (current: ClipData | null) => {
            if (
              !session ||
              !isPushSessionCurrent(session) ||
              !current ||
              current.id !== clipId
            )
              return undefined;
            return { ...current, pinned };
          },
          { applyLocally: false },
        );
        requireClipboardSession(session);
        if (!result.committed)
          throw new Error("Clip not found or was removed.");
      }
    } else {
      console.warn("Clip not found for pin toggle", { userId, clipId });
      throw new Error("Clip not found or was removed.");
    }
  } catch (error) {
    console.error("Failed to toggle pin clip", error);
    throw error;
  }
}

export async function updateClip(
  clipId: string,
  session: PushSession | null = currentSession(),
): Promise<void> {
  requireClipboardSession(session);
  validateKey(clipId);
  try {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
      throw new Error("No user is currently authenticated");
    }
    const userId = user.uid;
    const db = getRTDB();
    const clipsRef = ref(db, `${DB_PATHS.users}/${userId}/${DB_PATHS.clips}`);

    // Find the clip by id field
    const clipQuery = query(clipsRef, orderByChild("id"), equalTo(clipId));
    const snapshot = await get(clipQuery);
    requireClipboardSession(session);

    if (snapshot.exists()) {
      const key = Object.keys(snapshot.val())[0];
      const deviceId = await getDeviceId();
      requireClipboardSession(session);
      const result = await runTransaction(
        ref(db, `${DB_PATHS.users}/${userId}/${DB_PATHS.clips}/${key}`),
        (current: ClipData | null) => {
          if (
            !session ||
            !isPushSessionCurrent(session) ||
            !current ||
            current.id !== clipId
          )
            return undefined;
          return {
            ...current,
            timestamp: new Date().toISOString(),
            sourceDevice: getCurrentDeviceName(),
            sourceDeviceId: deviceId,
          };
        },
        { applyLocally: false },
      );
      requireClipboardSession(session);
      if (!result.committed) throw new Error("Clip not found or was removed.");
    } else {
      console.warn(`Clip not found for update`, { userId, clipId });
      throw new Error("Clip not found.");
    }
  } catch (error) {
    console.error("Failed to update clip");
    throw error;
  }
}

/**
 * Update the content of an existing clip.
 * The content should already be encrypted before calling this function.
 */
export async function updateClipContent(
  clipId: string,
  content: string,
  type?: ClipContentType,
  session: PushSession | null = currentSession(),
): Promise<void> {
  requireClipboardSession(session);
  validateKey(clipId);
  validateEncryptedContent(content, type);
  try {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
      throw new Error("No user is currently authenticated");
    }
    const userId = user.uid;
    const db = getRTDB();
    const clipsRef = ref(db, `${DB_PATHS.users}/${userId}/${DB_PATHS.clips}`);

    // Find the clip by id field
    const clipQuery = query(clipsRef, orderByChild("id"), equalTo(clipId));
    const snapshot = await get(clipQuery);
    requireClipboardSession(session);

    if (snapshot.exists()) {
      const key = Object.keys(snapshot.val())[0];
      const deviceId = await getDeviceId();
      requireClipboardSession(session);
      const updates: Partial<ClipData> = {
        content,
        timestamp: new Date().toISOString(),
        sourceDevice: getCurrentDeviceName(),
        sourceDeviceId: deviceId,
      };
      if (type) {
        updates.type = type;
      }
      const expected = snapshot.val()[key] as ClipData;
      const result = await runTransaction(
        ref(db, `${DB_PATHS.users}/${userId}/${DB_PATHS.clips}/${key}`),
        (current: ClipData | null) => {
          if (
            !session ||
            !isPushSessionCurrent(session) ||
            !current ||
            current.id !== clipId ||
            current.content !== expected.content ||
            current.timestamp !== expected.timestamp
          )
            return undefined;
          return { ...current, ...updates };
        },
        { applyLocally: false },
      );
      requireClipboardSession(session);
      if (!result.committed)
        throw new Error(
          "Clip changed or was removed. Reload it before saving.",
        );
    } else {
      console.warn(`Clip not found for content update`, { userId, clipId });
      throw new Error("Clip not found or was removed.");
    }
  } catch (error) {
    console.error("Failed to update clip content", error);
    throw error;
  }
}
