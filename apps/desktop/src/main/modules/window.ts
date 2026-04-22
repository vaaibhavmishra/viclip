import { join } from "node:path";
import { is } from "@electron-toolkit/utils";
import { app, BrowserWindow, screen, shell } from "electron";
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

// Shared window config
const commonConfig = {
  icon: windowsIcon,
  show: false,
  autoHideMenuBar: true,
  vibrancy: "under-window" as const,
  transparent: true,
  visualEffectState: "active" as const,
  backgroundMaterial: "acrylic" as const,
  darkTheme: true,
  resizable: false,
  ...(process.platform === "linux" ? { AppIcon } : {}),
  webPreferences: {
    preload: join(__dirname, "../preload/index.js"),
    sandbox: false,
  },
};

let isQuitting = false;

app.on("before-quit", () => {
  isQuitting = true;
});

function loadRoute(window: BrowserWindow, route: string): void {
  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    window.loadURL(`${process.env.ELECTRON_RENDERER_URL}/#/${route}`);
  } else {
    window.loadFile(join(__dirname, "../renderer/index.html"), {
      hash: `/${route}`,
    });
  }
}

export function createAuthWindow(): void {
  if (getAuthWindow()) {
    getAuthWindow()?.focus();
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

  authWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  loadRoute(authWindow, "auth");
}

export function createMainWindow(): void {
  if (getMainWindow()) {
    getMainWindow()?.focus();
    return;
  }

  const display = screen.getPrimaryDisplay();
  const width = 750;
  const height = 500;
  const x = Math.round(display.bounds.x + (display.workArea.width - width) / 2);
  const y = Math.round(
    display.bounds.y + (display.workArea.height - height) / 2 - 45,
  );

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

  mainWindow.on("ready-to-show", () => mainWindow.show());

  mainWindow.on("close", (event) => {
    if (process.platform === "darwin" && !isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on("closed", () => setMainWindow(null));

  mainWindow.on("blur", () => {
    if (process.platform !== "linux") {
      mainWindow.hide();
    }
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  loadRoute(mainWindow, "main");
}

export function createSettingsWindow(): void {
  if (getSettingsWindow()) {
    getSettingsWindow()?.focus();
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

  settingsWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

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

export function closeSettingsWindow(): void {
  const w = getSettingsWindow();
  if (w && !w.isDestroyed()) w.close();
}

export function showWindow(): void {
  const auth = getAuth();
  const user = auth.currentUser;

  if (user) {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    } else {
      createMainWindow();
    }
  } else {
    const authWindow = getAuthWindow();
    if (authWindow) {
      if (authWindow.isMinimized()) authWindow.restore();
      authWindow.show();
      authWindow.focus();
    } else {
      createAuthWindow();
    }
  }
}
