import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  data: new Map<string, unknown>(),
  available: vi.fn(),
  keyringAvailable: vi.fn(),
  encrypt: vi.fn(),
  decrypt: vi.fn(),
  backend: vi.fn(),
  deleteFailure: null as string | null,
}));

vi.mock("electron", () => ({
  safeStorage: {
    isAsyncEncryptionAvailable: mocks.available,
    isEncryptionAvailable: mocks.keyringAvailable,
    encryptStringAsync: mocks.encrypt,
    decryptStringAsync: mocks.decrypt,
    getSelectedStorageBackend: mocks.backend,
  },
}));
vi.mock("electron-conf/main", () => ({
  Conf: class {
    get(key: string) {
      return mocks.data.get(key);
    }
    set(key: string, value: unknown) {
      mocks.data.set(key, value);
    }
    delete(key: string) {
      if (mocks.deleteFailure === key)
        throw new Error("synthetic storage failure");
      mocks.data.delete(key);
    }
    get store() {
      return Object.fromEntries(mocks.data);
    }
  },
}));
vi.mock("electron-log/main", () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  authStorage,
  ElectronAuthPersistence,
  encryptData,
  isSecureStorageAvailable,
} from "./secureStorage";

const platformDescriptor = Object.getOwnPropertyDescriptor(process, "platform");
function platform(value: string): void {
  Object.defineProperty(process, "platform", { value, configurable: true });
}

beforeEach(() => {
  mocks.data.clear();
  mocks.deleteFailure = null;
  mocks.available.mockResolvedValue(true);
  mocks.keyringAvailable.mockReturnValue(true);
  mocks.backend.mockReturnValue("gnome_libsecret");
  mocks.encrypt.mockImplementation(async (value: string) => Buffer.from(value));
  mocks.decrypt.mockImplementation(async (value: Buffer) => ({
    result: value.toString(),
  }));
  platform("darwin");
});
afterEach(() => {
  if (platformDescriptor)
    Object.defineProperty(process, "platform", platformDescriptor);
});

describe("secure authentication persistence", () => {
  it("reports removal failures and still attempts to purge the other credentials", async () => {
    const persistence = new ElectronAuthPersistence();
    await persistence._set("session", { token: "synthetic" });
    await authStorage.saveMasterKey(Buffer.alloc(32), () => true, "a");
    mocks.deleteFailure = "masterKey";
    expect(() => authStorage.clearAuth()).toThrow(
      "Failed to clear secure authentication storage",
    );
    expect([...mocks.data.keys()]).toEqual(["masterKey"]);
    mocks.deleteFailure = `auth_persist_${Buffer.from("session").toString("hex")}`;
    await expect(persistence._remove("session")).rejects.toThrow();
  });

  it("rejects unavailable OS encryption without persisting a key or auth data", async () => {
    mocks.available.mockResolvedValue(false);
    await expect(
      authStorage.saveMasterKey(Buffer.alloc(32), () => true, "a"),
    ).rejects.toThrow();
    await expect(
      new ElectronAuthPersistence()._set("session", { token: "synthetic" }),
    ).rejects.toThrow();
    expect(mocks.data.size).toBe(0);
    expect(mocks.encrypt).not.toHaveBeenCalled();
  });

  it.each(["basic_text", "unknown"])(
    "rejects weak Linux backend %s",
    async (backend) => {
      platform("linux");
      mocks.backend.mockReturnValue(backend);
      await expect(isSecureStorageAvailable()).resolves.toBe(false);
      await expect(encryptData("synthetic")).rejects.toThrow();
      await expect(
        authStorage.saveMasterKey(Buffer.alloc(32), () => true, "a"),
      ).rejects.toThrow();
      expect(mocks.data.size).toBe(0);
    },
  );

  it("rejects an unavailable Linux keyring even if async fallback encryption is available", async () => {
    platform("linux");
    mocks.keyringAvailable.mockReturnValue(false);

    await expect(isSecureStorageAvailable()).resolves.toBe(false);
    await expect(encryptData("synthetic")).rejects.toThrow();
    await expect(
      authStorage.saveMasterKey(Buffer.alloc(32), () => true, "a"),
    ).rejects.toThrow();
    expect(mocks.data.size).toBe(0);
    expect(mocks.encrypt).not.toHaveBeenCalled();
  });

  it("never persists Linux credentials encrypted by the known-key fallback", async () => {
    platform("linux");
    mocks.encrypt.mockResolvedValue(Buffer.from("v10synthetic-ciphertext"));

    await expect(encryptData("synthetic")).rejects.toThrow();
    await expect(
      new ElectronAuthPersistence()._set("session", { token: "synthetic" }),
    ).rejects.toThrow();
    await expect(
      authStorage.saveMasterKey(Buffer.alloc(32), () => true, "a"),
    ).rejects.toThrow();
    expect(mocks.data.size).toBe(0);
  });

  it.each(["darwin", "win32"])(
    "does not treat native v10 encryption on %s as Linux fallback",
    async (os) => {
      platform(os);
      const ciphertext = Buffer.from("v10synthetic-ciphertext");
      mocks.encrypt.mockResolvedValue(ciphertext);

      await expect(encryptData("synthetic")).resolves.toBe(
        ciphertext.toString("base64"),
      );
    },
  );

  it.each(["darwin", "win32", "linux"])(
    "persists and restores an account-bound key on %s",
    async (os) => {
      platform(os);
      const key = Buffer.alloc(32, 4);
      await authStorage.saveMasterKey(key, () => true, "a");
      await expect(authStorage.getMasterKey("a")).resolves.toEqual(key);
      await expect(authStorage.getMasterKey("b")).resolves.toBeNull();
    },
  );

  it("rejects legacy unbound and malformed master keys", async () => {
    for (const record of [
      Buffer.alloc(32).toString("base64"),
      JSON.stringify({ userId: "a", key: "AA==" }),
    ]) {
      mocks.data.set("masterKey", Buffer.from(record).toString("base64"));
      await expect(authStorage.getMasterKey("a")).resolves.toBeNull();
    }
    await expect(
      authStorage.saveMasterKey(Buffer.alloc(16), () => true, "a"),
    ).rejects.toThrow();
  });

  it("does not restore a cleared key from late decryption", async () => {
    await authStorage.saveMasterKey(Buffer.alloc(32), () => true, "a");
    let resolve!: (value: { result: string }) => void;
    mocks.decrypt.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const pending = authStorage.getMasterKey("a");
    await vi.waitFor(() => expect(mocks.decrypt).toHaveBeenCalled());
    authStorage.clearAuth();
    resolve({
      result: JSON.stringify({
        userId: "a",
        key: Buffer.alloc(32).toString("base64"),
      }),
    });
    await expect(pending).resolves.toBeNull();
    expect(mocks.data.size).toBe(0);
  });

  it("rejects a late encryption completion after logout", async () => {
    let resolve!: (value: Buffer) => void;
    mocks.encrypt.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const pending = authStorage.saveMasterKey(
      Buffer.alloc(32),
      () => true,
      "a",
    );
    const rejected = expect(pending).rejects.toThrow(
      "Authentication session changed",
    );
    await vi.waitFor(() => expect(mocks.encrypt).toHaveBeenCalled());
    authStorage.clearAuth();
    resolve(Buffer.from("synthetic-encrypted-key"));
    await rejected;
    expect(mocks.data.size).toBe(0);
  });

  it("removes auth persistence entries and prevents late session writes", async () => {
    const persistence = new ElectronAuthPersistence();
    await persistence._set("session", { token: "synthetic" });
    mocks.data.set("credentials", "legacy");
    let resolve!: (value: Buffer) => void;
    mocks.encrypt.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const pending = persistence._set("session", { token: "late" });
    await vi.waitFor(() => expect(mocks.encrypt).toHaveBeenCalledTimes(2));
    authStorage.clearAuth();
    resolve(Buffer.from("late"));
    await pending;
    expect(mocks.data.size).toBe(0);
  });
});
