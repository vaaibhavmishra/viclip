import { afterEach, beforeEach, expect, it, vi } from "vitest";

const originalPlatform = Object.getOwnPropertyDescriptor(process, "platform");

const mocks = vi.hoisted(() => ({
  values: {} as Record<string, unknown>,
  set: vi.fn(),
}));
vi.mock("electron-conf/main", () => ({
  Conf: class {
    get(key: string) {
      return mocks.values[key];
    }
    set = mocks.set;
  },
}));
vi.mock("electron-log/main", () => ({ default: { info: vi.fn() } }));
beforeEach(() => {
  vi.resetModules();
  mocks.values = {};
  mocks.set.mockClear();
});
afterEach(() => {
  if (originalPlatform)
    Object.defineProperty(process, "platform", originalPlatform);
});
it("recovers invalid device paths using a new safe installation ID", async () => {
  mocks.values.deviceId = "../another/device";
  const { settingsStorage } = await import("./settings");
  expect(settingsStorage.getOrCreateDeviceId()).toMatch(/^[a-f\d-]+$/);
  expect(mocks.set).toHaveBeenCalledWith("deviceId", expect.any(String));
});
it.each([
  ["darwin", "CommandOrControl+Shift+V"],
  ["win32", "Alt+Shift+V"],
  ["linux", "Alt+Shift+V"],
])(
  "uses the %s shortcut default for missing or corrupt settings",
  async (platform, expected) => {
    Object.defineProperty(process, "platform", { value: platform });
    const { settingsStorage } = await import("./settings");
    for (const stored of [undefined, {}, "", "Control+\nV"]) {
      mocks.values.globalShortcut = stored;
      expect(settingsStorage.getShortcut()).toBe(expected);
    }
    expect(mocks.set).not.toHaveBeenCalled();
  },
);
it.each(["darwin", "win32", "linux"])(
  "preserves valid saved shortcuts on %s",
  async (platform) => {
    Object.defineProperty(process, "platform", { value: platform });
    const { settingsStorage } = await import("./settings");
    for (const stored of ["Alt+Shift+K", "CommandOrControl+Shift+V"]) {
      mocks.values.globalShortcut = stored;
      expect(settingsStorage.getShortcut()).toBe(stored);
    }
    expect(mocks.set).not.toHaveBeenCalled();
  },
);
it("defaults corrupted notification settings", async () => {
  mocks.values.notificationsEnabled = "false";
  const { settingsStorage } = await import("./settings");
  expect(settingsStorage.getNotificationsEnabled()).toBe(true);
});
