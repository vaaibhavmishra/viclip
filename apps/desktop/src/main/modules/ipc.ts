import { exec } from "node:child_process";
import { app, ipcMain, shell } from "electron";
import log from "electron-log/main";
import { getAuth } from "firebase/auth";
import { getMainWindow, setNotificationsEnabled } from "../globalStates";
import {
  loginUser,
  logoutUser,
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
import { createSettingsWindow } from "./window";

export function initIPC(): void {
  // IPC handler for platform
  ipcMain.handle("get-platform", () => process.platform);

  // Get stored shortcut
  ipcMain.handle("get-shortcut", () => {
    return settingsStorage.getShortcut();
  });

  // Set new shortcut
  ipcMain.handle("set-shortcut", (_, shortcut: string) => {
    settingsStorage.setShortcut(shortcut);
    registerGlobalShortcut(shortcut);
    return true;
  });

  ipcMain.on("open-settings", () => {
    createSettingsWindow();
  });

  ipcMain.handle("toggle-clipboard-sync", (_, shouldEnable: boolean) => {
    if (shouldEnable) {
      startClipboardSync();
    } else {
      stopClipboardSync();
    }
    return shouldEnable;
  });

  // Get Sync State
  ipcMain.handle("get-sync-state", () => {
    return isClipboardSyncActive();
  });

  // Handle notifications toggle
  ipcMain.on("toggle-notifications", (_, shouldEnable: boolean) => {
    setNotificationsEnabled(shouldEnable);
    if (shouldEnable) {
      // Logic to enable notifications
      log.debug("Notifications enabled");
    } else {
      // Logic to disable notifications
      log.debug("Notifications disabled");
    }
  });

  // Get the device List
  ipcMain.handle("get-devices", getDevices);

  // Remove device
  ipcMain.handle("remove-device", async (_, deviceKey: string) => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (user) {
      await removeDevice(user.uid, deviceKey);
    }
  });

  // Remove all clips
  ipcMain.handle("remove-all-clips", removeAllClips);

  // Get Clips
  ipcMain.handle("get-clips", getDecryptedClips);

  ipcMain.on("sign-out-user", () => {
    logoutUser();
  });

  ipcMain.handle("login-user", async (_, email: string, password: string) => {
    await loginUser(email, password);
  });

  ipcMain.handle(
    "sign-up-user",
    async (_, email: string, username: string, password: string) => {
      await signupUser(email, username, password);
    },
  );

  ipcMain.handle("remove-clip", async (_, clipId: string) => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (user) {
      await removeClip(user.uid, clipId);
    }
  });

  ipcMain.handle("pin-clip", async (_, clipId: string, pinned: boolean) => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (user) {
      await pinClip(user.uid, clipId, pinned);
    }
  });

  ipcMain.handle("update-clip", async (_, clipId: string, content: string) => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (user) {
      let contentToSave = content;

      if (isKeyLoaded()) {
        // Encrypt the content before saving
        contentToSave = encrypt(content, getActiveDEK());
      } else {
        throw new Error(
          "Encryption key not loaded. Cannot save clip securely.",
        );
      }

      await updateClip(user.uid, clipId, { content: contentToSave });
    }
  });

  ipcMain.handle("reset-password", async (_, email: string) => {
    await resetPassword(email);
  });

  // Get Current User
  ipcMain.handle("get-current-user", () => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (user) {
      return {
        email: user.email,
        displayName: user.displayName,
        uid: user.uid,
      };
    }
    return null;
  });

  ipcMain.on("open-url", (_, url: string) => {
    shell.openExternal(url);
  });

  ipcMain.handle("paste-clip", async (_, content: string, id?: string) => {
    writeToClipboard(content);

    if (id) {
      const auth = getAuth();
      const user = auth.currentUser;
      if (user) {
        // Explicitly update timestamp to move clip to top
        updateClip(user.uid, id, {
          timestamp: new Date().toISOString(),
          sourceDevice: process.env.computerName || "Desktop",
        });
      }
    }

    const mainWindow = getMainWindow();

    // Hide the main window to return focus to the previous application
    if (process.platform === "darwin") {
      app.hide(); // Hides the app and gives focus to the previous app
    } else {
      mainWindow?.hide();
      mainWindow?.minimize(); // Ensure minimization on Windows/Linux
    }

    if (process.platform === "darwin") {
      setTimeout(() => {
        exec(
          'osascript -e \'tell application "System Events" to keystroke "v" using command down\'',
        );
      }, 300);
    }
  });
}
