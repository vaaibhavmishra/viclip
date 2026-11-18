import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  disk: new Map<string, unknown>(),
  instances: 0,
}));
vi.mock("electron-conf/main", () => ({
  Conf: class {
    cache: Map<string, unknown>;
    constructor() {
      this.cache = new Map(mocks.disk);
      mocks.instances++;
    }
    get(key: string) {
      return this.cache.get(key);
    }
    get store() {
      return Object.fromEntries(this.cache);
    }
    persist() {
      mocks.disk.clear();
      for (const [key, value] of this.cache) mocks.disk.set(key, value);
    }
    set(key: string, value: unknown) {
      this.cache.set(key, value);
      this.persist();
    }
    delete(key: string) {
      this.cache.delete(key);
      this.persist();
    }
  },
}));
vi.mock("electron", () => ({
  safeStorage: {
    isAsyncEncryptionAvailable: async () => true,
    getSelectedStorageBackend: () => "gnome_libsecret",
    encryptStringAsync: async (value: string) => Buffer.from(value),
    decryptStringAsync: async (value: Buffer) => ({ result: value.toString() }),
  },
}));
vi.mock("electron-log/main", () => ({
  default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock("uuid", () => ({ v4: () => "synthetic-device" }));

beforeEach(() => {
  vi.resetModules();
  mocks.disk.clear();
  mocks.instances = 0;
});

describe("shared cached configuration", () => {
  it("preserves new keys and settings when each service writes the configuration", async () => {
    const { authStorage } = await import("./secureStorage");
    const { settingsStorage } = await import("./settings");
    await authStorage.saveMasterKey(Buffer.alloc(32, 5), () => true, "a");
    settingsStorage.setShortcut("Control+Shift+V");
    expect(mocks.disk.has("masterKey")).toBe(true);
    await expect(authStorage.getMasterKey("a")).resolves.toEqual(
      Buffer.alloc(32, 5),
    );
    expect(settingsStorage.getShortcut()).toBe("Control+Shift+V");
    expect(mocks.instances).toBe(1);
  });

  it("cannot resurrect cached authentication secrets after logout through a settings write", async () => {
    mocks.disk.set("masterKey", "synthetic-encrypted-old-key");
    mocks.disk.set("auth_persist_old", "synthetic-old-session");
    mocks.disk.set("credentials", "synthetic-old-credentials");
    const { authStorage } = await import("./secureStorage");
    const { settingsStorage } = await import("./settings");
    authStorage.clearAuth();
    settingsStorage.setNotificationsEnabled(false);
    expect([...mocks.disk.keys()]).toEqual(["notificationsEnabled"]);
    expect(mocks.instances).toBe(1);
  });
});
