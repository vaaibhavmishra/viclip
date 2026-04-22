import path from "node:path";
import { electronApp } from "@electron-toolkit/utils";
import { app, dialog } from "electron";
import log from "electron-log/main";
import { configureDevTools } from "./modules/devTools";
import { initIPC } from "./modules/ipc";
import { createTray } from "./modules/tray";
import { showWindow } from "./modules/window";
import { stopClipboardSync } from "./services/clipboard";
import { initFirebase } from "./services/firebase";
import { initApp } from "./services/initApp";
import { stopNetworkMonitoring } from "./services/network";
import { checkUpdateWithRetry } from "./services/update";
import { configureDarkMode } from "./utils/darkMode";
import { configureLogger } from "./utils/logger";

// Set up logging configuration with colors and separators
configureLogger();

/**
 * Set up the application when Electron is ready
 */

// Set the application name for Windows and macOS
app.setName("ViClip");

// Set the application as a single instance
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  log.warn("Another instance is already running. Exiting this instance.");
  app.quit();
} else {
  app.on("second-instance", (_event, commandLine, _workingDirectory) => {
    log.info("Second instance detected. Focusing the main window.");
    showWindow();

    // the commandLine is array of strings in which last element is deep link url
    dialog.showErrorBox(
      "Welcome Back",
      `You arrived from: ${commandLine.pop()}`,
    );
  });
}

if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient("viclip", process.execPath, [
      path.resolve(process.argv[1]),
    ]);
  }
} else {
  app.setAsDefaultProtocolClient("viclip");
}

app.whenReady().then(() => {
  log.info("Application started", { version: app.getVersion() });

  // Set app user model id for Windows notifications
  electronApp.setAppUserModelId("com.viclip.app");

  // Set login item to start at login
  app.setLoginItemSettings({
    openAtLogin: true,
    path: app.getPath("exe"),
    args: [
      "--processStart",
      "app.exe",
      "--processArgv",
      "ViClip.exe",
      "--hidden",
    ],
  });

  // Create system tray
  createTray();

  // Initialize all central IPC
  initIPC();

  // Initialize Firebase services
  initFirebase();

  // Initialize clipboard synchronization
  initApp();

  // Check for updates
  checkUpdateWithRetry();

  // Configure development tools
  configureDevTools();

  // Configure dark mode
  configureDarkMode();
});

// Handle window-all-closed event
app.on("window-all-closed", () => {
  // On macOS, applications typically stay running even when all windows are closed
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// Clean up clipboard sync when quitting
app.on("will-quit", () => {
  stopClipboardSync();
  stopNetworkMonitoring();
});

// Hide dock icon on macOS for a more tray-like experience
if (process.platform === "darwin" && app.dock) {
  app.dock.hide();
}

app.on("open-url", (_event, _url) => {
  // dialog.showErrorBox('Welcome Back', `You arrived from: ${url}`)
  showWindow();
});
