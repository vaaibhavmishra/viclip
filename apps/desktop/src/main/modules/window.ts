import { join } from "node:path";
import { is } from "@electron-toolkit/utils";
import { app, BrowserWindow, screen, session } from "electron";
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
const commonConfig = {
  icon: process.platform === "linux" ? AppIcon : windowsIcon,
  show: false,
  autoHideMenuBar: true,
  vibrancy: "under-window" as const,
  transparent: true,
  visualEffectState: "active" as const,
  backgroundMaterial: "acrylic" as const,
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
  },
};

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
    ...commonConfig,
    title: "ViClip - Login",
    width: 800,
    height: 600,
    frame: process.platform !== "darwin",
    titleBarStyle: "hiddenInset",
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
    ...commonConfig,
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
    ...commonConfig,
    title: "ViClip - Settings",
    width: 500,
    height: 700,
    resizable: false,
    frame: process.platform !== "darwin",
    titleBarStyle: "hiddenInset",
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
