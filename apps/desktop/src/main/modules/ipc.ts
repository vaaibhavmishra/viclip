import { execFile } from "node:child_process";
import os from "node:os";
import { APP_CONFIG, CLIPBOARD_CONFIG } from "@viclip/constants";
import {
  app,
  BrowserWindow,
  clipboard,
  type IpcMainEvent,
  type IpcMainInvokeEvent,
  ipcMain,
} from "electron";
import log from "electron-log/main";
import { getAuth } from "firebase/auth";
import {
  getMainWindow,
  getNotificationsEnabled,
  setNotificationsEnabled,
} from "../globalStates";
import {
  getAuthGeneration,
  loginUser,
  logoutUser,
  recoverAccountWithOldPassword,
  resetAccountData,
  resetPassword,
  signupUser,
} from "../services/auth";
import {
  getDecryptedClips,
  isClipboardSyncActive,
  startClipboardSync,
  stopClipboardSync,
  writeToClipboard,
} from "../services/clipboard";
import { encrypt, getActiveDEK, isKeyLoaded } from "../services/crypto";
import {
  getDevices,
  pinClip,
  removeAllClips,
  removeClip,
  removeDevice,
  updateClip,
} from "../services/firebase";
import { registerGlobalShortcut } from "../services/initApp";
import { settingsStorage } from "../services/settings";
import { checkUpdate } from "../services/update";
import { detectClipboardType, openSafeExternal } from "../utils/utils";
import { assertTrustedIPC } from "./ipcSecurity";
import { createSettingsWindow, hideMainWindow } from "./window";

type IPCEvent = IpcMainInvokeEvent | IpcMainEvent;
const handlers = new Set<string>();
const eventListeners = new Map<
  string,
  (event: IpcMainEvent, ...args: unknown[]) => void
>();
const pasteTimers = new Set<ReturnType<typeof setTimeout>>();
let initialized = false;
let pasteRequestGeneration = 0;

const authenticatedChannels = new Set([
  "set-shortcut",
  "open-settings",
  "toggle-clipboard-sync",
  "toggle-notifications",
  "get-devices",
  "remove-device",
  "remove-all-clips",
  "get-clips",
  "remove-clip",
  "pin-clip",
  "update-clip",
  "paste-clip",
]);

function requireSession(): string {
  const uid = getAuth().currentUser?.uid;
  if (!uid || !isKeyLoaded(uid)) {
    throw new Error("An unlocked account is required.");
  }
  return uid;
}

function validateArguments(channel: string, args: unknown[]): void {
  const text = (value: unknown, max: number, nonempty = true): boolean =>
    typeof value === "string" &&
    value.length <= max &&
    (!nonempty || value.length > 0);
  const hasControlCharacter = (value: string): boolean =>
    Array.from(value).some((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127;
    });
  const key = (value: unknown): boolean =>
    text(value, 256) &&
    !hasControlCharacter(value as string) &&
    !/[.#$[\]/]/.test(value as string);
  const password = (value: unknown): boolean => text(value, 4096);
  const email = (value: unknown): boolean =>
    text(value, 254) && (value as string).trim().length > 0;
  let valid = false;
  switch (channel) {
    case "login-user":
    case "reset-account-data":
      valid = args.length === 2 && email(args[0]) && password(args[1]);
      break;
    case "sign-up-user":
      valid =
        args.length === 3 &&
        email(args[0]) &&
        text(args[1], 256) &&
        (args[1] as string).trim().length > 0 &&
        password(args[2]);
      break;
    case "recover-account":
      valid =
        args.length === 3 &&
        email(args[0]) &&
        password(args[1]) &&
        password(args[2]);
      break;
    case "reset-password":
      valid = args.length === 1 && email(args[0]);
      break;
    case "toggle-clipboard-sync":
    case "toggle-notifications":
      valid = args.length === 1 && typeof args[0] === "boolean";
      break;
    case "remove-device":
    case "remove-clip":
      valid = args.length === 1 && key(args[0]);
      break;
    case "pin-clip":
      valid = args.length === 2 && key(args[0]) && typeof args[1] === "boolean";
      break;
    case "update-clip":
      valid =
        args.length === 2 &&
        key(args[0]) &&
        text(args[1], CLIPBOARD_CONFIG.maxContentLength) &&
        (args[1] as string).trim().length > 0;
      break;
    case "paste-clip":
      valid =
        args.length >= 1 &&
        args.length <= 2 &&
        text(args[0], CLIPBOARD_CONFIG.maxContentLength) &&
        args[0] !== "[Encrypted Content - Decryption Failed]" &&
        (args[1] === undefined || key(args[1]));
      break;
    case "set-shortcut":
      valid =
        args.length === 1 &&
        text(args[0], 256) &&
        !hasControlCharacter(args[0] as string);
      break;
    case "open-url":
      valid = args.length === 1 && text(args[0], 8192);
      break;
    default:
      valid = args.length === 0;
  }
  if (!valid) throw new Error("Invalid IPC arguments.");
}

function authorize(event: IPCEvent, channel: string, args: unknown[]): void {
  assertTrustedIPC(event);
  validateArguments(channel, args);
  if (authenticatedChannels.has(channel)) requireSession();
}

function handle<T extends unknown[]>(
  channel: string,
  callback: (event: IpcMainInvokeEvent, ...args: T) => unknown,
): void {
  ipcMain.handle(channel, (event, ...args: unknown[]) => {
    authorize(event, channel, args);
    return callback(event, ...(args as T));
  });
  handlers.add(channel);
}

function on<T extends unknown[]>(
  channel: string,
  callback: (event: IpcMainEvent, ...args: T) => unknown,
): void {
  const listener = (event: IpcMainEvent, ...args: unknown[]): void => {
    try {
      authorize(event, channel, args);
      Promise.resolve(callback(event, ...(args as T))).catch(() =>
        log.warn("IPC action failed", { channel }),
      );
    } catch {
      log.warn("Rejected IPC action", { channel });
    }
  };
  ipcMain.on(channel, listener);
  eventListeners.set(channel, listener);
}

export function disposeIPC(): void {
  pasteRequestGeneration++;
  for (const channel of handlers) ipcMain.removeHandler(channel);
  for (const [channel, listener] of eventListeners)
    ipcMain.removeListener(channel, listener);
  for (const timer of pasteTimers) clearTimeout(timer);
  handlers.clear();
  eventListeners.clear();
  pasteTimers.clear();
  initialized = false;
}

export function initIPC(): void {
  if (initialized) return;
  initialized = true;
  // IPC handler for platform
  handle("get-platform", () => process.platform);

  // Get stored shortcut
  handle("get-shortcut", () => {
    return settingsStorage.getShortcut();
  });

  // Set new shortcut
  handle("set-shortcut", (_, shortcut: string) => {
    if (!shortcut || typeof shortcut !== "string") return false;
    const previousShortcut = settingsStorage.getShortcut();
    if (!registerGlobalShortcut(shortcut)) return false;
    try {
      settingsStorage.setShortcut(shortcut);
    } catch {
      registerGlobalShortcut(previousShortcut);
      throw new Error("Failed to save global shortcut.");
    }
    return true;
  });

  on("open-settings", () => {
    createSettingsWindow();
  });

  on("hide-window", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win && !win.isDestroyed() && win.isVisible()) {
      win.hide();
      if (process.platform === "darwin") {
        app.hide();
      }
    } else {
      hideMainWindow();
    }
  });

  on("minimize-window", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win && !win.isDestroyed()) win.minimize();
  });

  on("close-window", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win && !win.isDestroyed()) win.close();
  });

  handle("toggle-clipboard-sync", (_, shouldEnable: boolean) => {
    const previousEnabled = settingsStorage.getClipboardSyncEnabled();
    settingsStorage.setClipboardSyncEnabled(shouldEnable);
    try {
      if (shouldEnable) {
        if (!startClipboardSync())
          throw new Error("Clipboard synchronization could not start.");
      } else {
        stopClipboardSync();
      }
    } catch (error) {
      settingsStorage.setClipboardSyncEnabled(previousEnabled);
      throw error;
    }
    return isClipboardSyncActive();
  });

  // Get Sync State
  handle("get-sync-state", () => {
    return isClipboardSyncActive();
  });

  // Handle notifications toggle
  handle("toggle-notifications", (_, shouldEnable: boolean) => {
    setNotificationsEnabled(shouldEnable);
    log.debug(`Notifications toggled: ${shouldEnable}`);
    return shouldEnable;
  });

  // Get notifications state
  handle("get-notifications-enabled", () => {
    return getNotificationsEnabled();
  });

  // Get the device List
  handle("get-devices", getDevices);

  // Remove device
  handle("remove-device", async (_, deviceKey: string) => {
    if (!deviceKey || typeof deviceKey !== "string") return;
    const auth = getAuth();
    const user = auth.currentUser;
    if (user) {
      await removeDevice(user.uid, deviceKey);
    }
  });

  // Remove all clips
  handle("remove-all-clips", removeAllClips);

  // Get Clips
  handle("get-clips", () => {
    return getDecryptedClips();
  });

  handle("sign-out-user", () => logoutUser());

  handle("login-user", async (_, email: string, password: string) => {
    if (!email || !password)
      throw new Error("Email and password are required.");
    await loginUser(email, password);
  });

  handle(
    "sign-up-user",
    async (_, email: string, username: string, password: string) => {
      if (!email || !username || !password) {
        throw new Error("Email, username, and password are required.");
      }
      await signupUser(email, username, password);
    },
  );

  handle("remove-clip", async (_, clipId: string) => {
    if (!clipId || typeof clipId !== "string") return;
    const auth = getAuth();
    const user = auth.currentUser;
    if (user) {
      await removeClip(user.uid, clipId);
    }
  });

  handle("pin-clip", async (_, clipId: string, pinned: boolean) => {
    if (!clipId || typeof clipId !== "string") return;
    const auth = getAuth();
    const user = auth.currentUser;
    if (user) {
      await pinClip(user.uid, clipId, pinned);
    }
  });

  handle("update-clip", async (_, clipId: string, content: string) => {
    if (!content || content.trim().length === 0) {
      throw new Error("Cannot save empty clip.");
    }

    if (content.length > CLIPBOARD_CONFIG.maxContentLength) {
      throw new Error(
        `Content exceeds maximum length of ${CLIPBOARD_CONFIG.maxContentLength} characters.`,
      );
    }

    const auth = getAuth();
    const user = auth.currentUser;
    if (user) {
      let contentToSave = content;

      if (isKeyLoaded(user.uid)) {
        // Encrypt the content before saving
        contentToSave = encrypt(content, getActiveDEK(user.uid));
      } else {
        throw new Error(
          "Encryption key not loaded. Cannot save clip securely.",
        );
      }

      const type = detectClipboardType(content, []);

      await updateClip(user.uid, clipId, {
        content: contentToSave,
        type,
        timestamp: new Date().toISOString(),
        sourceDevice: os.hostname(),
        sourceDeviceId: settingsStorage.getOrCreateDeviceId(),
      });
    }
  });

  handle("reset-password", async (_, email: string) => {
    await resetPassword(email);
  });

  handle("reset-account-data", async (_, email: string, password: string) => {
    await resetAccountData(email, password);
  });

  handle(
    "recover-account",
    async (_, email: string, currentPassword: string, oldPassword: string) => {
      await recoverAccountWithOldPassword(email, currentPassword, oldPassword);
    },
  );

  // Get Current User
  handle("get-current-user", () => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (user && isKeyLoaded(user.uid)) {
      return {
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        uid: user.uid,
      };
    }
    return null;
  });

  // Get device ID
  handle("get-device-id", () => settingsStorage.getOrCreateDeviceId());

  on("open-url", (_, url: string) => {
    if (url && typeof url === "string") {
      openSafeExternal(url);
    }
  });

  handle("paste-clip", async (event, content: string, id?: string) => {
    const uid = requireSession();
    const generation = getAuthGeneration();
    const requestGeneration = ++pasteRequestGeneration;
    for (const timer of pasteTimers) clearTimeout(timer);
    pasteTimers.clear();
    const isCurrentPaste = (): boolean =>
      initialized &&
      requestGeneration === pasteRequestGeneration &&
      generation === getAuthGeneration() &&
      getAuth().currentUser?.uid === uid &&
      isKeyLoaded(uid);
    if (content === "[Encrypted Content - Decryption Failed]") {
      log.warn("Cannot paste clip that failed decryption");
      return;
    }

    await writeToClipboard(content);
    if (
      generation !== getAuthGeneration() ||
      getAuth().currentUser?.uid !== uid ||
      !isKeyLoaded(uid)
    ) {
      throw new Error("Account changed during paste.");
    }
    if (!isCurrentPaste()) throw new Error("Paste request changed.");
    assertTrustedIPC(event);

    if (id) {
      const auth = getAuth();
      const user = auth.currentUser;
      if (user) {
        // Explicitly update timestamp to move clip to top
        updateClip(user.uid, id, {
          timestamp: new Date().toISOString(),
          sourceDevice: os.hostname() || "Desktop",
          sourceDeviceId: settingsStorage.getOrCreateDeviceId(),
        }).catch(() => {
          log.error("Failed to update clip timestamp on paste");
        });
      }
    }

    const mainWindow = getMainWindow();

    // Hide the main window to return focus to the previous application
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.hide();
      if (process.platform === "darwin") {
        app.hide(); // Hides the app and gives focus to the previous app
      } else {
        mainWindow.minimize(); // Ensure minimization on Windows/Linux
      }
    }

    if (process.platform === "darwin") {
      const timer = setTimeout(async () => {
        pasteTimers.delete(timer);
        if (!isCurrentPaste()) return;
        try {
          assertTrustedIPC(event);
          // Command-V uses the current OS clipboard, which may have changed during the delay.
          if ((await clipboard.readText()) !== content || !isCurrentPaste())
            return;
          assertTrustedIPC(event);
        } catch {
          return;
        }
        execFile(
          "osascript",
          [
            "-e",
            'tell application "System Events" to keystroke "v" using command down',
          ],
          (err) => {
            if (err) {
              log.warn(
                "Automatic paste via osascript failed (Accessibility permission may be required):",
                { code: err.code },
              );
            }
          },
        );
      }, 300);
      pasteTimers.add(timer);
    }
  });

  // Check for updates manually
  handle("check-for-updates", async () => {
    await checkUpdate({ isManual: true });
  });

  // Get current app version
  handle("get-app-version", () => app.getVersion() || APP_CONFIG.version);
}
