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
}));

class Contents extends EventEmitter {
  setWindowOpenHandler = vi.fn();
  isDevToolsOpened = () => false;
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
  constructor(public options: { webPreferences: Record<string, unknown> }) {
    super();
    mocks.windows.push(this);
  }
}

function createMockWindow(options: {
  webPreferences: Record<string, unknown>;
}): MockWindow {
  return new MockWindow(options);
}

vi.mock("../../../build/icon.ico?asset", () => ({ default: "icon.ico" }));
vi.mock("../../../resources/icon.png?asset", () => ({ default: "icon.png" }));
vi.mock("@electron-toolkit/utils", () => ({ is: { dev: true } }));
vi.mock("electron", () => ({
  app: { on: vi.fn(), whenReady: () => Promise.resolve(), hide: vi.fn() },
  BrowserWindow: vi.fn(createMockWindow),
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
});
afterEach(() => vi.unstubAllEnvs());

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
