import fs from "node:fs";
import path from "node:path";
import { APP_CONFIG } from "@viclip/constants";
import { app, dialog } from "electron";
import log from "electron-log/main";
import { autoUpdater } from "electron-updater";
import { showNotification } from "../modules/notification";
import { openSafeExternal } from "../utils/utils";
import { writeToClipboard } from "./clipboard";

const GITHUB_OWNER = "vaaibhavmishra";
const GITHUB_REPO = "viclip";
const HOMEBREW_TAP = `${GITHUB_OWNER}/${GITHUB_REPO}`;
const HOMEBREW_CASK = `${HOMEBREW_TAP}/viclip`;
export const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

interface GitHubAsset {
  name: string;
  browser_download_url: string;
}

interface GitHubRelease {
  tag_name: string;
  name?: string;
  html_url: string;
  body?: string;
  assets: GitHubAsset[];
}

const RELEASES_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases`;
let pendingCheck: Promise<void> | null = null;
let pendingOptions: { isManual?: boolean } | null = null;
let activeRequest: AbortController | null = null;
let updateInterval: ReturnType<typeof setInterval> | null = null;
let lastPromptedVersion: string | null = null;
const lifecycleAbort = new AbortController();
const downloadTokens = new Set<{ cancel: () => void }>();

function parseVersion(value: string): { core: number[]; pre: string[] } | null {
  if (typeof value !== "string" || value.length > 128) return null;
  const match =
    /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/i.exec(
      value,
    );
  if (!match) return null;
  const core = match.slice(1, 4).map(Number);
  const pre = match[4]?.split(".") ?? [];
  if (
    core.some((part) => !Number.isSafeInteger(part)) ||
    pre.some(
      (part) =>
        /^\d+$/.test(part) &&
        ((part.length > 1 && part.startsWith("0")) ||
          !Number.isSafeInteger(Number(part))),
    )
  )
    return null;
  return { core, pre };
}

export function parseRelease(value: unknown): GitHubRelease {
  if (!value || typeof value !== "object")
    throw new Error("Invalid release metadata.");
  const release = value as Record<string, unknown>;
  if (
    typeof release.tag_name !== "string" ||
    !parseVersion(release.tag_name) ||
    typeof release.html_url !== "string" ||
    !Array.isArray(release.assets) ||
    release.assets.length > 100 ||
    release.prerelease === true ||
    release.draft === true
  ) {
    throw new Error("Invalid release metadata.");
  }
  const tag = encodeURIComponent(release.tag_name);
  if (release.html_url !== `${RELEASES_URL}/tag/${tag}`)
    throw new Error("Untrusted release URL.");
  const assets: GitHubAsset[] = [];
  for (const asset of release.assets) {
    if (
      !asset ||
      typeof asset !== "object" ||
      typeof asset.name !== "string" ||
      asset.name.length > 256 ||
      typeof asset.browser_download_url !== "string"
    )
      throw new Error("Invalid release asset.");
    if (
      asset.browser_download_url !==
      `${RELEASES_URL}/download/${tag}/${encodeURIComponent(asset.name)}`
    )
      throw new Error("Untrusted update destination.");
    assets.push({
      name: asset.name,
      browser_download_url: asset.browser_download_url,
    });
  }
  return { tag_name: release.tag_name, html_url: release.html_url, assets };
}

export function stopUpdateChecks(): void {
  if (updateInterval) clearInterval(updateInterval);
  updateInterval = null;
  lifecycleAbort.abort();
  activeRequest?.abort();
  for (const token of downloadTokens) token.cancel();
  downloadTokens.clear();
}

async function showUpdateFailure(): Promise<void> {
  if (lifecycleAbort.signal.aborted) return;
  const result = await dialog.showMessageBox({
    type: "error",
    title: "Update Check Failed",
    message: "Unable to check for updates.",
    detail:
      "Please verify your internet connection or view the official ViClip releases.",
    buttons: ["View Releases", "Later"],
    cancelId: 1,
  });
  if (!lifecycleAbort.signal.aborted && result.response === 0)
    openSafeExternal(RELEASES_URL);
}

// Configure electron-updater logger (used primarily for Windows/Linux)
autoUpdater.logger = log;
(
  autoUpdater.logger as unknown as { transports: { file: { level: string } } }
).transports.file.level = "info";

// Download updates silently in the background on platforms supporting it (Windows NSIS)
autoUpdater.autoDownload = true;
// Install the update automatically when the app quits
autoUpdater.autoInstallOnAppQuit = true;

/**
 * Compares two semver strings (e.g., "2.1.0" vs "2.0.0", "v2.1.0" vs "2.0.0").
 * Returns true if remote is strictly newer than current.
 */
export function isNewerVersion(remote: string, current: string): boolean {
  const r = parseVersion(remote);
  const c = parseVersion(current);
  if (!r || !c) return false;
  for (let i = 0; i < 3; i++) {
    if (r.core[i] !== c.core[i]) return r.core[i] > c.core[i];
  }
  if (!r.pre.length || !c.pre.length) return !r.pre.length && c.pre.length > 0;
  for (let i = 0; i < Math.max(r.pre.length, c.pre.length); i++) {
    const a = r.pre[i];
    const b = c.pre[i];
    if (a === b) continue;
    if (a === undefined) return false;
    if (b === undefined) return true;
    const an = /^\d+$/.test(a);
    const bn = /^\d+$/.test(b);
    if (an && bn) return Number(a) > Number(b);
    if (an !== bn) return !an;
    return a > b;
  }
  return false;
}

/**
 * Checks if ViClip was installed via Homebrew Cask.
 */
export function isInstalledViaHomebrew(): boolean {
  if (process.platform !== "darwin") return false;

  const execPath = process.execPath;

  const knownCaskPaths = [
    "/opt/homebrew/Caskroom/viclip",
    "/usr/local/Caskroom/viclip",
  ];

  try {
    const resolvedExecutable = fs.realpathSync(execPath);
    const runningBundle = path.dirname(
      path.dirname(path.dirname(resolvedExecutable)),
    );
    if (path.basename(runningBundle) !== "ViClip.app") return false;
    return knownCaskPaths.some((caskPath) => {
      try {
        const receipt = JSON.parse(
          fs.readFileSync(
            path.join(caskPath, ".metadata", "INSTALL_RECEIPT.json"),
            "utf8",
          ),
        ) as { source?: { tap?: unknown; version?: unknown } };
        const version = receipt?.source?.version;
        if (
          receipt?.source?.tap !== HOMEBREW_TAP ||
          typeof version !== "string" ||
          !parseVersion(version)
        )
          return false;
        // Homebrew moves the app to its configured appdir and leaves a
        // Caskroom symlink. Compare its target with the running app bundle.
        return (
          fs.realpathSync(path.join(caskPath, version, "ViClip.app")) ===
          runningBundle
        );
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

/**
 * Checks if Homebrew is available on the macOS system.
 */
export function hasHomebrewInstalled(): boolean {
  if (process.platform !== "darwin") return false;

  const brewPaths = ["/opt/homebrew/bin/brew", "/usr/local/bin/brew"];
  return brewPaths.some((p) => fs.existsSync(p));
}

/**
 * Checks for updates on macOS via GitHub Releases API and presents
 * a combined dialog for direct DMG download or Homebrew upgrade.
 */
async function checkUpdateDarwin(options: {
  isManual?: boolean;
}): Promise<void> {
  const currentVersion = app.getVersion() || APP_CONFIG.version;
  log.info(`Checking for updates on macOS (current: v${currentVersion})...`);

  try {
    const controller = new AbortController();
    activeRequest = controller;
    const timeout = setTimeout(() => controller.abort(), 15000);
    let release: GitHubRelease;
    try {
      const response = await fetch(
        `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`,
        {
          signal: controller.signal,
          redirect: "error",
          headers: {
            "User-Agent": `ViClip/${currentVersion}`,
            Accept: "application/vnd.github.v3+json",
          },
        },
      );
      if (lifecycleAbort.signal.aborted) return;
      if (response.status === 404) {
        log.warn("No public latest release is available from GitHub");
        if (options.isManual)
          await dialog.showMessageBox({
            type: "warning",
            title: "Update Information Unavailable",
            message: "Unable to find a public release of ViClip.",
            detail:
              "A release may not have been published yet, or the release repository may be unavailable. Please visit https://github.com/vaaibhavmishra/viclip/releases to check.",
            buttons: ["OK"],
          });
        return;
      }
      if (!response.ok)
        throw new Error(`GitHub API returned HTTP ${response.status}`);
      if (
        Number(response.headers.get("content-length")) > 1000000 ||
        !response.body
      )
        throw new Error("Release metadata is too large or unavailable.");
      const reader = response.body.getReader();
      const cancelRead = (): void => {
        void reader.cancel().catch(() => undefined);
      };
      controller.signal.addEventListener("abort", cancelRead, { once: true });
      const decoder = new TextDecoder();
      let body = "";
      let bytes = 0;
      try {
        while (true) {
          const chunk = await reader.read();
          if (lifecycleAbort.signal.aborted || controller.signal.aborted)
            throw new Error("Update check cancelled.");
          if (chunk.done) break;
          bytes += chunk.value.byteLength;
          if (bytes > 1000000)
            throw new Error("Release metadata is too large.");
          body += decoder.decode(chunk.value, { stream: true });
        }
        body += decoder.decode();
        release = parseRelease(JSON.parse(body));
      } finally {
        controller.signal.removeEventListener("abort", cancelRead);
        await reader.cancel().catch(() => undefined);
        reader.releaseLock();
      }
    } finally {
      clearTimeout(timeout);
      if (activeRequest === controller) activeRequest = null;
    }
    if (lifecycleAbort.signal.aborted) return;
    const latestVersion = release?.tag_name
      ? release.tag_name.replace(/^v/i, "")
      : "";

    log.info(`Latest remote version: v${latestVersion}`);

    if (isNewerVersion(latestVersion, currentVersion)) {
      if (!options.isManual && lastPromptedVersion === latestVersion) return;
      const isHomebrew = isInstalledViaHomebrew();
      const isBrewAvailable = hasHomebrewInstalled();

      // Find matching DMG asset for current architecture (arm64 vs x64)
      const arch = process.arch === "arm64" ? "arm64" : "x64";
      const dmgAsset =
        release.assets?.find(
          (a) => a.name === `ViClip-${latestVersion}-mac-${arch}.dmg`,
        ) || null;

      const downloadUrl = dmgAsset
        ? dmgAsset.browser_download_url
        : release.html_url;

      const brewCommand = isHomebrew
        ? `brew update && brew upgrade --cask ${HOMEBREW_CASK}`
        : `brew tap ${HOMEBREW_TAP} https://github.com/${HOMEBREW_TAP}.git && brew install --cask ${HOMEBREW_CASK}`;
      const brewButton = isHomebrew
        ? "Copy Homebrew Upgrade Command"
        : "Copy Homebrew Install Command";
      const downloadButton = dmgAsset ? "Download DMG" : "View Release";

      let buttons: string[];
      let detail: string;

      if (isHomebrew) {
        buttons = [brewButton, downloadButton, "Later"];
        detail = `Quit ViClip, then run "${brewCommand}" in Terminal to update your Homebrew installation. You can also download the latest DMG directly.`;
      } else if (isBrewAvailable) {
        buttons = [downloadButton, brewButton, "Later"];
        detail = `Download the latest DMG installer, or install ViClip through Homebrew using "${brewCommand}". To switch to Homebrew, quit ViClip and move your existing app out of /Applications before installing.`;
      } else {
        buttons = [downloadButton, "View Release Notes", "Later"];
        detail = "Download the latest DMG installer to update ViClip.";
      }

      const result = await dialog.showMessageBox({
        type: "info",
        title: "ViClip Update Available",
        message: `A new version of ViClip (v${latestVersion}) is available!`,
        detail,
        buttons,
        defaultId: 0,
        cancelId: buttons.length - 1,
      });

      if (lifecycleAbort.signal.aborted) return;
      lastPromptedVersion = latestVersion;
      const selectedButton = buttons[result.response];

      if (selectedButton === brewButton) {
        await writeToClipboard(brewCommand);
        showNotification(
          "Update Command Copied",
          `Copied "${brewCommand}" to clipboard. Paste and run it in Terminal to update.`,
        );
      } else if (selectedButton === downloadButton) {
        openSafeExternal(downloadUrl);
      } else if (selectedButton === "View Release Notes") {
        openSafeExternal(release.html_url);
      }
    } else if (options.isManual) {
      await dialog.showMessageBox({
        type: "info",
        title: "ViClip Up to Date",
        message: "You're using the latest version of ViClip.",
        detail: `Current version: v${currentVersion}`,
        buttons: ["OK"],
      });
    }
  } catch (error) {
    log.warn("Failed to check for updates on macOS");
    if (options.isManual) await showUpdateFailure();
    throw error;
  }
}

/**
 * Checks for updates on Windows and Linux using electron-updater.
 */
async function checkUpdateDefault(options: {
  isManual?: boolean;
}): Promise<void> {
  const currentVersion = app.getVersion() || APP_CONFIG.version;
  try {
    log.info("Checking for updates via electron-updater...");
    const result = await autoUpdater.checkForUpdates();
    if (result?.downloadPromise) {
      const token = result.cancellationToken;
      if (token) downloadTokens.add(token);
      void result.downloadPromise
        .catch(() => {
          if (!lifecycleAbort.signal.aborted)
            log.warn("Update download failed; retry the update check.");
        })
        .finally(() => {
          if (token) downloadTokens.delete(token);
        });
      if (lifecycleAbort.signal.aborted) token?.cancel();
    }
    if (lifecycleAbort.signal.aborted) return;
    if (!result) throw new Error("Update information unavailable.");
    if (!parseVersion(result.updateInfo.version))
      throw new Error("Invalid update version.");
    if (result && isNewerVersion(result.updateInfo.version, currentVersion)) {
      log.info(
        `Update available via electron-updater: v${result.updateInfo.version}`,
      );
    } else if (options.isManual) {
      await dialog.showMessageBox({
        type: "info",
        title: "ViClip Up to Date",
        message: "You're using the latest version of ViClip.",
        detail: `Current version: v${currentVersion}`,
        buttons: ["OK"],
      });
    }
  } catch (error) {
    log.warn("Failed to check for updates via electron-updater");
    // Fallback to GitHub Releases prompt if autoUpdater fails
    if (options.isManual) await showUpdateFailure();
    throw error;
  }
}

/**
 * Check for updates
 */
export async function checkUpdate(
  options: { isManual?: boolean } = {},
): Promise<void> {
  if (lifecycleAbort.signal.aborted) return;
  if (!app.isPackaged && !options.isManual) {
    log.debug("Skipping automatic update check in development");
    return;
  }
  if (pendingCheck) {
    if (options.isManual && pendingOptions) pendingOptions.isManual = true;
    return pendingCheck;
  }
  pendingOptions = { ...options };
  pendingCheck = (
    process.platform === "darwin"
      ? checkUpdateDarwin(pendingOptions)
      : checkUpdateDefault(pendingOptions)
  ).finally(() => {
    pendingCheck = null;
    pendingOptions = null;
  });
  return pendingCheck;
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

  while (attempt < maxRetries && !lifecycleAbort.signal.aborted) {
    try {
      await checkUpdate({ isManual: false });
      return; // Success, exit
    } catch (error) {
      attempt++;
      log.warn(
        `Update check failed (attempt ${attempt}/${maxRetries})`,
        error as Error,
      );

      if (attempt < maxRetries) {
        log.debug(`Retrying update check in ${retryDelay / 1000} seconds`);
        await new Promise<void>((resolve) => {
          const finish = (): void => {
            clearTimeout(timer);
            lifecycleAbort.signal.removeEventListener("abort", finish);
            resolve();
          };
          const timer = setTimeout(finish, retryDelay);
          lifecycleAbort.signal.addEventListener("abort", finish, {
            once: true,
          });
          if (lifecycleAbort.signal.aborted) finish();
        });
      } else {
        log.error("All update check attempts failed", error as Error);
      }
    }
  }
}

/**
 * Check at startup and periodically while the packaged tray app stays running.
 */
export function startUpdateChecks(): void {
  if (!app.isPackaged || lifecycleAbort.signal.aborted || updateInterval)
    return;
  const runCheck = (): void => {
    void checkUpdateWithRetry().catch(() => {
      if (!lifecycleAbort.signal.aborted)
        log.warn("Scheduled update check failed");
    });
  };
  updateInterval = setInterval(runCheck, UPDATE_CHECK_INTERVAL_MS);
  updateInterval.unref();
  runCheck();
}

// Set up update events for electron-updater (Windows / Linux)
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

  if (lifecycleAbort.signal.aborted) return;
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
      if (!lifecycleAbort.signal.aborted && result.response === 0) {
        log.info("Restarting app to install updates...");
        autoUpdater.quitAndInstall();
      }
    })
    .catch(() => log.warn("Unable to show update restart prompt"));
});
