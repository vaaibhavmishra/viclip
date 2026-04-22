import type { ClipContentType, ClipData } from "@/types/clips";
import { decrypt, encrypt, getActiveDEK, isKeyLoaded } from "./crypto";
import { addClip, updateClip } from "./firebase";

export async function sendClip(
  clipboard: string,
  contentType: ClipContentType,
) {
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
    console.error("Encryption failed, aborting sync", cryptoError);
    throw cryptoError;
  }

  const cachedClips: Record<string, ClipData> = {};
  let duplicateClipId: string | null = null;

  if (cachedClips) {
    const existingClip = Object.values(cachedClips).find(
      (clip: ClipData) =>
        clip.content === clipboard && clip.type === contentType,
    );
    if (existingClip) {
      duplicateClipId = existingClip.id;
    }
  }

  if (duplicateClipId) {
    console.debug("Duplicate clip found, updating timestamp");
    await updateClip(duplicateClipId);
  } else {
    // Send to Firebase with error handling
    await addClip(contentToSend, contentType);
  }
  console.debug("Data sync completed successfully");
}

/**
 * Decrypts a record of clips.
 * Useful for processing batch data from Firebase.
 */
export function decryptClips(
  clips: Record<string, ClipData>,
): Record<string, ClipData> {
  if (!isKeyLoaded()) {
    console.warn("Cannot decrypt clips: Encryption key not loaded");
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
      console.warn(`Failed to decrypt clip ${key}:`, error);
      // Keep original content (might be plaintext legacy data)
    }
    decryptedClips[key] = newClip;
  }

  return decryptedClips;
}
