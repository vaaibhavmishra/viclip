import { getAuth } from "@react-native-firebase/auth";
import { CLIPBOARD_CONFIG } from "@viclip/constants";
import type { ClipContentType, ClipData } from "@viclip/types";
import { isEncryptedPayload } from "@viclip/utils";
import * as Clipboard from "expo-clipboard";
import { AppState } from "react-native";
import { decrypt, encrypt, getActiveDEK, isKeyLoaded } from "./crypto";
import {
  addClip,
  enforceClipLimit,
  getClips,
  updateClip,
  updateClipContent,
} from "./firebase";
import {
  capturePushSession,
  isPushSessionCurrent,
  type PushSession,
} from "./pushSession";

const contentTypes = new Set<ClipContentType>([
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
const sendQueues = new WeakMap<PushSession, Promise<void>>();
let clipboardWriteQueue: Promise<void> = Promise.resolve();

function requireSession(session?: PushSession | null): PushSession {
  const current =
    session === undefined
      ? capturePushSession(getAuth().currentUser?.uid || "")
      : session;
  if (!current || !isPushSessionCurrent(current)) {
    throw new Error("ERR_SESSION_CHANGED: Please log in again.");
  }
  return current;
}

function validateContent(content: string, type?: ClipContentType): void {
  if (typeof content !== "string" || content.length === 0) {
    throw new Error("Clipboard content is empty or invalid.");
  }
  if (content.length > CLIPBOARD_CONFIG.maxContentLength) {
    throw new Error(
      `Content exceeds maximum allowed length of ${CLIPBOARD_CONFIG.maxContentLength} characters.`,
    );
  }
  if (type !== undefined && !contentTypes.has(type)) {
    throw new Error("Unsupported clipboard content type.");
  }
}

/** Serialize native clipboard writes across manual receive, copy and notifications. */
export function writeClipToClipboard(
  content: string,
  session: PushSession | null,
  isAllowed: () => boolean = () => true,
): Promise<void> {
  const operation = clipboardWriteQueue
    .catch(() => {})
    .then(async () => {
      requireSession(session);
      if (
        !isAllowed() ||
        AppState.currentState !== "active" ||
        !isKeyLoaded()
      ) {
        throw new Error("ERR_SESSION_CHANGED: Clipboard copy is unavailable.");
      }
      validateContent(content);
      await Clipboard.setStringAsync(content);
      requireSession(session);
      if (!isAllowed() || AppState.currentState !== "active") {
        throw new Error("ERR_SESSION_CHANGED: Clipboard copy was interrupted.");
      }
    });
  clipboardWriteQueue = operation;
  return operation;
}

export function sendClip(
  clipboard: string,
  contentType: ClipContentType,
  _knownClips?: ClipData[],
  expectedSession?: PushSession | null,
): Promise<void> {
  let session: PushSession;
  try {
    session = requireSession(expectedSession);
    validateContent(clipboard, contentType);
    if (!contentTypes.has(contentType))
      throw new Error("Unsupported clipboard content type.");
  } catch (error) {
    return Promise.reject(error);
  }
  // Serialize sends so rapid taps and repeated shares use the latest remote history.
  const operation = (sendQueues.get(session) ?? Promise.resolve())
    .catch(() => {})
    .then(() => sendClipForSession(clipboard, contentType, session));
  sendQueues.set(session, operation);
  const release = () => {
    if (sendQueues.get(session) === operation) sendQueues.delete(session);
  };
  void operation.then(release, release);
  return operation;
}

async function sendClipForSession(
  clipboard: string,
  contentType: ClipContentType,
  session: PushSession,
): Promise<void> {
  requireSession(session);

  let contentToSend = clipboard;
  try {
    if (isKeyLoaded()) {
      const dek = getActiveDEK();
      // Encrypt content before upload
      contentToSend = encrypt(clipboard, dek);
      console.debug("Content encrypted successfully before upload");
    } else {
      // In strict Zero-Trust, we should NOT upload if key is missing
      // But for robustness, we might retry or fail
      throw new Error("Encryption key not loaded. Cannot sync securely.");
    }
  } catch (cryptoError) {
    console.error("Encryption failed, aborting sync");
    throw cryptoError;
  }

  let duplicateClipId: string | null = null;

  try {
    const remote = await getClips(session);
    requireSession(session);
    const candidateClips = Object.values(decryptClips(remote));

    // Native clipboard formats can give identical text different types across devices.
    const existingClip = candidateClips.find(
      (clip: ClipData) => !clip.decryptionFailed && clip.content === clipboard,
    );
    if (existingClip) {
      duplicateClipId = existingClip.id;
    }
  } catch (error) {
    console.warn("Failed to check duplicate clips");
    throw error;
  }

  if (duplicateClipId) {
    console.debug("Duplicate clip found, updating timestamp");
    await updateClip(duplicateClipId, session);
  } else {
    // Enforce clip history limits after adding the new clip successfully
    // Send to Firebase with error handling
    await addClip(contentToSend, contentType, session);
  }
  requireSession(session);
  // Prune only after upload succeeds, so a failed upload never destroys history.
  // Duplicate retries also finish cleanup from a previously acknowledged upload.
  try {
    await enforceClipLimit(session);
  } catch {
    requireSession(session);
    throw new Error(
      "Your clip was sent, but history cleanup failed. Retry to finish cleanup.",
    );
  }
  requireSession(session);
  console.debug("Data sync completed successfully");
}

/**
 * Decrypts a record of clips.
 * Useful for processing batch data from Firebase.
 */
export function decryptClips(
  clips: Record<string, ClipData> | null | undefined,
): Record<string, ClipData> {
  if (!clips) {
    return {};
  }

  if (!isKeyLoaded()) {
    console.warn("Cannot decrypt clips: Encryption key not loaded");
    return {};
  }

  const dek = getActiveDEK();
  const decryptedClips: Record<string, ClipData> = Object.create(null);

  for (const [key, clip] of Object.entries(clips)) {
    if (
      !clip ||
      typeof clip !== "object" ||
      Array.isArray(clip) ||
      typeof clip.id !== "string" ||
      !clip.id ||
      typeof clip.content !== "string" ||
      clip.content.length > CLIPBOARD_CONFIG.maxContentLength * 8 + 58 ||
      !isEncryptedPayload(clip.content) ||
      !contentTypes.has(clip.type) ||
      typeof clip.sourceDevice !== "string" ||
      (typeof clip.timestamp !== "string" &&
        typeof clip.timestamp !== "number") ||
      !Number.isFinite(new Date(clip.timestamp).getTime())
    )
      continue;
    // deep copy the clip object
    const newClip = { ...clip };
    try {
      if (clip.content) {
        newClip.content = decrypt(clip.content, dek);
        newClip.decryptionFailed = false;
        if (newClip.content.length > CLIPBOARD_CONFIG.maxContentLength)
          continue;
      }
    } catch {
      console.warn("Failed to decrypt clip");
      newClip.decryptionFailed = true;
      // If content was formatted as iv:authTag:ciphertext but decryption failed,
      // prevent leaking unreadable ciphertext to the UI
      if (clip.content && clip.content.split(":").length === 3) {
        newClip.content = "[Encrypted Content - Decryption Failed]";
      }
    }
    decryptedClips[key] = newClip;
  }

  return decryptedClips;
}

/**
 * Edit a clip's content with encryption.
 * Encrypts the new content and updates it in Firebase.
 */
export async function editClip(
  clipId: string,
  newContent: string,
  type?: ClipContentType,
  expectedSession?: PushSession | null,
): Promise<void> {
  const session = requireSession(expectedSession);
  validateContent(newContent, type);

  let contentToSave = newContent;

  if (isKeyLoaded()) {
    const dek = getActiveDEK();
    contentToSave = encrypt(newContent, dek);
  } else {
    throw new Error("Encryption key not loaded. Cannot save clip securely.");
  }

  await updateClipContent(clipId, contentToSave, type, session);
  requireSession(session);
}
