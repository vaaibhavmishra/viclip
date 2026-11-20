/**
 * Preload Script
 *
 * This file runs in an isolated context before the renderer process loads.
 * It provides a secure bridge between the renderer process (frontend) and
 * main process (backend) in Electron applications.
 */

import type {
  ClipData,
  DesktopWindowAppearance,
  DeviceData,
} from "@viclip/types";
import { contextBridge, ipcRenderer } from "electron";
import type { PreloadAPI } from "./index.d";

export type { PreloadAPI } from "./index.d";

/**
 * Custom APIs exposed to the renderer process
 *
 * These methods allow the frontend to communicate with the main process
 * in a controlled and secure manner through IPC (Inter-Process Communication).
 */

const api = {
  toggleClipboardSync: (shouldEnable: boolean): Promise<boolean> =>
    ipcRenderer.invoke("toggle-clipboard-sync", shouldEnable),

  /**
   * Get the current platform of the application
   */
  getPlatform: (): Promise<string> => ipcRenderer.invoke("get-platform"),

  /**
   * Toggles notifications on or off
   *
   * @param shouldEnable Boolean indicating whether to enable or disable notifications
   */
  toggleNotifications: (shouldEnable: boolean): Promise<boolean> =>
    ipcRenderer.invoke("toggle-notifications", shouldEnable),

  /**
   * Get whether notifications are enabled
   */
  getNotificationsEnabled: (): Promise<boolean> =>
    ipcRenderer.invoke("get-notifications-enabled"),

  openSettings: (): void => {
    ipcRenderer.send("open-settings");
  },

  hideWindow: (): void => {
    ipcRenderer.send("hide-window");
  },

  minimizeWindow: (): void => {
    ipcRenderer.send("minimize-window");
  },

  closeWindow: (): void => {
    ipcRenderer.send("close-window");
  },

  // Listen for clips updates from the main process
  onClipsUpdate: (
    callback: (value: Record<string, ClipData>) => void,
  ): (() => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      value: Record<string, ClipData>,
    ) => callback(value);
    ipcRenderer.on("clips-updated", listener);
    return () => {
      ipcRenderer.removeListener("clips-updated", listener);
    };
  },

  getClips: (): Promise<Record<string, ClipData> | null> =>
    ipcRenderer.invoke("get-clips"),

  //Get Devices
  getDevices: (): Promise<Record<string, DeviceData> | null> =>
    ipcRenderer.invoke("get-devices"),

  // Get current device unique ID
  getDeviceId: (): Promise<string> => ipcRenderer.invoke("get-device-id"),

  // Remove device
  removeDevice: (deviceKey: string): Promise<void> =>
    ipcRenderer.invoke("remove-device", deviceKey),

  // Remove all clips
  removeAllClips: (): Promise<void> => ipcRenderer.invoke("remove-all-clips"),

  /**
   * Listen for authentication state changes from the main process
   */
  onAuthStateChanged: (
    callback: (displayName: string | null) => void,
  ): (() => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      displayName: string | null,
    ) => callback(displayName);
    ipcRenderer.on("auth-state-changed", listener);
    return () => {
      ipcRenderer.removeListener("auth-state-changed", listener);
    };
  },

  /**
   * Sign out the current user
   */
  signOutUser: (): Promise<void> => ipcRenderer.invoke("sign-out-user"),
  /**
   * Log in a user with email and password
   * @param email User's email address
   * @param password User's password
   */
  loginUser: (email: string, password: string): Promise<void> =>
    ipcRenderer.invoke("login-user", email, password),

  /**
   * Send a password reset email
   */
  resetPassword: (email: string): Promise<void> =>
    ipcRenderer.invoke("reset-password", email),

  /**
   * Sign up a new user with email, username, and password
   * @param email User's email address
   * @param username Desired username
   * @param password Desired password
   */
  signUpUser: (
    email: string,
    username: string,
    password: string,
  ): Promise<void> =>
    ipcRenderer.invoke("sign-up-user", email, username, password),

  resetAccountData: (email: string, password: string): Promise<void> =>
    ipcRenderer.invoke("reset-account-data", email, password),

  recoverAccount: (
    email: string,
    currentPassword: string,
    oldPassword: string,
  ): Promise<void> =>
    ipcRenderer.invoke("recover-account", email, currentPassword, oldPassword),

  /**
   * Get the current logged-in user details
   */
  getCurrentUser: (): Promise<{
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
    uid: string;
  } | null> => ipcRenderer.invoke("get-current-user"),

  /**
   * Get current clipboard sync state
   */
  getSyncState: (): Promise<boolean> => ipcRenderer.invoke("get-sync-state"),

  onSyncStateChanged: (callback: (active: boolean) => void): (() => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      active: boolean,
    ): void => callback(active);
    ipcRenderer.on("sync-state-changed", listener);
    return () => ipcRenderer.removeListener("sync-state-changed", listener);
  },

  removeClip: (id: string): Promise<void> =>
    ipcRenderer.invoke("remove-clip", id),

  pinClip: (id: string, pinned: boolean): Promise<void> =>
    ipcRenderer.invoke("pin-clip", id, pinned),

  updateClip: (id: string, content: string): Promise<void> =>
    ipcRenderer.invoke("update-clip", id, content),

  openURL: (url: string): void => ipcRenderer.send("open-url", url),
  openUrl: (url: string): void => ipcRenderer.send("open-url", url),
  pasteClip: (content: string, id?: string): Promise<void> =>
    ipcRenderer.invoke("paste-clip", content, id),

  // Shortcut management
  getShortcut: (): Promise<string> => ipcRenderer.invoke("get-shortcut"),
  setShortcut: (shortcut: string): Promise<boolean> =>
    ipcRenderer.invoke("set-shortcut", shortcut),

  // Updates & Version
  checkForUpdates: (): Promise<void> => ipcRenderer.invoke("check-for-updates"),
  getAppVersion: (): Promise<string> => ipcRenderer.invoke("get-app-version"),
} satisfies PreloadAPI;

/**
 * Context Bridge Implementation
 *
 * Exposes our defined APIs to the renderer process using Electron's contextBridge.
 * This approach maintains security through context isolation, preventing direct
 * access to Node.js APIs from the renderer process.
 */
const appearanceArgument = process.argv.find((argument) =>
  argument.startsWith("--viclip-window-appearance="),
);
const appearanceValue = appearanceArgument?.slice(
  "--viclip-window-appearance=".length,
);
const windowAppearance: DesktopWindowAppearance | undefined =
  process.platform === "win32" &&
  (appearanceValue === "windows-acrylic" ||
    appearanceValue === "windows-solid" ||
    appearanceValue === "windows-transparent")
    ? appearanceValue
    : undefined;
const safeElectron = {
  ...(windowAppearance ? { windowAppearance } : {}),
  process: {
    platform: process.platform,
    versions: process.versions,
  },
};

if (process.contextIsolated) {
  try {
    // Expose the custom APIs securely to the renderer without unrestricted ipcRenderer
    contextBridge.exposeInMainWorld("electron", safeElectron);
    contextBridge.exposeInMainWorld("api", api);
  } catch (error) {
    console.error(error);
  }
} else {
  // Fallback for when context isolation is disabled
  // This is less secure and should be avoided in production

  throw new Error("ViClip requires context isolation.");
}
