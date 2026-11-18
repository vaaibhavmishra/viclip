import * as SecureStore from "expo-secure-store";
import { Buffer } from "react-native-quick-crypto";

const MASTER_KEY = "masterKey";
const KEY_OPTIONS = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};
let clearing: Promise<void> | null = null;
let revoked = false;

export const authStorage = {
  /**
   * Clear all stored auth data
   */
  clearAuth(): Promise<void> {
    revoked = true;
    if (clearing) return clearing;
    // Persist revocation before asynchronous deletion. A failed or delayed deletion
    // must not make an old credential usable on process restoration.
    let tombstoneError: unknown;
    try {
      SecureStore.setItem(MASTER_KEY, "", KEY_OPTIONS);
    } catch (error) {
      tombstoneError = error;
    }
    clearing = SecureStore.deleteItemAsync(MASTER_KEY, KEY_OPTIONS)
      .catch(() => {
        if (tombstoneError)
          throw new Error("Unable to clear secure credentials");
      })
      .finally(() => {
        clearing = null;
      });
    return clearing;
  },

  saveMasterKey(key: Buffer, userId: string, sessionId?: string): void {
    if (!userId || !key || key.length !== 32) {
      throw new Error("Invalid account encryption key");
    }
    if (clearing) throw new Error("Secure credential cleanup is still pending");
    // Keep ownership and key in one atomic record; legacy unowned keys require login.
    SecureStore.setItem(
      MASTER_KEY,
      JSON.stringify({ userId, key: key.toString("base64"), sessionId }),
      KEY_OPTIONS,
    );
    revoked = false;
  },

  /** Restore the notification binding only with a valid key for the same account. */
  getSessionId(userId: string): string | null {
    const restoredKey = this.getMasterKey(userId);
    if (!restoredKey) return null;
    restoredKey.fill(0);
    const stored = SecureStore.getItem(MASTER_KEY, KEY_OPTIONS);
    if (!stored || revoked || clearing) return null;
    const { sessionId } = JSON.parse(stored) as { sessionId?: unknown };
    return typeof sessionId === "string" &&
      /^[A-Za-z0-9_-]{1,128}$/.test(sessionId)
      ? sessionId
      : null;
  },

  /**
   * Retrieve the Master Data Encryption Key (DEK)
   * @returns The DEK buffer or null if not found
   */
  getMasterKey(userId: string): Buffer | null {
    if (!userId || revoked || clearing) return null;
    const stored = SecureStore.getItem(MASTER_KEY, KEY_OPTIONS);
    if (!stored) return null;
    let record: unknown;
    try {
      record = JSON.parse(stored);
    } catch {
      return null;
    }
    if (!record || typeof record !== "object") return null;
    const { userId: owner, key } = record as Record<string, unknown>;
    if (
      owner !== userId ||
      typeof key !== "string" ||
      !/^[A-Za-z0-9+/]{43}=$/.test(key)
    ) {
      return null;
    }
    const decoded = Buffer.from(key, "base64");
    return decoded.length === 32 && decoded.toString("base64") === key
      ? decoded
      : null;
  },
};
