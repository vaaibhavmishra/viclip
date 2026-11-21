import { safeStorage } from "electron";
import log from "electron-log/main";
import { configStore as store } from "./configStore";

let storageGeneration = 0;

export async function isSecureStorageAvailable(): Promise<boolean> {
  if (!(await safeStorage.isAsyncEncryptionAvailable())) return false;
  // Linux's basic_text backend encrypts with a publicly known password.
  if (process.platform === "linux") {
    const backend = safeStorage.getSelectedStorageBackend();
    if (backend === "basic_text" || backend === "unknown") return false;
    // Electron 45's async API can initialize with a fallback provider. Check
    // that the selected OS keyring actually has a key, not just a backend name.
    return safeStorage.isEncryptionAvailable();
  }
  return true;
}

async function encryptWithSecureStorage(data: string): Promise<Buffer> {
  const encryptedData = await safeStorage.encryptStringAsync(data);
  // On Linux, Chromium's v10 POSIX fallback uses a publicly known key even
  // when the selected backend name appears secure. Never persist that output.
  if (
    process.platform === "linux" &&
    encryptedData.subarray(0, 3).toString("ascii") === "v10"
  ) {
    throw new Error("OS-level encryption is unavailable");
  }
  return encryptedData;
}

/**
 * Encrypt sensitive string data before storing
 * @param data String data to encrypt
 * @returns Encrypted data as base64 string
 */
export async function encryptData(data: string): Promise<string> {
  if (!(await isSecureStorageAvailable())) {
    throw new Error("OS-level encryption is unavailable");
  }
  const encryptedData = await encryptWithSecureStorage(data);
  return encryptedData.toString("base64");
}

/**
 * Decrypt data retrieved from storage
 * @param encryptedData Base64 string encrypted data
 * @returns Decrypted data
 */
async function decryptData(encryptedData: string): Promise<string> {
  try {
    if (!(await isSecureStorageAvailable())) {
      log.warn(
        "Cannot decrypt stored data because OS-level encryption is unavailable",
      );
      return "";
    }

    const decryptedData = await safeStorage.decryptStringAsync(
      Buffer.from(encryptedData, "base64"),
    );
    return decryptedData.result;
  } catch {
    log.error("Failed to decrypt data");
    return "";
  }
}

export class ElectronAuthPersistence {
  static readonly type = "LOCAL" as const;
  readonly type = "LOCAL" as const;

  private _safeKey(key: string): string {
    return `auth_persist_${Buffer.from(key, "utf8").toString("hex")}`;
  }

  async _isAvailable(): Promise<boolean> {
    try {
      return await isSecureStorageAvailable();
    } catch {
      log.error("Failed to check auth encryption availability");
      return false;
    }
  }

  async _set(key: string, value: unknown): Promise<void> {
    if (value === undefined) {
      await this._remove(key);
      return;
    }
    const generation = storageGeneration;
    try {
      const safeKey = this._safeKey(key);
      const serialized = JSON.stringify(value);
      const encrypted = await encryptData(serialized);
      if (generation !== storageGeneration) return;
      store.set(safeKey, encrypted);
    } catch (error) {
      log.error("Failed to persist auth data");
      throw error;
    }
  }

  async _get(key: string): Promise<unknown> {
    const generation = storageGeneration;
    try {
      const safeKey = this._safeKey(key);
      const encrypted = store.get(safeKey) as string;
      if (!encrypted) return null;
      const decrypted = await decryptData(encrypted);
      if (!decrypted || generation !== storageGeneration) return null;
      return JSON.parse(decrypted);
    } catch {
      log.error("Failed to retrieve persisted auth data");
      return null;
    }
  }

  async _remove(key: string): Promise<void> {
    try {
      const safeKey = this._safeKey(key);
      store.delete(safeKey);
    } catch (error) {
      log.error("Failed to remove persisted auth data");
      throw error;
    }
  }

  _addListener(_key: string, _listener: (value: unknown) => void): void {}
  _removeListener(_key: string, _listener: (value: unknown) => void): void {}
}

export const authStorage = {
  /**
   * Clear all stored auth data and keys
   */
  clearAuth(): void {
    // Prevent pending async storage operations from restoring cleared secrets.
    storageGeneration++;
    const keys = new Set(["masterKey", "credentials"]); // Purge any legacy saved credentials
    let failed = false;
    try {
      const data = (store.store || {}) as Record<string, unknown>;
      for (const key of Object.keys(data)) {
        if (key.startsWith("auth_persist_")) {
          keys.add(key);
        }
      }
    } catch {
      failed = true;
      log.error("Failed to clear persisted auth keys");
    }
    for (const key of keys) {
      try {
        store.delete(key);
      } catch {
        failed = true;
      }
    }
    if (failed)
      throw new Error("Failed to clear secure authentication storage");
    log.debug("Auth data and keys cleared");
  },

  /**
   * Save the Master Data Encryption Key (DEK).
   * Only persists to disk if OS-level encryption (safeStorage) is available.
   * Never writes plaintext keys to disk.
   * @param key The 32-byte DEK buffer
   * @param isCurrentSession Whether the authentication attempt is still active
   */
  async saveMasterKey(
    key: Buffer,
    isCurrentSession: () => boolean,
    userId: string,
  ): Promise<void> {
    const generation = storageGeneration;
    if (!isCurrentSession()) throw new Error("Authentication session changed");
    if (!userId || !key || key.length !== 32) {
      log.warn("Attempted to save empty master key");
      throw new Error("Invalid master encryption key");
    }
    try {
      if (!(await isSecureStorageAvailable())) {
        log.warn(
          "OS-level safeStorage encryption is unavailable. Master key will not be persisted to disk to protect Zero-Knowledge security.",
        );
        throw new Error("OS-level encryption is unavailable");
      }
      const encryptedData = await encryptWithSecureStorage(
        JSON.stringify({ userId, key: key.toString("base64") }),
      );
      if (generation !== storageGeneration || !isCurrentSession()) {
        throw new Error("Authentication session changed");
      }
      store.set("masterKey", encryptedData.toString("base64"));
      log.debug("Master key saved securely with safeStorage");
    } catch (error) {
      log.error("Failed to encrypt master key with safeStorage");
      throw error;
    }
  },

  /**
   * Retrieve the Master Data Encryption Key (DEK)
   * @returns The DEK buffer or null if not found
   */
  async getMasterKey(userId: string): Promise<Buffer | null> {
    const generation = storageGeneration;
    try {
      if (!(await isSecureStorageAvailable())) {
        return null;
      }
      const encryptedKey = store.get("masterKey") as string;
      if (!encryptedKey) return null;

      const { result: decryptedBase64 } = await safeStorage.decryptStringAsync(
        Buffer.from(encryptedKey, "base64"),
      );
      if (!decryptedBase64 || generation !== storageGeneration) return null;

      // Legacy unbound keys cannot safely be associated with a restored account.
      const record: unknown = JSON.parse(decryptedBase64);
      if (
        !record ||
        typeof record !== "object" ||
        !("userId" in record) ||
        !("key" in record) ||
        record.userId !== userId ||
        typeof record.key !== "string" ||
        !/^[A-Za-z0-9+/]{43}=$/.test(record.key)
      )
        return null;
      const key = Buffer.from(record.key, "base64");
      return key.length === 32 ? key : null;
    } catch {
      log.error("Failed to decrypt master key from storage");
      return null;
    }
  },
};
