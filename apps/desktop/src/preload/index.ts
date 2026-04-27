/**
 * Preload Script
 *
 * This file runs in an isolated context before the renderer process loads.
 * It provides a secure bridge between the renderer process (frontend) and
 * main process (backend) in Electron applications.
 */

import { electronAPI } from "@electron-toolkit/preload";
import type { ClipData, DeviceData } from "@viclip/types";
import { contextBridge, ipcRenderer } from "electron";

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
  toggleNotifications: (shouldEnable: boolean): void => {
    ipcRenderer.send("toggle-notifications", shouldEnable);
  },

  openSettings: (): void => {
    ipcRenderer.send("open-settings");
  },

  // Listen for clips updates from the main process
  onClipsUpdate: (callback: (value: ClipData) => void): void => {
    ipcRenderer.on("clips-updated", (_event, value) => callback(value));
  },

  getClips: (): Promise<Record<string, ClipData> | null> =>
    ipcRenderer.invoke("get-clips"),

  //Get Devices
  getDevices: (): Promise<Record<string, DeviceData> | null> =>
    ipcRenderer.invoke("get-devices"),

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
  ): void => {
    ipcRenderer.on("auth-state-changed", (_event, displayName) =>
      callback(displayName),
    );
  },

  /**
   * Sign out the current user
   */
  signOutUser: (): void => ipcRenderer.send("sign-out-user"),
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

  /**
   * Sign up a new user with email, username, and password

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

  /**
   * Get the current logged-in user details
   */
  getCurrentUser: (): Promise<{
    email: string | null;
    displayName: string | null;
    uid: string;
  } | null> => ipcRenderer.invoke("get-current-user"),

  /**
   * Get current clipboard sync state
   */
  getSyncState: (): Promise<boolean> => ipcRenderer.invoke("get-sync-state"),

  removeClip: (id: string): Promise<void> =>
    ipcRenderer.invoke("remove-clip", id),

  pinClip: (id: string, pinned: boolean): Promise<void> =>
    ipcRenderer.invoke("pin-clip", id, pinned),

  updateClip: (id: string, content: string): Promise<void> =>
    ipcRenderer.invoke("update-clip", id, content),

  openUrl: (url: string): void => ipcRenderer.send("open-url", url),
  pasteClip: (content: string, id?: string): Promise<void> =>
    ipcRenderer.invoke("paste-clip", content, id),

  // Shortcut management
  getShortcut: (): Promise<string> => ipcRenderer.invoke("get-shortcut"),
  setShortcut: (shortcut: string): Promise<boolean> =>
    ipcRenderer.invoke("set-shortcut", shortcut),
};

/**
 * Context Bridge Implementation
 *
 * Exposes our defined APIs to the renderer process using Electron's contextBridge.
 * This approach maintains security through context isolation, preventing direct
 * access to Node.js APIs from the renderer process.
 */
if (process.contextIsolated) {
  try {
    // Expose the custom APIs and electronAPI securely to the renderer
    contextBridge.exposeInMainWorld("electron", electronAPI);
    contextBridge.exposeInMainWorld("api", api);
  } catch (error) {
    console.error(error);
  }
} else {
  // Fallback for when context isolation is disabled
  // This is less secure and should be avoided in production

  // biome-ignore lint/suspicious/noTsIgnore: <suppress>
  // @ts-ignore - window augmentation defined in renderer .d.ts
  window.electron = electronAPI;
  // biome-ignore lint/suspicious/noTsIgnore: <suppress>
  // @ts-ignore - window augmentation defined in renderer .d.ts
  window.api = api;
}
