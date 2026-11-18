import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  callback: null as
    | ((
        user: {
          uid: string;
          displayName?: string | null;
          email?: string;
        } | null,
      ) => void)
    | null,
  user: null as {
    uid: string;
    displayName?: string | null;
    email?: string;
  } | null,
  generation: 0,
  loaded: false,
  pending: false,
  syncEnabled: true,
  interactive: false,
  revoked: false,
  revokeCallback: null as (() => void) | null,
  revokeSubscribe: vi.fn(),
  revokeOff: vi.fn(),
  subscriptionKind: "state" as "state" | "token",
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
  device: vi.fn(),
  deviceOff: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  getKey: vi.fn(),
  wait: vi.fn(),
  activate: vi.fn(),
  logout: vi.fn(),
  invalidate: vi.fn(),
  createMain: vi.fn(),
  createAuth: vi.fn(),
  closeMain: vi.fn(),
  closeSettings: vi.fn(),
  clear: vi.fn(),
  clearClips: vi.fn(),
  send: vi.fn(),
  show: vi.fn(),
  register: vi.fn(),
  unregister: vi.fn(),
  unregisterAll: vi.fn(),
  isRegistered: vi.fn(),
  networkStop: vi.fn(),
}));
vi.mock("electron", () => ({
  globalShortcut: {
    register: mocks.register,
    unregister: mocks.unregister,
    unregisterAll: mocks.unregisterAll,
    isRegistered: mocks.isRegistered,
  },
}));
vi.mock("firebase/auth", () => ({
  getAuth: () => ({
    get currentUser() {
      return mocks.user;
    },
  }),
  onAuthStateChanged: (...args: unknown[]) => {
    mocks.subscriptionKind = "state";
    return mocks.subscribe(...args);
  },
  onIdTokenChanged: (...args: unknown[]) => {
    mocks.subscriptionKind = "token";
    return mocks.subscribe(...args);
  },
}));
vi.mock("./auth", () => ({
  getAuthGeneration: () => mocks.generation,
  isAuthenticationPending: () => mocks.pending,
  isInteractiveAuthSession: () => mocks.interactive,
  logoutUser: mocks.logout,
  invalidateAuthWork: mocks.invalidate,
  isSessionRevoked: () => mocks.revoked,
  subscribeSessionRevoked: mocks.revokeSubscribe,
  restoreAuthSession: vi.fn(),
}));
vi.mock("./crypto", () => ({
  isKeyLoaded: () => mocks.loaded,
  setActiveDEK: mocks.activate,
  clearActiveDEK: mocks.clear,
  waitForKeyLoaded: mocks.wait,
}));
vi.mock("./clipboard", () => ({
  startClipboardSync: mocks.start,
  stopClipboardSync: mocks.stop,
}));
vi.mock("./firebase", () => ({ listenDeviceStatus: mocks.device }));
vi.mock("./secureStorage", () => ({
  authStorage: { getMasterKey: mocks.getKey },
}));
vi.mock("./settings", () => ({
  settingsStorage: {
    getShortcut: () => "CommandOrControl+Shift+V",
    getClipboardSyncEnabled: () => mocks.syncEnabled,
  },
}));
vi.mock("./network", () => ({
  startNetworkMonitoring: vi.fn(),
  stopNetworkMonitoring: mocks.networkStop,
}));
vi.mock("../globalStates", () => ({
  clearCachedClips: mocks.clearClips,
  getMainWindow: () => ({
    isDestroyed: () => false,
    isVisible: () => false,
    isMinimized: () => false,
    show: mocks.show,
    focus: vi.fn(),
    webContents: { send: mocks.send },
  }),
}));
vi.mock("../modules/window", () => ({
  createMainWindow: mocks.createMain,
  createAuthWindow: mocks.createAuth,
  closeAuthWindow: vi.fn(),
  closeMainWindow: mocks.closeMain,
  closeSettingsWindow: mocks.closeSettings,
}));
vi.mock("electron-log/main", () => ({
  default: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

async function flush() {
  for (let i = 0; i < 8; i++) await Promise.resolve();
}
describe("application initialization and shortcuts", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    mocks.user = null;
    mocks.loaded = false;
    mocks.pending = false;
    mocks.generation = 0;
    mocks.syncEnabled = true;
    mocks.interactive = false;
    mocks.revoked = false;
    mocks.revokeCallback = null;
    mocks.revokeSubscribe.mockImplementation((callback) => {
      mocks.revokeCallback = callback;
      return mocks.revokeOff;
    });
    mocks.subscriptionKind = "state";
    mocks.subscribe.mockImplementation((_auth, callback) => {
      mocks.callback = callback;
      return mocks.unsubscribe;
    });
    mocks.device.mockReturnValue(mocks.deviceOff);
    mocks.logout.mockResolvedValue(undefined);
    mocks.activate.mockImplementation(() => {
      mocks.loaded = true;
    });
    mocks.register.mockReturnValue(true);
  });
  it("initializes once and disposes every subscription", async () => {
    const app = await import("./initApp");
    app.initApp();
    app.initApp();
    expect(mocks.subscribe).toHaveBeenCalledTimes(1);
    mocks.loaded = true;
    mocks.user = { uid: "alice", email: "synthetic@example.test" };
    mocks.callback?.(mocks.user);
    await flush();
    app.disposeApp();
    app.disposeApp();
    expect(mocks.unsubscribe).toHaveBeenCalledTimes(1);
    expect(mocks.revokeOff).toHaveBeenCalledTimes(1);
    expect(mocks.deviceOff).toHaveBeenCalledTimes(1);
    expect(mocks.networkStop).toHaveBeenCalled();
    expect(mocks.clear).toHaveBeenCalled();
    expect(mocks.invalidate).toHaveBeenCalled();
  });
  it("does not create windows or sync resources from a late key load after disposal", async () => {
    let finish!: (key: Buffer) => void;
    mocks.getKey.mockReturnValue(
      new Promise<Buffer>((resolve) => {
        finish = resolve;
      }),
    );
    const app = await import("./initApp");
    app.initApp();
    mocks.user = { uid: "alice" };
    mocks.callback?.(mocks.user);
    app.disposeApp();
    finish(Buffer.alloc(32, 1));
    await flush();
    expect(mocks.start).not.toHaveBeenCalled();
    expect(mocks.createMain).not.toHaveBeenCalled();
  });
  it("uses a non-null authenticated display name fallback", async () => {
    mocks.getKey.mockResolvedValue(Buffer.alloc(32, 1));
    const app = await import("./initApp");
    app.initApp();
    mocks.user = {
      uid: "alice",
      email: "synthetic@example.test",
      displayName: null,
    };
    mocks.callback?.(mocks.user);
    await flush();
    expect(mocks.send).toHaveBeenCalledWith(
      "auth-state-changed",
      "synthetic@example.test",
    );
    app.disposeApp();
  });
  it("ignores stale remote removal after logout or account changes", async () => {
    mocks.getKey.mockResolvedValue(Buffer.alloc(32, 1));
    const app = await import("./initApp");
    app.initApp();
    mocks.user = { uid: "alice" };
    mocks.callback?.(mocks.user);
    await flush();
    const removal = mocks.device.mock.calls[0][1] as () => void;
    mocks.generation++;
    mocks.user = { uid: "bob" };
    removal();
    expect(mocks.logout).not.toHaveBeenCalled();
    app.disposeApp();
  });
  it("keeps synchronization disabled after initialization with a persisted pause", async () => {
    mocks.syncEnabled = false;
    mocks.loaded = true;
    const app = await import("./initApp");
    app.initApp();
    mocks.user = { uid: "alice" };
    mocks.callback?.(mocks.user);
    await flush();
    expect(mocks.start).not.toHaveBeenCalled();
    expect(mocks.createMain).toHaveBeenCalled();
    app.disposeApp();
  });
  it("does not publish success after device monitoring fails synchronously", async () => {
    mocks.loaded = true;
    mocks.logout.mockImplementation(async () => {
      mocks.generation++;
      mocks.user = null;
    });
    mocks.device.mockImplementation((_uid, onRemoved) => {
      onRemoved();
      return mocks.deviceOff;
    });
    const app = await import("./initApp");
    app.initApp();
    mocks.user = { uid: "alice" };
    mocks.callback?.(mocks.user);
    await flush();
    expect(mocks.logout).toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
    app.disposeApp();
  });
  it("keeps device revocation effective after a same-account auth refresh", async () => {
    mocks.loaded = true;
    const app = await import("./initApp");
    app.initApp();
    mocks.user = { uid: "alice" };
    mocks.callback?.(mocks.user);
    await flush();
    const removal = mocks.device.mock.calls[0][1] as () => void;
    mocks.callback?.(mocks.user);
    await flush();
    removal();
    expect(mocks.logout).toHaveBeenCalledTimes(1);
    app.disposeApp();
  });
  it("reinitializes after same-UID sign-in without restoring an old disk key", async () => {
    const app = await import("./initApp");
    app.initApp();
    let lastNotifiedUid: string | null = null;
    const notifyFirebaseListeners = () => {
      const uid = mocks.user?.uid ?? null;
      // Firebase's auth-state subscription only emits when the UID changes.
      // Its token subscription also emits for a new sign-in to the same UID.
      if (mocks.subscriptionKind === "token" || uid !== lastNotifiedUid)
        mocks.callback?.(mocks.user);
      lastNotifiedUid = uid;
    };
    mocks.user = { uid: "alice" };
    mocks.loaded = true;
    notifyFirebaseListeners();
    await flush();
    expect(mocks.start).toHaveBeenCalledTimes(1);

    mocks.generation++;
    mocks.pending = true;
    mocks.loaded = false;
    let finishKeyLoad!: (loaded: boolean) => void;
    mocks.wait.mockReturnValue(
      new Promise<boolean>((resolve) => {
        finishKeyLoad = resolve;
      }),
    );
    notifyFirebaseListeners();
    await flush();
    expect(mocks.wait).toHaveBeenCalledWith(10000, "alice");
    expect(mocks.getKey).not.toHaveBeenCalled();
    mocks.loaded = true;
    mocks.pending = false;
    finishKeyLoad(true);
    await flush();
    expect(mocks.start).toHaveBeenCalledTimes(2);
    expect(mocks.deviceOff).toHaveBeenCalledTimes(1);
    expect(mocks.device).toHaveBeenCalledTimes(2);
    app.disposeApp();
  });
  it("keeps the old shortcut when registration is rejected", async () => {
    mocks.register.mockReturnValue(false);
    const app = await import("./initApp");
    expect(app.registerGlobalShortcut("CommandOrControl+X")).toBe(false);
    expect(mocks.unregister).not.toHaveBeenCalled();
    expect(mocks.unregisterAll).not.toHaveBeenCalled();
  });
  it("unsubscribes device monitoring that registers during synchronous local revocation", async () => {
    const app = await import("./initApp");
    app.initApp();
    mocks.user = { uid: "alice" };
    mocks.loaded = true;
    mocks.device.mockImplementation((_uid, onRemoved) => {
      mocks.logout.mockImplementation(() => {
        mocks.revoked = true;
        mocks.loaded = false;
        mocks.generation++;
        mocks.revokeCallback?.();
        return Promise.reject(new Error("synthetic SDK sign-out failure"));
      });
      onRemoved();
      return mocks.deviceOff;
    });
    mocks.callback?.(mocks.user);
    await flush();
    expect(mocks.closeMain).toHaveBeenCalledOnce();
    expect(mocks.deviceOff).toHaveBeenCalledOnce();
    app.disposeApp();
    expect(mocks.deviceOff).toHaveBeenCalledOnce();
  });
  it("tears down local plaintext and resources without waiting for SDK logout", async () => {
    const app = await import("./initApp");
    app.initApp();
    mocks.user = { uid: "alice" };
    mocks.loaded = true;
    mocks.callback?.(mocks.user);
    await flush();
    mocks.send.mockClear();
    mocks.revoked = true;
    mocks.loaded = false;
    mocks.generation++;
    // Sign-out is pending or rejected: Firebase has not emitted a null user.
    mocks.revokeCallback?.();
    expect(mocks.user?.uid).toBe("alice");
    expect(mocks.send).toHaveBeenCalledWith("auth-state-changed", null);
    expect(mocks.closeMain).toHaveBeenCalledTimes(1);
    expect(mocks.closeSettings).toHaveBeenCalledTimes(1);
    expect(mocks.createAuth).toHaveBeenCalledTimes(1);
    expect(mocks.deviceOff).toHaveBeenCalledTimes(1);
    expect(mocks.unregisterAll).toHaveBeenCalledTimes(1);

    // A token refresh after failed storage/sign-out must not reload a disk key.
    mocks.callback?.(mocks.user);
    await flush();
    expect(mocks.getKey).not.toHaveBeenCalled();
    expect(mocks.createMain).toHaveBeenCalledTimes(1);
    expect(mocks.start).toHaveBeenCalledTimes(1);
    app.disposeApp();
    mocks.revokeCallback?.();
    expect(mocks.closeMain).toHaveBeenCalledTimes(1);
  });
  it("does not reopen the main window from a stale shortcut after key revocation", async () => {
    const app = await import("./initApp");
    mocks.user = { uid: "alice" };
    mocks.loaded = true;
    app.registerGlobalShortcut();
    const shortcut = mocks.register.mock.calls[0][1] as () => void;
    mocks.loaded = false;
    mocks.revoked = true;
    shortcut();
    expect(mocks.createMain).not.toHaveBeenCalled();
    expect(mocks.show).not.toHaveBeenCalled();
    expect(mocks.createAuth).toHaveBeenCalledTimes(1);
  });
  it("shows the main window after interactive login even on hidden launch", async () => {
    mocks.loaded = true;
    mocks.interactive = true;
    const app = await import("./initApp");
    app.initApp();
    mocks.user = { uid: "alice" };
    mocks.callback?.(mocks.user);
    await flush();
    expect(mocks.createMain).toHaveBeenCalledWith(true);
    app.disposeApp();
  });
});
