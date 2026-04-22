import { dialog } from "electron";
import log from "electron-log/main";
import { autoUpdater } from "electron-updater";

autoUpdater.logger = log;
(
  autoUpdater.logger as unknown as { transports: { file: { level: string } } }
).transports.file.level = "info";

// Download updates silently in the background
autoUpdater.autoDownload = true;
// Install the update automatically when the app quits
autoUpdater.autoInstallOnAppQuit = true;

/**
 * Check for updates
 */
export async function checkUpdate(): Promise<void> {
  try {
    log.info("Checking for updates via electron-updater...");
    await autoUpdater.checkForUpdatesAndNotify();
  } catch (error) {
    log.error("Failed to check for updates", error);
  }
}

/**
 * Check for updates with retry mechanism
 * @param maxRetries Maximum number of retry attempts
 * @param retryDelay Delay between retries in milliseconds
 */
export async function checkUpdateWithRetry(
  maxRetries = 3,
  retryDelay = 60000,
): Promise<void> {
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      await checkUpdate();
      return; // Success, exit
    } catch (error) {
      attempt++;
      log.warn(
        `Update check failed (attempt ${attempt}/${maxRetries})`,
        error as Error,
      );

      if (attempt < maxRetries) {
        log.debug(`Retrying update check in ${retryDelay / 1000} seconds`);
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      } else {
        log.error("All update check attempts failed", error as Error);
      }
    }
  }
}

// Set up update events
autoUpdater.on("checking-for-update", () => {
  log.info("Checking for update...");
});

autoUpdater.on("update-available", (info) => {
  log.info("Update available:", info);
});

autoUpdater.on("update-not-available", (info) => {
  log.info("Update not available:", info);
});

autoUpdater.on("error", (err) => {
  log.error("Error in auto-updater:", err);
});

autoUpdater.on("download-progress", (progressObj) => {
  log.info(
    `Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent}% (${progressObj.transferred}/${progressObj.total})`,
  );
});

autoUpdater.on("update-downloaded", (info) => {
  log.info("Update downloaded:", info);

  dialog
    .showMessageBox({
      type: "info",
      title: "Update Ready",
      message:
        "A new version of ViClip has been downloaded. Restart the application to apply the updates.",
      buttons: ["Restart Now", "Later"],
      defaultId: 0,
      cancelId: 1,
    })
    .then((result) => {
      if (result.response === 0) {
        log.info("Restarting app to install updates...");
        autoUpdater.quitAndInstall();
      }
    });
});
