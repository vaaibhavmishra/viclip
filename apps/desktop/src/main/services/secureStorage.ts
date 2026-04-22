import { safeStorage } from "electron";
import { Conf } from "electron-conf/main";
import log from "electron-log/main";

const store = new Conf();

/**
 * Encrypt sensitive string data before storing
 * @param data String data to encrypt
 * @returns Encrypted data as base64 string
 */
export function encryptData(data: string): string {
  try {
    if (!safeStorage.isEncryptionAvailable()) {
      log.warn("Encryption is not available, data will be stored unencrypted");
      return data;
    }
    const encryptedData = safeStorage.encryptString(data);
    return encryptedData.toString("base64");
  } catch (error) {
    log.error("Failed to encrypt data", error);
    return data;
  }
}

/**
 * Encrypt image buffer data before storing
 * @param buffer Buffer of image data (PNG/JPEG)
 * @returns Encrypted data as base64 string
 */
export function encryptImageBuffer(buffer: Buffer): string {
  try {
    if (!safeStorage.isEncryptionAvailable()) {
      log.warn("Encryption is not available, image will be stored unencrypted");
      return buffer.toString("base64");
    }
    // safeStorage.encryptString expects a string. Convert buffer to base64 first.
    const encryptedData = safeStorage.encryptString(buffer.toString("base64"));
    return encryptedData.toString("base64");
  } catch (error) {
    log.error("Failed to encrypt image buffer", error);
    return buffer.toString("base64");
  }
}

/**
 * Decrypt data retrieved from storage
 * @param encryptedData Base64 string encrypted data
 * @returns Decrypted data
 */
function decryptData(encryptedData: string): string {
  try {
    if (!safeStorage.isEncryptionAvailable()) {
      log.warn(
        "Encryption is not available, data will be returned unencrypted",
      );
      return encryptedData;
    }

    const decryptedData = safeStorage.decryptString(
      Buffer.from(encryptedData, "base64"),
    );
    return decryptedData.toString();
  } catch (error) {
    log.error("Failed to decrypt data", error);
    return "";
  }
}

export const authStorage = {
  /**
   * Clear all stored auth data
   */
  clearAuth(): void {
    store.delete("masterKey");
    // store.delete('uid')
    log.debug("Auth data cleared");
  },

  /**
   * Save the Master Data Encryption Key (DEK)
   * @param key The 32-byte DEK buffer
   */
  saveMasterKey(key: Buffer): void {
    // We encrypt the buffer using safeStorage and store as base64
    store.set("masterKey", encryptImageBuffer(key));
    log.debug("Master key saved securely");
  },

  /**
   * Retrieve the Master Data Encryption Key (DEK)
   * @returns The DEK buffer or null if not found
   */
  getMasterKey(): Buffer | null {
    const encryptedKey = store.get("masterKey") as string;
    if (!encryptedKey) return null;

    const decryptedHex = decryptData(encryptedKey);
    if (!decryptedHex) return null;

    // Note: decryptData returns string.
    // If we used encryptImageBuffer (which uses encryptString on buffer), safeStorage.decryptString returns string.
    // Wait, safeStorage.encryptString(Buffer) -> returns Buffer.
    // My helper encryptImageBuffer line 42: safeStorage.encryptString(buffer); -> This API actually expects string usually?
    // Electron docs: safeStorage.encryptString(text) -> Buffer.
    // My helper line 42 uses encryptString(buffer). This might be a TS issue if typed strictly, but JS allows it.
    // However, decryptString returns string.
    // The `encryptImageBuffer` takes a Buffer and returns base64 string.
    // `decryptData` takes base64 string and returns string.
    // If we passed a Buffer to encryptString, it likely stringified it.
    // Let's look closer at `encryptImageBuffer` in the file view.

    // Re-reading `encryptImageBuffer` implementation in previous turn:
    // 33: export function encryptImageBuffer(buffer: Buffer): string {
    // 42: const encryptedData = safeStorage.encryptString(buffer);
    //
    // `safeStorage.encryptString` argument is `plaintext string`. passing Buffer works but it calls .toString() on it?
    // No, usually it accepts string.
    // If I want to store a Buffer (the Key), I should probably convert it to hex/base64 STRING first, then encrypt.

    return Buffer.from(decryptedHex, "base64"); // assuming I store it as base64 string before encryption
  },

  /**
   * Save user credentials securely
   * @param email User email
   * @param pass User password
   */
  saveCredentials(email: string, pass: string): void {
    const data = JSON.stringify({ email, pass });
    store.set("credentials", encryptData(data));
    log.debug("Credentials saved securely");
  },

  /**
   * Retrieve stored user credentials
   * @returns Object with email and password or null if not found
   */
  getCredentials(): { email: string; pass: string } | null {
    const encrypted = store.get("credentials") as string;
    if (!encrypted) return null;

    const decrypted = decryptData(encrypted);
    if (!decrypted) return null;

    try {
      return JSON.parse(decrypted);
    } catch (e) {
      log.error("Failed to parse credentials", e);
      return null;
    }
  },

  /**
   * Clear stored credentials
   */
  clearCredentials(): void {
    store.delete("credentials");
    log.debug("Credentials cleared");
  },
};
