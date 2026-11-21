import path from "node:path";
import { electronApp } from "@electron-toolkit/utils";
import { app } from "electron";
import log from "electron-log/main";
import { configureDevTools, disposeDevTools } from "./modules/devTools";
import { disposeIPC, initIPC } from "./modules/ipc";
import { createTray } from "./modules/tray";
import { showWindow } from "./modules/window";
import { initFirebase } from "./services/firebase";
import { disposeApp, initApp } from "./services/initApp";
import { startUpdateChecks, stopUpdateChecks } from "./services/update";
import { configureDarkMode, disposeDarkMode } from "./utils/darkMode";
import { restartInX11IfNeeded } from "./utils/linuxDisplay";
import { configureLogger } from "./utils/logger";
import { configurePasswordStore } from "./utils/passwordStore";

// Configure storage before app readiness in development and packaged launches.
configurePasswordStore();

// Set up logging configuration with colors and separators
configureLogger();

restartInX11IfNeeded();

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
    app
      .whenReady()
      .then(showWindow)
      .catch(() => log.error("Failed to show application window"));

    const deepLinkUrl = commandLine.find((arg) => arg.startsWith("viclip://"));
    if (deepLinkUrl) {
      log.info("Received ViClip deep link from second instance");
    }
  });

  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient("viclip", process.execPath, [
        path.resolve(process.argv[1]),
      ]);
    }
  } else {
    app.setAsDefaultProtocolClient("viclip");
  }

  app
    .whenReady()
    .then(() => {
      log.info("Application started", { version: app.getVersion() });

      // Set app user model id for Windows notifications
      electronApp.setAppUserModelId("com.viclip.app");

      // Set login item to start at login
      app.setLoginItemSettings({
        openAtLogin: true,
        path: app.getPath("exe"),
        args: ["--hidden"],
      });

      // Initialize Firebase services first before UI and IPC rely on auth/db
      initFirebase();

      // Create system tray
      createTray();

      // Initialize all central IPC
      initIPC();

      // Initialize clipboard synchronization
      initApp();

      // Check for updates
      startUpdateChecks();

      // Configure development tools
      configureDevTools();

      // Configure dark mode
      configureDarkMode();
    })
    .catch(() => {
      log.error("Application startup failed");
      app.quit();
    });

  // Keep running in system tray when all windows are closed across all platforms
  app.on("window-all-closed", () => {
    // Intentional no-op: ViClip is a background clipboard sync tool in the system tray
  });

  // Clean up clipboard sync when quitting
  app.on("will-quit", () => {
    disposeApp();
    disposeIPC();
    disposeDevTools();
    disposeDarkMode();
    stopUpdateChecks();
  });

  // Hide dock icon on macOS for a more tray-like experience
  if (process.platform === "darwin" && app.dock) {
    app.dock.hide();
  }

  app.on("open-url", (event, url) => {
    event.preventDefault();
    if (!url.startsWith("viclip://")) return;
    log.info("Received ViClip open-url event");
    app
      .whenReady()
      .then(showWindow)
      .catch(() => log.error("Failed to show application window"));
  });
}
