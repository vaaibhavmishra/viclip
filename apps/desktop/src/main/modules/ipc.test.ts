import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  development: true,
  handlers: new Map<string, (event: unknown, ...args: unknown[]) => unknown>(),
  listeners: new Map<string, (event: unknown, ...args: unknown[]) => unknown>(),
  user: {
    uid: "account-a",
    email: "synthetic@example.test",
    displayName: "Synthetic",
    photoURL: null,
  } as {
    uid: string;
    email: string;
    displayName: string;
    photoURL: null;
  } | null,
  keyUser: "account-a",
  generation: 0,
  mainWindow: null as unknown,
  removed: vi.fn(),
  updated: vi.fn(),
  loggedOut: vi.fn(),
  writeClipboard: vi.fn(),
  readClipboard: vi.fn(),
  shortcut: vi.fn(),
  setShortcut: vi.fn(),
  execFile: vi.fn(),
  openURL: vi.fn(),
  startSync: vi.fn(),
  stopSync: vi.fn(),
  setSyncEnabled: vi.fn(),
}));

vi.mock("node:child_process", () => ({ execFile: mocks.execFile }));
vi.mock("@electron-toolkit/utils", () => ({
  is: {
    get dev() {
      return mocks.development;
    },
  },
}));
vi.mock("electron", () => ({
  app: { hide: vi.fn(), getVersion: () => "2.0.0" },
  clipboard: { readText: mocks.readClipboard },
  BrowserWindow: { fromWebContents: () => mocks.mainWindow },
  ipcMain: {
    handle: (
      channel: string,
      callback: (event: unknown, ...args: unknown[]) => unknown,
    ) => {
      mocks.handlers.set(channel, callback);
    },
    on: (
      channel: string,
      callback: (event: unknown, ...args: unknown[]) => unknown,
    ) => {
      mocks.listeners.set(channel, callback);
    },
    removeHandler: (channel: string) => {
      mocks.handlers.delete(channel);
    },
    removeListener: (channel: string) => {
      mocks.listeners.delete(channel);
    },
  },
}));
vi.mock("electron-log/main", () => ({
  default: { warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("firebase/auth", () => ({
  getAuth: () => ({ currentUser: mocks.user }),
}));
vi.mock("../globalStates", () => ({
  getMainWindow: () => mocks.mainWindow,
  getAuthWindow: () => null,
  getSettingsWindow: () => null,
  getNotificationsEnabled: () => true,
  setNotificationsEnabled: vi.fn(),
}));
vi.mock("../services/auth", () => ({
  getAuthGeneration: () => mocks.generation,
  loginUser: vi.fn(),
  logoutUser: mocks.loggedOut,
  recoverAccountWithOldPassword: vi.fn(),
  resetAccountData: vi.fn(),
  resetPassword: vi.fn(),
  signupUser: vi.fn(),
}));
vi.mock("../services/clipboard", () => ({
  getDecryptedClips: vi.fn(),
  isClipboardSyncActive: () => false,
  startClipboardSync: mocks.startSync,
  stopClipboardSync: mocks.stopSync,
  writeToClipboard: mocks.writeClipboard,
}));
vi.mock("../services/crypto", () => ({
  encrypt: () => "encrypted",
  getActiveDEK: () => Buffer.alloc(32),
  isKeyLoaded: (uid: string) => mocks.keyUser === uid,
}));
vi.mock("../services/firebase", () => ({
  getDevices: vi.fn(),
  pinClip: vi.fn(),
  removeAllClips: vi.fn(),
  removeClip: mocks.removed,
  removeDevice: vi.fn(),
  updateClip: mocks.updated,
}));
vi.mock("../services/initApp", () => ({
  registerGlobalShortcut: mocks.shortcut,
}));
vi.mock("../services/settings", () => ({
  settingsStorage: {
    getShortcut: () => "CommandOrControl+Shift+V",
    setShortcut: mocks.setShortcut,
    getClipboardSyncEnabled: () => true,
    setClipboardSyncEnabled: mocks.setSyncEnabled,
    getOrCreateDeviceId: () => "synthetic-device",
  },
}));
vi.mock("../services/update", () => ({ checkUpdate: vi.fn() }));
vi.mock("../utils/utils", () => ({
  detectClipboardType: () => "text",
  openSafeExternal: mocks.openURL,
}));
vi.mock("./window", () => ({
  createSettingsWindow: vi.fn(),
  hideMainWindow: vi.fn(),
}));

import { disposeIPC, initIPC } from "./ipc";
import { isTrustedRendererURL } from "./ipcSecurity";

const platformDescriptor = Object.getOwnPropertyDescriptor(process, "platform");
function useMacOS(): void {
  Object.defineProperty(process, "platform", {
    value: "darwin",
    configurable: true,
  });
}

function event() {
  const frame = { url: "http://localhost:5173/#/main" };
  const sender = { isDestroyed: () => false, mainFrame: frame };
  mocks.mainWindow = {
    isDestroyed: () => false,
    webContents: sender,
    hide: vi.fn(),
    minimize: vi.fn(),
  };
  return { sender, senderFrame: frame };
}

function invoke(channel: string, sender: unknown, ...args: unknown[]): unknown {
  const handler = mocks.handlers.get(channel);
  if (!handler) throw new Error("Missing handler");
  return handler(sender, ...args);
}

beforeEach(() => {
  vi.stubEnv("ELECTRON_RENDERER_URL", "http://localhost:5173");
  mocks.development = true;
  mocks.user = {
    uid: "account-a",
    email: "synthetic@example.test",
    displayName: "Synthetic",
    photoURL: null,
  };
  mocks.keyUser = "account-a";
  mocks.generation = 0;
  mocks.writeClipboard.mockResolvedValue(undefined);
  mocks.readClipboard.mockResolvedValue("synthetic");
  mocks.updated.mockResolvedValue(undefined);
  mocks.shortcut.mockReturnValue(true);
  mocks.startSync.mockReturnValue(true);
  initIPC();
});
afterEach(() => {
  disposeIPC();
  vi.unstubAllEnvs();
  vi.useRealTimers();
  if (platformDescriptor)
    Object.defineProperty(process, "platform", platformDescriptor);
});

describe("privileged IPC authorization", () => {
  it("accepts only the configured renderer document, allowing its hash routes", () => {
    expect(isTrustedRendererURL("http://localhost:5173/#/settings")).toBe(true);
    for (const url of [
      "https://example.test/",
      "http://localhost:5173/?secret=1",
      "http://localhost:5173/other",
      "javascript:alert(1)",
    ]) {
      expect(isTrustedRendererURL(url)).toBe(false);
    }
    expect(invoke("get-platform", event())).toBe(process.platform);
  });

  it("trusts only the packaged renderer file in production, even with a dev URL configured", () => {
    mocks.development = false;
    const local = pathToFileURL(join(__dirname, "../renderer/index.html")).href;
    expect(isTrustedRendererURL(`${local}#/main`)).toBe(true);
    expect(isTrustedRendererURL(`${local}?unexpected=1`)).toBe(false);
    expect(
      isTrustedRendererURL(
        pathToFileURL(join(__dirname, "../renderer/other.html")).href,
      ),
    ).toBe(false);
    expect(isTrustedRendererURL("http://localhost:5173/#/main")).toBe(false);
  });

  it("rejects foreign webContents even with the correct application URL", () => {
    const original = event();
    const foreign = { ...original, sender: { ...original.sender } };
    expect(() => invoke("remove-clip", foreign, "clip-1")).toThrow(
      "Unauthorized",
    );
    expect(mocks.removed).not.toHaveBeenCalled();
  });

  it("rejects subframes, missing frames, destroyed senders and navigated renderers", () => {
    const original = event();
    for (const invalid of [
      { ...original, senderFrame: { url: original.senderFrame.url } },
      { ...original, senderFrame: null },
    ]) {
      expect(() => invoke("get-platform", invalid)).toThrow("Unauthorized");
    }
    original.senderFrame.url = "https://example.test/";
    expect(() => invoke("get-platform", original)).toThrow("Unauthorized");
    original.senderFrame.url = "http://localhost:5173/";
    original.sender.isDestroyed = () => true;
    expect(() => invoke("get-platform", original)).toThrow("Unauthorized");
  });

  it("requires a key belonging to the authenticated account", () => {
    const sender = event();
    mocks.keyUser = "account-b";
    expect(() => invoke("remove-clip", sender, "clip-1")).toThrow(
      "unlocked account",
    );
    expect(invoke("get-current-user", sender)).toBeNull();
    mocks.user = null;
    expect(() => invoke("remove-clip", sender, "clip-1")).toThrow(
      "unlocked account",
    );
    expect(mocks.removed).not.toHaveBeenCalled();
  });

  it.each([
    "../other",
    "a/b",
    "a.b",
    "a#b",
    "a$b",
    "a[b]",
    `a${String.fromCharCode(0)}b`,
    "",
    1,
    {},
    "a".repeat(257),
  ])("rejects malformed database key %j", (key) => {
    expect(() => invoke("remove-clip", event(), key)).toThrow(
      "Invalid IPC arguments",
    );
    expect(mocks.removed).not.toHaveBeenCalled();
  });

  it("rejects incorrect types, excess arguments and oversized content", () => {
    const sender = event();
    for (const [channel, args] of [
      ["toggle-clipboard-sync", ["true"]],
      ["pin-clip", ["clip-1", 1]],
      ["get-platform", ["unexpected"]],
      ["login-user", ["a@example.test", "password", "extra"]],
      ["update-clip", ["clip-1", "a".repeat(1000001)]],
      ["paste-clip", ["[Encrypted Content - Decryption Failed]"]],
    ] as Array<[string, unknown[]]>) {
      expect(() => invoke(channel, sender, ...args)).toThrow(
        "Invalid IPC arguments",
      );
    }
  });

  it("persists disabled synchronization before stopping it", () => {
    expect(invoke("toggle-clipboard-sync", event(), false)).toBe(false);
    expect(mocks.setSyncEnabled).toHaveBeenCalledExactlyOnceWith(false);
    expect(mocks.stopSync).toHaveBeenCalledOnce();
  });

  it("does not change synchronization when preference storage fails", () => {
    mocks.setSyncEnabled.mockImplementationOnce(() => {
      throw new Error("synthetic storage failure");
    });
    expect(() => invoke("toggle-clipboard-sync", event(), false)).toThrow();
    expect(mocks.stopSync).not.toHaveBeenCalled();
  });

  it("restores the saved preference and reports synchronization startup failure", () => {
    mocks.startSync.mockReturnValue(false);
    expect(() => invoke("toggle-clipboard-sync", event(), true)).toThrow(
      "could not start",
    );
    expect(mocks.setSyncEnabled.mock.calls).toEqual([[true], [true]]);
  });

  it("does not persist a shortcut when registration fails", () => {
    mocks.shortcut.mockReturnValue(false);
    expect(invoke("set-shortcut", event(), "Control+Shift+V")).toBe(false);
    expect(mocks.setShortcut).not.toHaveBeenCalled();
  });

  it("restores the previous shortcut when persistence fails", () => {
    mocks.setShortcut.mockImplementationOnce(() => {
      throw new Error("synthetic disk error");
    });
    expect(() => invoke("set-shortcut", event(), "Control+Shift+V")).toThrow(
      "Failed to save global shortcut",
    );
    expect(mocks.shortcut.mock.calls).toEqual([
      ["Control+Shift+V"],
      ["CommandOrControl+Shift+V"],
    ]);
  });

  it("cancels scheduled macOS paste commands on logout and teardown", async () => {
    vi.useFakeTimers();
    const sender = event();
    await invoke("paste-clip", sender, "synthetic");
    if (process.platform === "darwin") expect(vi.getTimerCount()).toBe(1);
    mocks.generation++;
    await vi.advanceTimersByTimeAsync(300);
    expect(mocks.execFile).not.toHaveBeenCalled();
    await invoke("paste-clip", sender, "synthetic");
    disposeIPC();
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(300);
    expect(mocks.execFile).not.toHaveBeenCalled();
  });

  it("propagates clipboard write failure and cancels a stale paste completion", async () => {
    const sender = event();
    mocks.writeClipboard.mockRejectedValueOnce(
      new Error("clipboard unavailable"),
    );
    await expect(
      invoke("paste-clip", sender, "synthetic") as Promise<void>,
    ).rejects.toThrow("clipboard unavailable");
    let done!: () => void;
    mocks.writeClipboard.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          done = resolve;
        }),
    );
    const pending = invoke(
      "paste-clip",
      sender,
      "synthetic",
      "clip-1",
    ) as Promise<void>;
    mocks.generation++;
    done();
    await expect(pending).rejects.toThrow("Account changed");
    expect(mocks.updated).not.toHaveBeenCalled();
    expect(mocks.execFile).not.toHaveBeenCalled();
  });

  it("supersedes prior native paste commands when another clip is selected", async () => {
    useMacOS();
    vi.useFakeTimers();
    const sender = event();
    await invoke("paste-clip", sender, "first");
    await invoke("paste-clip", sender, "second");
    mocks.readClipboard.mockResolvedValue("second");
    await vi.advanceTimersByTimeAsync(300);
    expect(mocks.execFile).toHaveBeenCalledOnce();
  });

  it("does not paste a clipboard that changed after the selected clip was written", async () => {
    useMacOS();
    vi.useFakeTimers();
    await invoke("paste-clip", event(), "synthetic");
    mocks.readClipboard.mockResolvedValue("new external or remote copy");
    await vi.advanceTimersByTimeAsync(300);
    expect(mocks.execFile).not.toHaveBeenCalled();
  });

  it("fails closed when the clipboard cannot be checked before native paste", async () => {
    useMacOS();
    vi.useFakeTimers();
    await invoke("paste-clip", event(), "synthetic");
    mocks.readClipboard.mockRejectedValue(
      new Error("synthetic clipboard error"),
    );
    await vi.advanceTimersByTimeAsync(300);
    expect(mocks.execFile).not.toHaveBeenCalled();
  });

  it("does not let a superseded clipboard write completion schedule a stale paste", async () => {
    useMacOS();
    vi.useFakeTimers();
    let complete!: () => void;
    mocks.writeClipboard.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          complete = resolve;
        }),
    );
    const sender = event();
    const first = invoke(
      "paste-clip",
      sender,
      "first",
      "clip-1",
    ) as Promise<void>;
    const rejection = expect(first).rejects.toThrow("Paste request changed");
    await invoke("paste-clip", sender, "second", "clip-2");
    complete();
    await rejection;
    expect(mocks.updated).toHaveBeenCalledExactlyOnceWith(
      "account-a",
      "clip-2",
      expect.any(Object),
    );
    mocks.readClipboard.mockResolvedValue("second");
    await vi.advanceTimersByTimeAsync(300);
    expect(mocks.execFile).toHaveBeenCalledOnce();
  });

  it("cancels a paste whose clipboard write completes after IPC disposal", async () => {
    useMacOS();
    vi.useFakeTimers();
    let complete!: () => void;
    mocks.writeClipboard.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          complete = resolve;
        }),
    );
    const sender = event();
    const pending = invoke(
      "paste-clip",
      sender,
      "synthetic",
      "clip-1",
    ) as Promise<void>;
    const rejection = expect(pending).rejects.toThrow("Paste request changed");
    disposeIPC();
    complete();
    await rejection;
    expect(mocks.updated).not.toHaveBeenCalled();
    expect(
      (mocks.mainWindow as { hide: ReturnType<typeof vi.fn> }).hide,
    ).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(300);
    expect(mocks.execFile).not.toHaveBeenCalled();
  });

  it("rechecks cancellation after an asynchronous clipboard read", async () => {
    useMacOS();
    vi.useFakeTimers();
    let complete!: (content: string) => void;
    mocks.readClipboard.mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          complete = resolve;
        }),
    );
    await invoke("paste-clip", event(), "synthetic");
    await vi.advanceTimersByTimeAsync(300);
    expect(mocks.readClipboard).toHaveBeenCalledOnce();
    disposeIPC();
    complete("synthetic");
    await Promise.resolve();
    expect(mocks.execFile).not.toHaveBeenCalled();
  });

  it("initializes once and removes only its own handlers, listeners and paste timers", async () => {
    const count = mocks.handlers.size;
    initIPC();
    expect(mocks.handlers.size).toBe(count);
    expect(mocks.listeners.size).toBe(3);
    disposeIPC();
    expect(mocks.handlers.size).toBe(0);
    expect(mocks.listeners.size).toBe(0);
    initIPC();
    expect(mocks.handlers.size).toBe(count);
  });

  it("rejects unauthorized fire-and-forget events without invoking native actions", () => {
    const sender = event();
    const original = { ...sender, senderFrame: null };
    mocks.listeners.get("open-url")?.(original, "https://example.test/");
    expect(mocks.openURL).not.toHaveBeenCalled();
  });
});
