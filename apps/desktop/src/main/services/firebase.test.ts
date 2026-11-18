import type { User } from "firebase/auth";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: { uid: "alice" } as { uid: string } | null,
  generation: 0,
  get: vi.fn(),
  set: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  transaction: vi.fn(),
  onValue: vi.fn(),
  platform: vi.fn(),
}));
vi.mock("node:os", () => ({
  default: {
    hostname: () => "Synthetic Device",
    platform: mocks.platform,
  },
}));
vi.mock("firebase/auth", () => ({
  getAuth: () => ({ currentUser: mocks.user }),
  initializeAuth: vi.fn(),
}));
vi.mock("./auth", () => ({ getAuthGeneration: () => mocks.generation }));
vi.mock("firebase/app", () => ({ getApps: () => [], initializeApp: vi.fn() }));
vi.mock("firebase/database", () => ({
  getDatabase: () => ({}),
  ref: (_: unknown, path: string) => path,
  push: (path: string) => `${path}/synthetic`,
  query: (path: string) => path,
  orderByChild: vi.fn(),
  equalTo: vi.fn(),
  get: mocks.get,
  set: mocks.set,
  update: mocks.update,
  remove: mocks.remove,
  runTransaction: mocks.transaction,
  onValue: mocks.onValue,
}));
vi.mock("./secureStorage", () => ({ ElectronAuthPersistence: class {} }));
vi.mock("./settings", () => ({
  settingsStorage: { getOrCreateDeviceId: () => "synthetic-device" },
}));
vi.mock("electron-log/main", () => ({
  default: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
const encrypted = `${"01".repeat(12)}:${"02".repeat(16)}:aa`;
const snapshot = (value: unknown) => ({
  exists: () => value !== null,
  val: () => value,
});
const clip = (index: number) => ({
  id: `clip-${index}`,
  content: encrypted,
  type: "text",
  timestamp: new Date(index * 1000).toISOString(),
  sourceDevice: "synthetic",
});

describe("Firebase boundary and retention", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.user = { uid: "alice" };
    mocks.generation = 0;
    mocks.platform.mockReturnValue("darwin");
  });

  it("rejects plaintext before constructing an upload", async () => {
    const firebase = await import("./firebase");
    await expect(
      firebase.addClip("alice", "synthetic plaintext", "text"),
    ).rejects.toThrow("encrypted clip");
    expect(mocks.set).not.toHaveBeenCalled();
  });
  it("writes the required profile name when Firebase Auth has no display name", async () => {
    mocks.get.mockResolvedValue(snapshot(null));
    const firebase = await import("./firebase");
    await firebase.addUserProfile(
      {
        uid: "alice",
        email: "synthetic@example.test",
        displayName: null,
      } as User,
      "Synthetic User",
    );
    expect(mocks.set).toHaveBeenCalledWith(
      "users/alice/profile",
      expect.objectContaining({ name: "Synthetic User" }),
    );
  });
  it("propagates failed encrypted uploads for retries", async () => {
    mocks.set.mockRejectedValue(new Error("offline"));
    const firebase = await import("./firebase");
    await expect(firebase.addClip("alice", encrypted, "text")).rejects.toThrow(
      "offline",
    );
  });
  it("does not interpret metadata read failure as missing keys", async () => {
    mocks.get.mockRejectedValue(new Error("permission denied"));
    const firebase = await import("./firebase");
    await expect(firebase.getEncryptionMetadata("alice")).rejects.toThrow(
      "permission denied",
    );
  });
  it("does not report metadata write success after rejection", async () => {
    mocks.set.mockRejectedValue(new Error("offline"));
    const firebase = await import("./firebase");
    await expect(
      firebase.saveEncryptionMetadata("alice", "01".repeat(16), encrypted),
    ).rejects.toThrow("offline");
  });
  it("rejects a stale account's completed fetch", async () => {
    mocks.get.mockImplementation(async () => {
      mocks.generation++;
      return snapshot({ synthetic: clip(1) });
    });
    const firebase = await import("./firebase");
    await expect(firebase.getClips()).rejects.toThrow("session changed");
  });
  it("does not delete clips when the current history has exactly 300 entries", async () => {
    const current = Object.fromEntries(
      Array.from({ length: 300 }, (_, i) => [`clip-${i}`, clip(i)]),
    );
    mocks.transaction.mockImplementation(
      async (_: unknown, transform: (value: unknown) => unknown) => {
        expect(transform(current)).toBeUndefined();
        return { committed: false };
      },
    );
    const firebase = await import("./firebase");
    await firebase.enforceClipLimit("alice");
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
  });
  it("recomputes retention against current uploads while preserving concurrent pins", async () => {
    const current = {
      ...Object.fromEntries(
        Array.from({ length: 302 }, (_, i) => [`clip-${i}`, clip(i)]),
      ),
      "clip-0": { ...clip(0), pinned: true },
    };
    mocks.transaction.mockImplementation(
      async (_: unknown, transform: (value: unknown) => unknown) => {
        const result = transform(current) as typeof current;
        expect(Object.keys(result)).toHaveLength(300);
        expect(result["clip-0"]).toEqual(current["clip-0"]);
        expect(result).not.toHaveProperty("clip-1");
        expect(result).not.toHaveProperty("clip-2");
        return { committed: true };
      },
    );
    const firebase = await import("./firebase");
    await firebase.enforceClipLimit("alice");
  });
  it("does not recreate clips deleted while an edit is looking them up", async () => {
    mocks.get.mockResolvedValue(snapshot({ synthetic: clip(1) }));
    mocks.transaction.mockImplementation(
      async (_: unknown, transform: (value: unknown) => unknown) => {
        expect(transform(null)).toBeUndefined();
        return { committed: false };
      },
    );
    const firebase = await import("./firebase");
    await expect(
      firebase.updateClip("alice", "clip-1", { content: encrypted }),
    ).rejects.toThrow("no longer exists");
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("checks current pin state when clearing history", async () => {
    const observed = { one: clip(1), two: clip(2) };
    mocks.get.mockResolvedValue(snapshot(observed));
    mocks.transaction.mockImplementation(
      async (_: unknown, transform: (value: unknown) => unknown) => {
        expect(
          transform({ ...observed, two: { ...clip(2), pinned: true } }),
        ).toEqual({ two: { ...clip(2), pinned: true } });
        return { committed: true };
      },
    );
    const firebase = await import("./firebase");
    await firebase.removeAllClips();
  });
  it("rejects a clip deletion after logout during the lookup", async () => {
    mocks.get.mockImplementation(async () => {
      mocks.user = null;
      return snapshot({ synthetic: clip(1) });
    });
    const firebase = await import("./firebase");
    await expect(firebase.removeClip("alice", "clip-1")).rejects.toThrow(
      "session changed",
    );
    expect(mocks.remove).not.toHaveBeenCalled();
  });
  it("detects remotely removed devices on the initial subscription", async () => {
    const firebase = await import("./firebase");
    const removed = vi.fn();
    firebase.listenDeviceStatus("alice", removed);
    const callback = mocks.onValue.mock.calls[0][1] as (value: unknown) => void;
    callback(snapshot(null));
    expect(removed).toHaveBeenCalledTimes(1);
    mocks.generation++;
    callback(snapshot(null));
    expect(removed).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["darwin", "macOS"],
    ["win32", "Windows"],
    ["linux", "Linux"],
  ])(
    "registers %s devices with the shared %s platform",
    async (nativePlatform, platform) => {
      mocks.platform.mockReturnValue(nativePlatform);
      const firebase = await import("./firebase");
      await firebase.addDevice("alice");
      expect(mocks.set).toHaveBeenCalledWith(
        "users/alice/devices/synthetic-device",
        expect.objectContaining({
          id: "synthetic-device",
          deviceName: "Synthetic Device",
          platform,
          lastActive: expect.any(String),
        }),
      );
    },
  );

  it("rejects unsupported desktop platforms before writing a device", async () => {
    mocks.platform.mockReturnValue("freebsd");
    const firebase = await import("./firebase");
    await expect(firebase.addDevice("alice")).rejects.toThrow(
      "Unsupported desktop platform: freebsd",
    );
    expect(mocks.set).not.toHaveBeenCalled();
  });

  it("omits malformed remote devices instead of forwarding values that crash the renderer", async () => {
    const valid = {
      id: "synthetic-device",
      deviceName: "Synthetic Device",
      platform: "darwin",
      lastActive: "2026-01-01T00:00:00.000Z",
    };
    mocks.get.mockResolvedValue(
      snapshot({
        valid,
        invalidPlatform: { ...valid, platform: {} },
        invalidName: { ...valid, deviceName: {} },
        invalidId: { ...valid, id: 123 },
        invalidDate: { ...valid, lastActive: "invalid" },
        nullDevice: null,
      }),
    );
    const firebase = await import("./firebase");
    await expect(firebase.getDevices()).resolves.toEqual({ valid });
  });
});
