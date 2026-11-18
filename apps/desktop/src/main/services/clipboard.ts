/**
 * Clipboard Synchronization Module
 *
 * This module manages bidirectional synchronization between the local clipboard
 * and Firebase, allowing clipboard content to be shared across devices.
 */

import os from "node:os";
import { CLIPBOARD_CONFIG } from "@viclip/constants";
import type {
  ClipboardConfig,
  ClipboardSyncState,
  ClipContentType,
  ClipData,
} from "@viclip/types";
import { clipboard } from "electron";
import log from "electron-log/main";
import { getAuth } from "firebase/auth";
import {
  clearCachedClips,
  getCachedClips,
  getMainWindow,
  getSettingsWindow,
  setCachedClips,
} from "../globalStates";
import { showNotification } from "../modules/notification";
import { detectClipboardType, isConcealedClipboard } from "../utils/utils";
import { getAuthGeneration } from "./auth";
import { decrypt, encrypt, getActiveDEK, isKeyLoaded } from "./crypto";
import {
  addClip,
  enforceClipLimit,
  getClips,
  listenClips,
  updateClip,
} from "./firebase";
import { settingsStorage } from "./settings";

// Configuration constants
const SYNC_CONFIG: ClipboardConfig = {
  syncIntervalMs: CLIPBOARD_CONFIG.syncIntervalMs, // How often to check for clipboard changes
  updateCooldownMs: 2000, // Delay to prevent rapid consecutive updates (must exceed syncIntervalMs)
  maxContentLength: CLIPBOARD_CONFIG.maxContentLength, // Maximum content length for clipboard data
};

// State variables with typed interface
const syncState: ClipboardSyncState = {
  isActive: false,
  isUpdatingFromFirebase: false,
  isFirebaseUpdating: false,
};

// Additional typed state variables
let clipboardInterval: NodeJS.Timeout | null = null;
let unsubscribeFirebase: (() => void) | null = null;
let lastText = "";
let clipboardWriteRevision = 0;
let syncGeneration = 0;
interface SyncSession {
  userId: string;
  authGeneration: number;
  generation: number;
  retentionPending: boolean;
}
let session: SyncSession | null = null;
let polling = false;
let writing: Promise<void> = Promise.resolve();
let pendingRemote: ClipData | null = null;
let remoteRevision = 0;
let lastProcessedClipId: string | null = null;
let lastProcessedTimestamp: string | null = null;
let newestProcessedTime = -Infinity;
const cooldownTimers = new Set<ReturnType<typeof setTimeout>>();
const textTypes = new Set<ClipContentType>([
  "text",
  "url",
  "text-formatted",
  "email",
  "color",
]);
const allTypes = new Set<ClipContentType>([
  ...textTypes,
  "document",
  "spreadsheet",
  "presentation",
  "unknown",
]);

function isCurrentSession(current: SyncSession): boolean {
  return (
    session === current &&
    syncState.isActive &&
    current.generation === syncGeneration &&
    current.authGeneration === getAuthGeneration() &&
    getAuth().currentUser?.uid === current.userId &&
    isKeyLoaded(current.userId)
  );
}

function scheduleCooldown(current: SyncSession, callback: () => void): void {
  const timer = setTimeout(() => {
    cooldownTimers.delete(timer);
    if (isCurrentSession(current)) callback();
  }, SYNC_CONFIG.updateCooldownMs);
  cooldownTimers.add(timer);
}

/**
 * Writes content to the clipboard and updates the local state
 * to prevent the watcher from treating it as a new external change.
 */
export function writeToClipboard(content: string): Promise<void> {
  return queueClipboardWrite(content);
}

function queueClipboardWrite(
  content: string,
  isCurrentRequest: () => boolean = () => true,
): Promise<void> {
  if (
    typeof content !== "string" ||
    content.length > SYNC_CONFIG.maxContentLength
  ) {
    return Promise.reject(new Error("Invalid clipboard content."));
  }
  const generation = syncGeneration;
  const authGeneration = getAuthGeneration();
  const userId = getAuth().currentUser?.uid;
  const operation = writing
    .catch(() => undefined)
    .then(async () => {
      if (
        generation !== syncGeneration ||
        authGeneration !== getAuthGeneration() ||
        getAuth().currentUser?.uid !== userId ||
        !isCurrentRequest()
      )
        throw new Error("Clipboard session changed.");
      // Programmatic writes are serialized; update the feedback sentinel only after native success.
      await clipboard.writeText(content);
      if (
        generation === syncGeneration &&
        authGeneration === getAuthGeneration() &&
        getAuth().currentUser?.uid === userId
      ) {
        lastText = content;
        clipboardWriteRevision++;
      }
      log.debug(
        "Programmatically wrote to clipboard, updated lastText to prevent loop",
      );
    });
  writing = operation;
  return operation;
}

function validateClips(value: unknown): Record<string, ClipData> {
  const validated: Record<string, ClipData> = {};
  if (!value || typeof value !== "object" || Array.isArray(value))
    return validated;
  for (const [key, valueClip] of Object.entries(value)) {
    if (!valueClip || typeof valueClip !== "object" || Array.isArray(valueClip))
      continue;
    const clip = valueClip as ClipData;
    if (
      key.length > 256 ||
      /[.#$[\]/]/.test(key) ||
      key === "__proto__" ||
      typeof clip.id !== "string" ||
      !clip.id ||
      clip.id.length > 256 ||
      /[.#$[\]/]/.test(clip.id) ||
      Array.from(clip.id).some(
        (character) =>
          character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
      ) ||
      typeof clip.content !== "string" ||
      clip.content.length > SYNC_CONFIG.maxContentLength * 8 + 58 ||
      !allTypes.has(clip.type) ||
      typeof clip.timestamp !== "string" ||
      clip.timestamp.length > 64 ||
      !Number.isFinite(Date.parse(clip.timestamp)) ||
      typeof clip.sourceDevice !== "string" ||
      clip.sourceDevice.length > 256 ||
      (clip.sourceDeviceId !== undefined &&
        (typeof clip.sourceDeviceId !== "string" ||
          clip.sourceDeviceId.length > 256)) ||
      (clip.pinned !== undefined && typeof clip.pinned !== "boolean")
    )
      continue;
    validated[key] = { ...clip };
  }
  return validated;
}

function sendSyncState(active: boolean): void {
  for (const window of [getMainWindow(), getSettingsWindow()]) {
    if (window && !window.isDestroyed())
      window.webContents.send("sync-state-changed", active);
  }
}

function sendClipsToRenderer(clips: Record<string, ClipData>): void {
  setCachedClips(clips);
  const mainWindow = getMainWindow();
  if (mainWindow && !mainWindow.isDestroyed())
    mainWindow.webContents.send("clips-updated", clips);
}

function isOlderThanProcessed(clip: ClipData): boolean {
  const time = Date.parse(clip.timestamp);
  return (
    time < newestProcessedTime ||
    (time === newestProcessedTime &&
      lastProcessedClipId !== null &&
      clip.id.localeCompare(lastProcessedClipId) < 0)
  );
}

function markProcessed(clip: ClipData): void {
  lastProcessedClipId = clip.id;
  lastProcessedTimestamp = clip.timestamp;
  newestProcessedTime = Math.max(
    newestProcessedTime,
    Date.parse(clip.timestamp),
  );
}

async function applyPendingRemote(current: SyncSession): Promise<void> {
  if (
    !isCurrentSession(current) ||
    syncState.isFirebaseUpdating ||
    syncState.isUpdatingFromFirebase ||
    polling ||
    !pendingRemote
  )
    return;
  const newest = pendingRemote;
  const revision = remoteRevision;
  pendingRemote = null;

  // Skip if we already processed this exact clip update (same ID and timestamp)
  if (
    (newest.id === lastProcessedClipId &&
      newest.timestamp === lastProcessedTimestamp) ||
    isOlderThanProcessed(newest)
  )
    return;

  // Skip if this device was the source — no need to write our own
  // clip back to ourselves, that would trigger the local watcher.
  const currentDeviceId = settingsStorage.getOrCreateDeviceId();
  const isFromCurrentDevice =
    (newest.sourceDeviceId && newest.sourceDeviceId === currentDeviceId) ||
    (!newest.sourceDeviceId && newest.sourceDevice === os.hostname());
  if (isFromCurrentDevice) {
    markProcessed(newest);
    return;
  }

  // DECRYPTION START
  let decryptedContent: string;
  try {
    decryptedContent = decrypt(newest.content, getActiveDEK(current.userId));
    if (
      !decryptedContent ||
      decryptedContent.length > SYNC_CONFIG.maxContentLength ||
      !textTypes.has(newest.type)
    ) {
      markProcessed(newest);
      return;
    }
    log.debug("Incoming content decrypted successfully");
  } catch {
    // Decryption failed (possibly legacy plaintext): fail closed for all invalid payloads.
    log.warn("Skipping clipboard write: incoming clip failed decryption");
    markProcessed(newest);
    return;
  }
  // DECRYPTION END

  if (!isCurrentSession(current)) return;
  if (decryptedContent === lastText) {
    markProcessed(newest);
    return;
  }
  try {
    log.debug("New clip data received from Firebase", {
      contentLength: newest.content.length,
      type: newest.type,
      sourceDevice: newest.sourceDevice,
    });
    // Write to local clipboard with loop-prevention
    syncState.isUpdatingFromFirebase = true;
    await queueClipboardWrite(
      decryptedContent,
      () => revision === remoteRevision,
    ); // updates lastText atomically
    if (!isCurrentSession(current)) return;
    markProcessed(newest);
    showNotification(
      "Clipboard Sync",
      `New clip received from ${newest.sourceDevice}`,
    );
  } catch {
    log.warn("Failed to write incoming clipboard content");
    if (
      isCurrentSession(current) &&
      revision === remoteRevision &&
      !pendingRemote
    )
      pendingRemote = newest;
  } finally {
    if (isCurrentSession(current)) {
      scheduleCooldown(current, () => {
        syncState.isUpdatingFromFirebase = false;
        void applyPendingRemote(current);
      });
    }
  }
}

async function pollClipboard(current: SyncSession): Promise<void> {
  if (
    !isCurrentSession(current) ||
    polling ||
    syncState.isUpdatingFromFirebase ||
    syncState.isFirebaseUpdating
  )
    return;
  polling = true;
  try {
    if (current.retentionPending) {
      try {
        await enforceClipLimit(current.userId);
        if (!isCurrentSession(current)) return;
        current.retentionPending = false;
      } catch {
        log.warn("Failed to retry clipboard history retention");
      }
      if (!isCurrentSession(current)) return;
    }
    const writeRevision = clipboardWriteRevision;
    const items = await clipboard.read();
    if (!isCurrentSession(current)) return;
    const allFormats = (items || [])
      .flatMap((item) => item?.types || [])
      .map((format) =>
        format.replace(
          /^electron application\/osclipboard;format="([^"]+)"$/,
          "$1",
        ),
      );
    if (isConcealedClipboard(allFormats)) {
      log.debug(
        "Concealed or password-manager content detected, skipping sync",
      );
      return;
    }
    // Use the inspected ClipboardItem snapshot; a separate readText could read a newly concealed clipboard.
    const textItem = items.find((item) => item.types.includes("text/plain"));
    if (!textItem) return;
    const textBlob = await textItem.getType("text/plain");
    if (!isCurrentSession(current)) return;
    if (textBlob.size > SYNC_CONFIG.maxContentLength * 4) {
      log.warn("Clipboard text exceeds the byte limit");
      return;
    }
    const currentText = await textBlob.text();
    if (!isCurrentSession(current)) return;
    const formats = ["text/html", "text/rtf", "text/uri-list"].filter(
      (format) => allFormats.includes(format),
    );

    // Skip processing if content hasn't changed or is empty
    if (!currentText || currentText === lastText) return;

    // Determine content type
    const contentType = detectClipboardType(currentText, formats);
    if (!textTypes.has(contentType)) {
      log.debug(`Ignoring clipboard content of type: ${contentType}`);
      return;
    }
    // Check content length to avoid excessive data transfers
    if (currentText.length > SYNC_CONFIG.maxContentLength) {
      log.warn("Content exceeds maximum size limit, skipping sync", {
        contentLength: currentText.length,
        maxLength: SYNC_CONFIG.maxContentLength,
      });
      showNotification(
        "Clipboard Sync Warning",
        `Content length (${currentText.length} chars) exceeds the limit of ${SYNC_CONFIG.maxContentLength}.`,
      );
      if (writeRevision === clipboardWriteRevision) lastText = currentText;
      return;
    }
    log.debug("Local clipboard changed, sending to Firebase", {
      contentType,
      contentLength: currentText.length,
    });
    // Set flags to prevent update loops
    syncState.isFirebaseUpdating = true;

    // ENCRYPTION START
    let contentToSend: string;
    try {
      if (!isKeyLoaded(current.userId)) {
        // In strict Zero-Trust, we should NOT upload if key is missing
        // But for robustness, we might retry or fail
        throw new Error("Encryption key not loaded. Cannot sync securely.");
      }
      const dek = getActiveDEK(current.userId);
      // Encrypt content before upload
      contentToSend = encrypt(currentText, dek);
      log.debug("Content encrypted successfully before upload");
    } catch {
      log.warn("Encryption failed, aborting sync");
      return;
    }
    // ENCRYPTION END

    // Check for duplicates in cached clips
    const cachedClips = getCachedClips();
    const existingClip = Object.values(cachedClips).find(
      (clip) => clip.content === currentText && clip.type === contentType,
    );
    if (!isCurrentSession(current)) return;
    if (existingClip) {
      log.debug("Duplicate clip found, updating timestamp");
      await updateClip(current.userId, existingClip.id, {
        timestamp: new Date().toISOString(),
        sourceDevice: os.hostname(),
        sourceDeviceId: settingsStorage.getOrCreateDeviceId(),
      });
    } else {
      // Send to Firebase with error handling
      await addClip(current.userId, contentToSend, contentType);
    }
    if (!isCurrentSession(current)) return;
    if (writeRevision === clipboardWriteRevision) lastText = currentText;
    // Enforce clip limit first — only after successful persistence, so a failed upload never deletes history.
    current.retentionPending = true;
    await enforceClipLimit(current.userId);
    if (!isCurrentSession(current)) return;
    current.retentionPending = false;
    log.debug("Data sync completed successfully");
  } catch {
    log.warn("Error syncing clipboard to Firebase");
  } finally {
    if (isCurrentSession(current)) {
      polling = false;
      // Reset flag after short delay
      if (syncState.isFirebaseUpdating) {
        scheduleCooldown(current, () => {
          syncState.isFirebaseUpdating = false;
          void applyPendingRemote(current);
        });
      } else {
        void applyPendingRemote(current);
      }
    }
  }
}

async function startWatchers(current: SyncSession): Promise<void> {
  let initialText = "";
  const writeRevision = clipboardWriteRevision;
  try {
    initialText = await clipboard.readText();
  } catch {
    log.warn("Failed initial clipboard read");
  }
  if (!isCurrentSession(current)) return;
  if (writeRevision === clipboardWriteRevision) lastText = initialText;
  log.debug("Starting clipboard watchers", { userId: current.userId });

  // Monitor local clipboard changes to send to Firebase
  clipboardInterval = setInterval(() => {
    void pollClipboard(current);
  }, SYNC_CONFIG.syncIntervalMs);

  // Subscribe to remote clipboard changes from Firebase
  try {
    const unsubscribe = listenClips(
      current.userId,
      (clips) => {
        try {
          if (!isCurrentSession(current)) return;
          remoteRevision++;
          const validated = validateClips(clips);
          const decryptedClips = decryptClips(validated, current.userId);
          sendClipsToRenderer(decryptedClips);
          const clipArray = Object.values(validated);
          if (clipArray.length === 0) {
            pendingRemote = null;
            return;
          }
          // Sort by timestamp descending to find the true newest clip,
          // regardless of Firebase object key ordering.
          const getClipTime = (c?: ClipData): number =>
            c ? Date.parse(c.timestamp) : 0;
          const newest = clipArray.sort(
            (a, b) =>
              getClipTime(b) - getClipTime(a) || b.id.localeCompare(a.id),
          )[0];
          if (isOlderThanProcessed(newest)) {
            pendingRemote = null;
            return;
          }
          // Each event is a full snapshot: reconcile queued data so deletions cannot be pasted later.
          pendingRemote = newest;
          void applyPendingRemote(current);
        } catch {
          log.warn("Error processing incoming clipboard data");
        }
      },
      () => {
        if (!isCurrentSession(current)) return;
        stopWatchers();
        sendClipsToRenderer({});
        showNotification(
          "Clipboard Sync",
          "Synchronization stopped. Re-enable sync or sign in again to reconnect.",
        );
      },
    );
    if (isCurrentSession(current)) unsubscribeFirebase = unsubscribe;
    else unsubscribe();
  } catch {
    log.warn("Failed to subscribe to remote clipboard changes");
    if (isCurrentSession(current)) {
      stopWatchers();
      sendClipsToRenderer({});
      showNotification(
        "Clipboard Sync",
        "Unable to start synchronization. Please try again.",
      );
    }
  }
}

/**
 * Stops all clipboard and Firebase watchers.
 * Called when user logs out or app is shutting down.
 */
function stopWatchers(): void {
  log.debug("Stopping clipboard watchers");
  syncGeneration++;
  session = null;

  // Clear clipboard polling interval
  if (clipboardInterval) {
    clearInterval(clipboardInterval);
    clipboardInterval = null;
  }

  // Unsubscribe from Firebase realtime updates
  if (unsubscribeFirebase) {
    const unsubscribe = unsubscribeFirebase;
    unsubscribeFirebase = null;
    try {
      unsubscribe();
    } catch {
      log.warn("Failed to unsubscribe clipboard listener");
    }
  }
  for (const timer of cooldownTimers) clearTimeout(timer);
  cooldownTimers.clear();

  // Reset state and purge in-memory clipboard cache
  syncState.isActive = false;
  syncState.isUpdatingFromFirebase = false;
  syncState.isFirebaseUpdating = false;
  polling = false;
  pendingRemote = null;
  remoteRevision = 0;
  lastProcessedClipId = null;
  lastProcessedTimestamp = null;
  newestProcessedTime = -Infinity;
  lastText = "";
  clearCachedClips();
  sendSyncState(false);
}

/**
 * Starts the clipboard synchronization process.
 * Should be called when the application is ready.
 * @returns {boolean} Success status of the operation
 */
export function startClipboardSync(): boolean {
  try {
    if (session && isCurrentSession(session)) {
      log.debug("Clipboard sync already active");
      return true;
    }
    stopWatchers();
    const user = getAuth().currentUser;
    if (!user || !isKeyLoaded(user.uid)) {
      log.info("No user logged in, clipboard sync not started");
      return false;
    }
    log.info("Starting clipboard sync for user", { userId: user.uid });
    session = {
      userId: user.uid,
      authGeneration: getAuthGeneration(),
      generation: syncGeneration,
      retentionPending: false,
    };
    syncState.isActive = true;
    sendSyncState(true);
    void startWatchers(session).catch(() => {
      log.warn("Failed to start clipboard sync");
      stopWatchers();
    });
    return true;
  } catch {
    log.warn("Failed to start clipboard sync");
    stopWatchers();
    return false;
  }
}

/**
 * Performs cleanup when the application is shutting down.
 * Should be called during app quit process.
 */
export function stopClipboardSync(): void {
  stopWatchers();
}

/**
 * Checks if clipboard sync is currently active
 * @returns {boolean} Current sync status
 */
export function isClipboardSyncActive(): boolean {
  return !!session && isCurrentSession(session);
}
/**
 * Decrypts a record of clips.
 * Useful for processing batch data from Firebase.
 */
function decryptClips(
  clips: unknown,
  userId: string,
): Record<string, ClipData> {
  if (!isKeyLoaded(userId)) {
    log.warn("Cannot decrypt clips: Encryption key not loaded");
    // Return encrypted clips if key is missing (or handle differently?)
    // Fail closed: no ciphertext or legacy plaintext is exposed to the renderer.
    return {};
  }
  const dek = getActiveDEK(userId);
  const decryptedClips: Record<string, ClipData> = {};
  for (const [key, clip] of Object.entries(validateClips(clips))) {
    // deep copy the clip object
    const newClip = { ...clip };
    try {
      newClip.content = decrypt(clip.content, dek);
      if (newClip.content.length > SYNC_CONFIG.maxContentLength) continue;
      decryptedClips[key] = newClip;
    } catch {
      log.warn("Failed to decrypt clip");
      // If content was formatted as iv:authTag:ciphertext but decryption failed,
      // prevent leaking unreadable ciphertext to the UI
      // All invalid clips are omitted so they cannot be copied or edited as placeholder text.
    }
  }
  return decryptedClips;
}

/**
 * Fetches clips from Firebase and ensures they are decrypted.
 */
export async function getDecryptedClips(): Promise<Record<
  string,
  ClipData
> | null> {
  const user = getAuth().currentUser;
  const generation = getAuthGeneration();
  if (!user || !isKeyLoaded(user.uid))
    throw new Error("Authenticated encryption session required.");
  const clips = await getClips();
  if (
    generation !== getAuthGeneration() ||
    getAuth().currentUser?.uid !== user.uid ||
    !isKeyLoaded(user.uid)
  ) {
    throw new Error("Account changed while fetching clips.");
  }
  if (!clips) return null;
  return decryptClips(clips, user.uid);
}
