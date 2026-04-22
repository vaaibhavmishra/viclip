import log from "electron-log/main";
import {
  getDownloadURL,
  getStorage,
  ref as storageRef,
  uploadString,
} from "firebase/storage";
import { v4 as uuidv4 } from "uuid";

/**
 * Uploads an encrypted image (base64) to Firebase Storage and returns the download URL.
 * @param userId User ID for storage path
 * @param encryptedBase64 Encrypted image as base64 string
 * @returns Download URL of the uploaded image
 */
export async function uploadEncryptedImage(
  userId: string,
  encryptedBase64: string,
): Promise<string> {
  const storage = getStorage();
  const imageId = uuidv4();
  const path = `users/${userId}/images/${imageId}.enc`;
  const imgRef = storageRef(storage, path);
  log.debug("Uploading encrypted image to Firebase Storage", { userId, path });
  await uploadString(imgRef, encryptedBase64, "base64");
  const url = await getDownloadURL(imgRef);
  log.debug("Encrypted image uploaded", { url });
  return url;
}
