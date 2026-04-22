/**
 * Clipboard Synchronization Module
 *
 * This module manages bidirectional synchronization between the local clipboard
 * and Firebase, allowing clipboard content to be shared across devices.
 */

import os from "node:os";
import type {
  ClipboardConfig,
  ClipboardSyncState,
  ClipData,
} from "@shared/types/clipboard";
import { clipboard, dialog } from "electron";
import log from "electron-log/main";
import { getAuth } from "firebase/auth";
import { getCachedClips, getMainWindow, setCachedClips } from "../globalStates";
import { showNotification } from "../modules/notification";
import { detectClipboardType } from "../utils/utils";
import { decrypt, encrypt, getActiveDEK, isKeyLoaded } from "./crypto";
import {
  addClip,
  enforceClipLimit,
  getClips,
  listenClips,
  updateClip,
} from "./firebase";

// Configuration constants
const SYNC_CONFIG: ClipboardConfig = {
  syncIntervalMs: 1000, // How often to check for clipboard changes
  updateCooldownMs: 2000, // Delay to prevent rapid consecutive updates (must exceed syncIntervalMs)
  maxContentLength: 10000, // Maximum content length for clipboard data
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

/**
 * Writes content to the clipboard and updates the local state
 * to prevent the watcher from treating it as a new external change.
 */
export function writeToClipboard(content: string): void {
  clipboard.writeText(content);
  lastText = content;
  log.debug(
    "Programmatically wrote to clipboard, updated lastText to prevent loop",
  );
}

function startWatchers(userId: string): void {
  lastText = clipboard.readText();
  // const lastImage = clipboard.readImage(); // TODO: Image logic paused
  log.debug("Starting clipboard watchers", { userId });

  // Monitor local clipboard changes to send to Firebase
  clipboardInterval = setInterval(() => {
    try {
      if (!syncState.isUpdatingFromFirebase) {
        const currentText = clipboard.readText();
        const formats = clipboard.availableFormats();

        // Skip processing if content hasn't changed
        if (currentText === lastText) return;

        // Determine content type
        const contentType = detectClipboardType(currentText, formats);

        if (
          contentType === "text" ||
          contentType === "url" ||
          contentType === "text-formatted" ||
          contentType === "email" ||
          contentType === "color"
        ) {
          // Check content length to avoid excessive data transfers
          if (currentText.length > SYNC_CONFIG.maxContentLength) {
            log.warn("Content exceeds maximum size limit, skipping sync", {
              contentLength: currentText.length,
              maxLength: SYNC_CONFIG.maxContentLength,
            });
            dialog.showMessageBox({
              type: "warning",
              title: "Clipboard Sync Warning",
              message: "Clipboard content is too large to sync.",
              detail: `The content length is ${currentText.length} characters, which exceeds the limit of ${SYNC_CONFIG.maxContentLength} characters.`,
            });
            lastText = currentText;
            return;
          }

          log.debug(`Local clipboard changed, sending to Firebase`, {
            contentType,
            contentLength: currentText.length,
          });

          // Set flags to prevent update loops
          syncState.isFirebaseUpdating = true;
          lastText = currentText;

          // Enforce clip limit first
          (async () => {
            try {
              await enforceClipLimit(userId);

              // ENCRYPTION START
              let contentToSend = currentText;
              try {
                if (isKeyLoaded()) {
                  const dek = getActiveDEK();
                  // Encrypt content before upload
                  contentToSend = encrypt(currentText, dek);
                  log.debug("Content encrypted successfully before upload");
                } else {
                  // In strict Zero-Trust, we should NOT upload if key is missing
                  // But for robustness, we might retry or fail
                  throw new Error(
                    "Encryption key not loaded. Cannot sync securely.",
                  );
                }
              } catch (cryptoError) {
                log.error("Encryption failed, aborting sync", cryptoError);
                return;
              }

              // ENCRYPTION END

              // Check for duplicates in cached clips
              const cachedClips = getCachedClips();
              let duplicateClipId: string | null = null;

              if (cachedClips) {
                const existingClip = Object.values(cachedClips).find(
                  (clip: ClipData) =>
                    clip.content === currentText && clip.type === contentType,
                );
                if (existingClip) {
                  duplicateClipId = existingClip.id;
                }
              }

              if (duplicateClipId) {
                log.debug("Duplicate clip found, updating timestamp");

                await updateClip(userId, duplicateClipId, {
                  timestamp: new Date().toISOString(),
                  sourceDevice: os.hostname(),
                });
              } else {
                // Send to Firebase with error handling
                await addClip(userId, contentToSend, contentType);
              }
              log.debug("Data sync completed successfully");
            } catch (error) {
              log.error("Error syncing clipboard to Firebase", error);
            } finally {
              // Reset flag after short delay
              setTimeout(() => {
                syncState.isFirebaseUpdating = false;
              }, SYNC_CONFIG.updateCooldownMs);
            }
          })();
        }
        // else if (contentType === "image" || contentType === "document" || contentType === "spreadsheet" || contentType === "presentation") {
        // 	// Compare images by PNG data URL
        // 	const lastImageData = lastImage.toDataURL();
        // 	const currentImageData = currentImage.toDataURL();
        // 	if (currentImageData === lastImageData) return;

        // 	// Encrypt image buffer before upload
        // 	const pngBuffer = currentImage.toPNG();
        // 	const encryptedImageBase64 = encryptImageBuffer(pngBuffer);

        // 	// Upload encrypted image to Firebase Storage
        // 	uploadEncryptedImage(userId, encryptedImageBase64)
        // 		.then(async (downloadUrl: string) => {
        // 			log.debug("Encrypted image uploaded. Download URL:", downloadUrl);
        // 			// Store image metadata in Realtime Database
        // 			await addClip(userId, downloadUrl, "image");
        // 			log.debug("Image metadata synced to Realtime Database");
        // 		})
        // 		.catch((err: any) => {
        // 			log.error("Failed to upload encrypted image", err);
        // 		});
        // 	lastImage = currentImage;
        // }
        else {
          log.debug(`Ignoring clipboard content of type: ${contentType}`);
        }
      }
    } catch (error) {
      log.error("Error processing clipboard changes", error);
    }
  }, SYNC_CONFIG.syncIntervalMs);

  // Subscribe to remote clipboard changes from Firebase
  try {
    let lastProcessedClipId: string | null = null;

    unsubscribeFirebase = listenClips(userId, (clips) => {
      try {
        const decryptedClips = decryptClips(clips);
        setCachedClips(decryptedClips);
        getMainWindow()?.webContents.send("clips-updated", decryptedClips);

        const clipArray = Object.values(clips);
        if (clipArray.length === 0) return;

        // Sort by timestamp descending to find the true newest clip,
        // regardless of Firebase object key ordering.
        const newest = clipArray.sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        )[0];

        // Skip if we already processed this exact clip id (e.g. a
        // timestamp-only updateClip fired the listener again).
        if (newest.id === lastProcessedClipId) return;

        // Skip if this device was the source — no need to write our own
        // clip back to ourselves, that would trigger the local watcher.
        if (newest.sourceDevice === os.hostname()) {
          lastProcessedClipId = newest.id;
          return;
        }

        // DECRYPTION START
        let decryptedContent = newest.content;
        try {
          if (isKeyLoaded()) {
            decryptedContent = decrypt(newest.content, getActiveDEK());
            log.debug("Incoming content decrypted successfully");
          } else {
            log.warn(
              "Encryption key not loaded while receiving data. Content may remain encrypted.",
            );
          }
        } catch (err) {
          log.warn("Decryption failed (possibly legacy plaintext):", err);
        }
        // DECRYPTION END

        if (decryptedContent !== lastText && !syncState.isFirebaseUpdating) {
          lastProcessedClipId = newest.id;

          log.debug("New clip data received from Firebase", {
            contentLength: newest.content?.length || 0,
            type: newest.type,
            sourceDevice: newest.sourceDevice,
          });

          if (newest.type === "image") {
            // Image logic skipped for now
          } else {
            showNotification(
              "Clipboard Sync",
              `New clip received from ${newest.sourceDevice}`,
            );
            // Write to local clipboard with loop-prevention
            syncState.isUpdatingFromFirebase = true;
            writeToClipboard(decryptedContent); // updates lastText atomically
            setTimeout(() => {
              syncState.isUpdatingFromFirebase = false;
            }, SYNC_CONFIG.updateCooldownMs);
          }
        }
      } catch (error) {
        log.error("Error processing incoming clipboard data", error);
      }
    });
  } catch (error) {
    log.error("Failed to subscribe to remote clipboard changes", error);
    unsubscribeFirebase = null;
  }
}

/**
 * Stops all clipboard and Firebase watchers.
 * Called when user logs out or app is shutting down.
 */
function stopWatchers(): void {
  log.debug("Stopping clipboard watchers");

  // Clear clipboard polling interval
  if (clipboardInterval) {
    clearInterval(clipboardInterval);
    clipboardInterval = null;
  }

  // Unsubscribe from Firebase realtime updates
  if (unsubscribeFirebase) {
    unsubscribeFirebase();
    unsubscribeFirebase = null;
  }

  // Reset state
  syncState.isActive = false;
  syncState.isUpdatingFromFirebase = false;
  syncState.isFirebaseUpdating = false;
}

/**
 * Starts the clipboard synchronization process.
 * Should be called when the application is ready.
 * @returns {boolean} Success status of the operation
 */
export function startClipboardSync(): boolean {
  try {
    if (syncState.isActive) {
      log.debug("Clipboard sync already active");
      return true;
    }

    const auth = getAuth();
    const user = auth.currentUser;
    if (user) {
      log.info("Starting clipboard sync for user", { userId: user.uid });
      startWatchers(user.uid);
      syncState.isActive = true;
      return true;
    } else {
      log.info("No user logged in, clipboard sync not started");
      return false;
    }
  } catch (error) {
    log.error("Failed to start clipboard sync", error);
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
  return syncState.isActive;
}
/**
 * Decrypts a record of clips.
 * Useful for processing batch data from Firebase.
 */
function decryptClips(
  clips: Record<string, ClipData>,
): Record<string, ClipData> {
  if (!isKeyLoaded()) {
    log.warn("Cannot decrypt clips: Encryption key not loaded");
    return clips; // Return encrypted clips if key is missing (or handle differently?)
  }

  const dek = getActiveDEK();
  const decryptedClips: Record<string, ClipData> = {};

  for (const [key, clip] of Object.entries(clips)) {
    // deep copy the clip object
    const newClip = { ...clip };
    try {
      if (clip.content) {
        newClip.content = decrypt(clip.content, dek);
      }
    } catch (error) {
      log.warn(`Failed to decrypt clip ${key}:`, error);
      // Keep original content (might be plaintext legacy data)
    }
    decryptedClips[key] = newClip;
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
  const clips = await getClips();
  if (!clips) return null;

  return decryptClips(clips);
}
