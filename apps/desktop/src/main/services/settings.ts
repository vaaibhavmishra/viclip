import { Conf } from "electron-conf/main";
import log from "electron-log/main";

const store = new Conf();

const DEFAULT_SHORTCUT = "CommandOrControl+Shift+V";

export const settingsStorage = {
  /**
   * Get the stored global shortcut
   * @returns The stored shortcut or default if not found
   */
  getShortcut(): string {
    const shortcut = store.get("globalShortcut") as string;
    return shortcut || DEFAULT_SHORTCUT;
  },

  /**
   * Set the global shortcut
   * @param shortcut The new shortcut string
   */
  setShortcut(shortcut: string): void {
    store.set("globalShortcut", shortcut);
    log.info(`Global shortcut updated to: ${shortcut}`);
  },
};
