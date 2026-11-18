import { beforeEach, expect, it, vi } from "vitest";

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
  mocks.values = {};
  mocks.set.mockClear();
});
it("recovers invalid device paths using a new safe installation ID", async () => {
  mocks.values.deviceId = "../another/device";
  const { settingsStorage } = await import("./settings");
  expect(settingsStorage.getOrCreateDeviceId()).toMatch(/^[a-f\d-]+$/);
  expect(mocks.set).toHaveBeenCalledWith("deviceId", expect.any(String));
});
it("defaults corrupted shortcuts and notification settings", async () => {
  mocks.values.globalShortcut = {};
  mocks.values.notificationsEnabled = "false";
  const { settingsStorage } = await import("./settings");
  expect(settingsStorage.getShortcut()).toBe("CommandOrControl+Shift+V");
  expect(settingsStorage.getNotificationsEnabled()).toBe(true);
});
