import * as SecureStore from "expo-secure-store";
import { Buffer } from "react-native-quick-crypto";

export const authStorage = {
  /**
   * Clear all stored auth data
   */
  clearAuth(): void {
    SecureStore.deleteItemAsync("masterKey");
    console.debug("Auth data cleared");
  },

  saveMasterKey(key: Buffer): void {
    // We encrypt the buffer using safeStorage and store as base64
    SecureStore.setItem("masterKey", key.toString("base64"));
    console.debug("Master key saved securely");
  },

  /**
   * Retrieve the Master Data Encryption Key (DEK)
   * @returns The DEK buffer or null if not found
   */
  getMasterKey(): Buffer | null {
    const encryptedKey = SecureStore.getItem("masterKey");
    if (!encryptedKey) return null;

    return Buffer.from(encryptedKey, "base64");
  },
};
