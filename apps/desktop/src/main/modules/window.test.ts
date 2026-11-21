import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  main: null as unknown,
  auth: null as unknown,
  settings: null as unknown,
  windows: [] as unknown[],
  user: { uid: "account-a" } as { uid: string } | null,
  keyLoaded: true,
  external: vi.fn(),
  permissionRequest: vi.fn(),
  permissionCheck: vi.fn(),
  release: vi.fn(() => "10.0.22621"),
  nativeTheme: { shouldUseDarkColors: false },
}));

const originalPlatform = process.platform;

function setPlatform(platform: NodeJS.Platform): void {
  Object.defineProperty(process, "platform", { value: platform });
}

interface WindowOptions extends Record<string, unknown> {
  webPreferences: Record<string, unknown>;
}

class Contents extends EventEmitter {
  setWindowOpenHandler = vi.fn();
  isDevToolsOpened = vi.fn(() => false);
}
class MockWindow extends EventEmitter {
  webContents = new Contents();
  show = vi.fn();
  hide = vi.fn();
  focus = vi.fn();
  restore = vi.fn();
  isMinimized = () => false;
  isVisible = () => true;
  destroyed = false;
  isDestroyed = () => this.destroyed;
  loadURL = vi.fn().mockResolvedValue(undefined);
  loadFile = vi.fn().mockResolvedValue(undefined);
  close = () => this.emit("closed");
  destroy = () => {
    this.destroyed = true;
    this.emit("closed");
  };
  constructor(public options: WindowOptions) {
    super();
    mocks.windows.push(this);
  }
}

function createMockWindow(options: WindowOptions): MockWindow {
  return new MockWindow(options);
}

vi.mock("../../../build/icon.ico?asset", () => ({ default: "icon.ico" }));
vi.mock("../../../resources/icon.png?asset", () => ({ default: "icon.png" }));
vi.mock("@electron-toolkit/utils", () => ({ is: { dev: true } }));
vi.mock("node:os", () => ({ release: mocks.release }));
vi.mock("electron", () => ({
  app: { on: vi.fn(), whenReady: () => Promise.resolve(), hide: vi.fn() },
  BrowserWindow: vi.fn(createMockWindow),
  nativeTheme: mocks.nativeTheme,
  screen: {
    getCursorScreenPoint: () => ({ x: 0, y: 0 }),
    getPrimaryDisplay: () => ({
      workArea: { x: 0, y: 0, width: 1000, height: 1000 },
    }),
    getDisplayNearestPoint: () => ({
      workArea: { x: 0, y: 0, width: 1000, height: 1000 },
    }),
  },
  session: {
    defaultSession: {
      setPermissionRequestHandler: mocks.permissionRequest,
      setPermissionCheckHandler: mocks.permissionCheck,
    },
  },
}));
vi.mock("firebase/auth", () => ({
  getAuth: () => ({ currentUser: mocks.user }),
}));
vi.mock("../globalStates", () => ({
  getMainWindow: () => mocks.main,
  setMainWindow: (window: unknown) => {
    mocks.main = window;
  },
  getAuthWindow: () => mocks.auth,
  setAuthWindow: (window: unknown) => {
    mocks.auth = window;
  },
  getSettingsWindow: () => mocks.settings,
  setSettingsWindow: (window: unknown) => {
    mocks.settings = window;
  },
}));
vi.mock("../utils/utils", () => ({ openSafeExternal: mocks.external }));
vi.mock("../services/crypto", () => ({ isKeyLoaded: () => mocks.keyLoaded }));

import {
  createAuthWindow,
  createMainWindow,
  createSettingsWindow,
  showWindow,
} from "./window";

beforeEach(() => {
  vi.stubEnv("ELECTRON_RENDERER_URL", "http://localhost:5173");
  mocks.main = null;
  mocks.auth = null;
  mocks.settings = null;
  mocks.windows.length = 0;
  mocks.user = { uid: "account-a" };
  mocks.keyLoaded = true;
  mocks.release.mockReset().mockReturnValue("10.0.22621");
  mocks.nativeTheme.shouldUseDarkColors = false;
});
afterEach(() => {
  vi.unstubAllEnvs();
  setPlatform(originalPlatform);
});

describe("main clipboard window dismissal", () => {
  it.each(["linux", "darwin", "win32"] as const)(
    "hides on focus loss on %s",
    (platform) => {
      setPlatform(platform);
      createMainWindow();
      const window = mocks.main as MockWindow;

      window.emit("blur");

      expect(window.hide).toHaveBeenCalledOnce();
      expect(window.isDestroyed()).toBe(false);
    },
  );

  it("keeps the Linux window open while inspecting developer tools", () => {
    setPlatform("linux");
    createMainWindow();
    const window = mocks.main as MockWindow;
    window.webContents.isDevToolsOpened.mockReturnValue(true);

    window.emit("blur");

    expect(window.hide).not.toHaveBeenCalled();
  });
});

describe("desktop window appearance", () => {
  it.each([
    ["10.0.26100", "windows-acrylic", false, "acrylic", true],
    ["10.0.22621", "windows-acrylic", false, "acrylic", true],
    ["10.0.22620", "windows-solid", false, "none", true],
    ["10.0.22000", "windows-solid", false, "none", true],
    ["10.0.21999", "windows-transparent", true, "none", false],
    ["10.0.19045", "windows-transparent", true, "none", false],
    ["unavailable", "windows-transparent", true, "none", false],
    ["10.0.Infinity", "windows-transparent", true, "none", false],
  ])(
    "uses %s capabilities for all three Windows windows",
    (release, appearance, transparent, material, thickFrame) => {
      setPlatform("win32");
      mocks.release.mockReturnValue(release as string);
      createAuthWindow();
      createMainWindow();
      createSettingsWindow();

      for (const window of mocks.windows as MockWindow[]) {
        expect(window.options).toMatchObject({
          frame: false,
          transparent,
          backgroundMaterial: material,
          roundedCorners: true,
          thickFrame,
          hasShadow: true,
          resizable: false,
          maximizable: false,
          fullscreenable: false,
          backgroundColor:
            appearance === "windows-solid" ? "#ffffff" : "#00000000",
        });
        expect(window.options.webPreferences).toMatchObject({
          additionalArguments: [`--viclip-window-appearance=${appearance}`],
          sandbox: true,
          contextIsolation: true,
          nodeIntegration: false,
        });
        expect(window.options).not.toHaveProperty("vibrancy");
        expect(window.options).not.toHaveProperty("titleBarStyle");
      }
    },
  );

  it.each([
    [false, "#ffffff"],
    [true, "#212121"],
  ])(
    "uses the native theme for the solid Windows 11 fallback",
    (dark, color) => {
      setPlatform("win32");
      mocks.release.mockReturnValue("10.0.22000");
      mocks.nativeTheme.shouldUseDarkColors = dark as boolean;
      createMainWindow();
      expect((mocks.main as MockWindow).options.backgroundColor).toBe(color);
    },
  );

  it("preserves macOS vibrancy and secondary window traffic lights", () => {
    setPlatform("darwin");
    createAuthWindow();
    createMainWindow();
    createSettingsWindow();
    for (const window of mocks.windows as MockWindow[]) {
      expect(window.options).toMatchObject({
        frame: false,
        transparent: true,
        vibrancy: "under-window",
        visualEffectState: "active",
      });
      expect(window.options.webPreferences).not.toHaveProperty(
        "additionalArguments",
      );
    }
    expect((mocks.auth as MockWindow).options.titleBarStyle).toBe(
      "hiddenInset",
    );
    expect((mocks.settings as MockWindow).options.titleBarStyle).toBe(
      "hiddenInset",
    );
    expect((mocks.main as MockWindow).options).not.toHaveProperty(
      "titleBarStyle",
    );
    expect(mocks.release).not.toHaveBeenCalled();
  });

  it("preserves Linux native secondary frames and the existing renderer fallback", () => {
    setPlatform("linux");
    createAuthWindow();
    createMainWindow();
    createSettingsWindow();
    expect((mocks.auth as MockWindow).options.frame).toBe(true);
    expect((mocks.settings as MockWindow).options.frame).toBe(true);
    expect((mocks.main as MockWindow).options.frame).toBe(false);
    for (const window of mocks.windows as MockWindow[]) {
      expect(window.options).toMatchObject({
        icon: "icon.png",
        transparent: true,
      });
      expect(window.options).not.toHaveProperty("backgroundMaterial");
      expect(window.options.webPreferences).not.toHaveProperty(
        "additionalArguments",
      );
    }
    expect(mocks.release).not.toHaveBeenCalled();
  });
});

describe("desktop window trust boundaries", () => {
  it("keeps each window sandboxed and isolated without Node or webviews", () => {
    createAuthWindow();
    createMainWindow();
    createSettingsWindow();
    for (const window of mocks.windows as MockWindow[]) {
      expect(window.options.webPreferences).toMatchObject({
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        nodeIntegrationInWorker: false,
        nodeIntegrationInSubFrames: false,
        webviewTag: false,
      });
    }
  });

  it("blocks foreign navigation, subframes, webviews, redirects and popups", () => {
    createMainWindow();
    const window = mocks.main as MockWindow;
    const preventDefault = vi.fn();
    window.webContents.emit(
      "will-navigate",
      { preventDefault },
      "https://example.test",
    );
    window.webContents.emit("will-frame-navigate", {
      preventDefault,
      isMainFrame: false,
      url: "http://localhost:5173/",
    });
    window.webContents.emit(
      "will-redirect",
      { preventDefault },
      "https://example.test",
    );
    window.webContents.emit("will-attach-webview", { preventDefault });
    expect(preventDefault).toHaveBeenCalledTimes(4);
    const handler = window.webContents.setWindowOpenHandler.mock.calls[0][0];
    expect(handler({ url: "javascript:alert(1)" })).toEqual({ action: "deny" });
    expect(mocks.external).toHaveBeenCalledWith("javascript:alert(1)");
  });

  it("allows navigation between local hash routes", () => {
    createMainWindow();
    const preventDefault = vi.fn();
    (mocks.main as MockWindow).webContents.emit(
      "will-navigate",
      { preventDefault },
      "http://localhost:5173/#/settings",
    );
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it("can explicitly show a newly created window after a hidden launch", () => {
    createMainWindow(false);
    const hidden = mocks.main as MockWindow;
    hidden.emit("ready-to-show");
    expect(hidden.show).not.toHaveBeenCalled();
    hidden.destroy();
    showWindow();
    const visible = mocks.main as MockWindow;
    visible.emit("ready-to-show");
    expect(visible.show).toHaveBeenCalledOnce();
  });

  it("shows authentication instead of a keyless main window", () => {
    mocks.keyLoaded = false;
    showWindow();
    expect(mocks.main).toBeNull();
    expect(mocks.auth).toBeInstanceOf(MockWindow);
  });
});
