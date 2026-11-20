import { release } from "node:os";
import { join } from "node:path";
import { is } from "@electron-toolkit/utils";
import {
  app,
  BrowserWindow,
  type BrowserWindowConstructorOptions,
  nativeTheme,
  screen,
  session,
} from "electron";
import { getAuth } from "firebase/auth";
import windowsIcon from "../../../build/icon.ico?asset";
import AppIcon from "../../../resources/icon.png?asset";
import {
  getAuthWindow,
  getMainWindow,
  getSettingsWindow,
  setAuthWindow,
  setMainWindow,
  setSettingsWindow,
} from "../globalStates";
import { isKeyLoaded } from "../services/crypto";
import { openSafeExternal } from "../utils/utils";
import { isTrustedRendererURL } from "./ipcSecurity";

// Shared window config
function getCommonConfig(): BrowserWindowConstructorOptions {
  const isWindows = process.platform === "win32";
  const windowsBuild = isWindows ? Number(release().split(".")[2]) : 0;
  const supportsNativeCorners =
    Number.isInteger(windowsBuild) && windowsBuild >= 22000;
  const supportsAcrylic =
    Number.isInteger(windowsBuild) && windowsBuild >= 22621;
  const windowsAppearance = supportsAcrylic
    ? "windows-acrylic"
    : supportsNativeCorners
      ? "windows-solid"
      : "windows-transparent";

  return {
    icon: process.platform === "linux" ? AppIcon : windowsIcon,
    show: false,
    autoHideMenuBar: true,
    transparent: true,
    ...(process.platform === "darwin" && {
      vibrancy: "under-window",
      visualEffectState: "active",
    }),
    ...(isWindows && {
      // Per-pixel transparency prevents DWM from rounding Windows 11 windows.
      // Older Windows versions use the renderer's rounded, opaque surface instead.
      transparent: !supportsNativeCorners,
      backgroundColor:
        supportsAcrylic || !supportsNativeCorners
          ? "#00000000"
          : nativeTheme.shouldUseDarkColors
            ? "#212121"
            : "#ffffff",
      backgroundMaterial: supportsAcrylic ? "acrylic" : "none",
      roundedCorners: true,
      thickFrame: supportsNativeCorners,
      hasShadow: true,
      maximizable: false,
      fullscreenable: false,
    }),
    darkTheme: true,
    resizable: false,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      webviewTag: false,
      spellcheck: false,
      ...(isWindows && {
        additionalArguments: [
          `--viclip-window-appearance=${windowsAppearance}`,
        ],
      }),
    },
  };
}

function getSecondaryWindowConfig(): BrowserWindowConstructorOptions {
  return {
    frame: process.platform !== "darwin" && process.platform !== "win32",
    ...(process.platform === "darwin" && { titleBarStyle: "hiddenInset" }),
  };
}

let isQuitting = false;

app.on("before-quit", () => {
  isQuitting = true;
});

// Configure default session permissions
app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler(
    (_webContents, _permission, callback) => {
      // ViClip only uses system notifications
      // Notifications are created in main; the renderer needs no browser permissions.
      callback(false);
    },
  );
  session.defaultSession.setPermissionCheckHandler(() => false);
});

function setupSecureWebContents(win: BrowserWindow): void {
  win.webContents.setWindowOpenHandler((details) => {
    openSafeExternal(details.url);
    return { action: "deny" };
  });

  win.webContents.on("will-navigate", (event, url) => {
    if (!isTrustedRendererURL(url)) {
      event.preventDefault();
      openSafeExternal(url);
    }
  });

  win.webContents.on("will-frame-navigate", (event) => {
    if (!event.isMainFrame || !isTrustedRendererURL(event.url)) {
      event.preventDefault();
    }
  });

  win.webContents.on("will-redirect", (event, url) => {
    if (!isTrustedRendererURL(url)) event.preventDefault();
  });

  win.webContents.on("will-attach-webview", (event) => {
    event.preventDefault();
  });
}

function loadRoute(window: BrowserWindow, route: string): void {
  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    window
      .loadURL(
        `${process.env.ELECTRON_RENDERER_URL.replace(/\/$/, "")}/#/${route}`,
      )
      .catch(() => {
        if (!window.isDestroyed()) window.destroy();
      });
  } else {
    window
      .loadFile(join(__dirname, "../renderer/index.html"), {
        hash: `/${route}`,
      })
      .catch(() => {
        if (!window.isDestroyed()) window.destroy();
      });
  }
}

export function createAuthWindow(): void {
  const existingWindow = getAuthWindow();
  if (existingWindow && !existingWindow.isDestroyed()) {
    if (existingWindow.isMinimized()) existingWindow.restore();
    existingWindow.show();
    existingWindow.focus();
    return;
  }

  const authWindow = new BrowserWindow({
    ...getCommonConfig(),
    ...getSecondaryWindowConfig(),
    title: "ViClip - Login",
    width: 800,
    height: 600,
  });

  setAuthWindow(authWindow);

  authWindow.on("ready-to-show", () => authWindow.show());
  authWindow.on("closed", () => setAuthWindow(null));

  setupSecureWebContents(authWindow);

  loadRoute(authWindow, "auth");
}

export function createMainWindow(
  show = !process.argv.includes("--hidden"),
): void {
  const existingWindow = getMainWindow();
  if (existingWindow && !existingWindow.isDestroyed()) {
    if (existingWindow.isMinimized()) existingWindow.restore();
    existingWindow.show();
    existingWindow.focus();
    return;
  }

  const cursorPoint = screen.getCursorScreenPoint();
  const primaryDisplay = screen.getPrimaryDisplay();
  const display =
    (cursorPoint && screen.getDisplayNearestPoint(cursorPoint)) ||
    primaryDisplay;
  const workArea = display?.workArea || {
    x: 0,
    y: 0,
    width: 1024,
    height: 768,
  };
  const width = 750;
  const height = 500;
  const x = Math.round(workArea.x + (workArea.width - width) / 2);
  const y = Math.round(workArea.y + (workArea.height - height) / 2 - 45);

  const mainWindow = new BrowserWindow({
    ...getCommonConfig(),
    title: "ViClip",
    width,
    height,
    frame: false,
    x,
    y,
  });

  setMainWindow(mainWindow);

  if (show) {
    mainWindow.on("ready-to-show", () => mainWindow.show());
  }

  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on("closed", () => setMainWindow(null));

  mainWindow.on("blur", () => {
    if (
      process.platform !== "linux" &&
      !mainWindow.webContents.isDevToolsOpened()
    ) {
      mainWindow.hide();
    }
  });

  setupSecureWebContents(mainWindow);

  loadRoute(mainWindow, "main");
}

export function createSettingsWindow(): void {
  const existingWindow = getSettingsWindow();
  if (existingWindow && !existingWindow.isDestroyed()) {
    if (existingWindow.isMinimized()) existingWindow.restore();
    existingWindow.show();
    existingWindow.focus();
    return;
  }

  const settingsWindow = new BrowserWindow({
    ...getCommonConfig(),
    ...getSecondaryWindowConfig(),
    title: "ViClip - Settings",
    width: 500,
    height: 700,
    resizable: false,
  });

  setSettingsWindow(settingsWindow);

  settingsWindow.on("ready-to-show", () => settingsWindow.show());
  settingsWindow.on("closed", () => setSettingsWindow(null));

  setupSecureWebContents(settingsWindow);

  loadRoute(settingsWindow, "settings");
}

export function closeAuthWindow(): void {
  const w = getAuthWindow();
  if (w && !w.isDestroyed()) w.close();
}

export function closeMainWindow(): void {
  const w = getMainWindow();
  if (w && !w.isDestroyed()) {
    // Force close even on macOS
    w.destroy();
  }
}

export function hideMainWindow(): void {
  const mainWindow = getMainWindow();
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()) {
    mainWindow.hide();
    if (process.platform === "darwin") {
      app.hide();
    }
  }
}

export function hideWindow(): void {
  hideMainWindow();
}

export function closeSettingsWindow(): void {
  const w = getSettingsWindow();
  if (w && !w.isDestroyed()) w.close();
}

export function showWindow(): void {
  const auth = getAuth();
  const user = auth.currentUser;

  if (user && isKeyLoaded(user.uid)) {
    const mainWindow = getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    } else {
      createMainWindow(true);
    }
  } else {
    const authWindow = getAuthWindow();
    if (authWindow && !authWindow.isDestroyed()) {
      if (authWindow.isMinimized()) authWindow.restore();
      authWindow.show();
      authWindow.focus();
    } else {
      createAuthWindow();
    }
  }
}
