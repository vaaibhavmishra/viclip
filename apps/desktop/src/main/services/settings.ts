import log from "electron-log/main";
import { v4 as uuidv4 } from "uuid";

import { getDefaultShortcut } from "../../shared/shortcuts";
import { configStore as store } from "./configStore";

const DEFAULT_SHORTCUT = getDefaultShortcut(process.platform);

export const settingsStorage = {
  getClipboardSyncEnabled(): boolean {
    const enabled = store.get("clipboardSyncEnabled");
    return typeof enabled === "boolean" ? enabled : true;
  },

  setClipboardSyncEnabled(enabled: boolean): void {
    store.set("clipboardSyncEnabled", enabled);
  },

  /**
   * Get or generate a persistent unique ID for this device
   */
  getOrCreateDeviceId(): string {
    let deviceId = store.get("deviceId") as string | undefined;
    if (
      typeof deviceId !== "string" ||
      deviceId.length === 0 ||
      deviceId.length > 256 ||
      [...deviceId].some(
        (character) =>
          character.charCodeAt(0) <= 31 ||
          character.charCodeAt(0) === 127 ||
          ".#$[]/".includes(character),
      )
    ) {
      deviceId = uuidv4();
      store.set("deviceId", deviceId);
      log.info(`Generated new persistent device ID: ${deviceId}`);
    }
    return deviceId;
  },

  /**
   * Get the stored global shortcut
   * @returns The stored shortcut or default if not found
   */
  getShortcut(): string {
    const shortcut = store.get("globalShortcut") as string;
    return typeof shortcut === "string" &&
      shortcut.length > 0 &&
      shortcut.length <= 256 &&
      ![...shortcut].some(
        (character) =>
          character.charCodeAt(0) <= 31 || character.charCodeAt(0) === 127,
      )
      ? shortcut
      : DEFAULT_SHORTCUT;
  },

  /**
   * Set the global shortcut
   * @param shortcut The new shortcut string
   */
  setShortcut(shortcut: string): void {
    store.set("globalShortcut", shortcut);
    log.info(`Global shortcut updated to: ${shortcut}`);
  },

  /**
   * Get whether notifications are enabled
   */
  getNotificationsEnabled(): boolean {
    const enabled = store.get("notificationsEnabled") as boolean | undefined;
    return typeof enabled === "boolean" ? enabled : true;
  },

  /**
   * Set whether notifications are enabled
   */
  setNotificationsEnabled(enabled: boolean): void {
    store.set("notificationsEnabled", enabled);
    log.info(`Notifications enabled updated to: ${enabled}`);
  },
};
