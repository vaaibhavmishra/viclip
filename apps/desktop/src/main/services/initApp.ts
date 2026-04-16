import { globalShortcut } from 'electron';
import log from 'electron-log/main';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getMainWindow } from '../globalStates';
import {
  closeAuthWindow,
  closeMainWindow,
  closeSettingsWindow,
  createAuthWindow,
  createMainWindow
} from '../modules/window';
import { logoutUser, restoreAuthSession } from './auth';
import { startClipboardSync, stopClipboardSync } from './clipboard';
import { listenDeviceStatus } from './firebase';
import { startNetworkMonitoring } from './network';
import { settingsStorage } from './settings';

let sessionRestoreAttempted = false;
let unsubscribeDeviceStatus: (() => void) | null = null;

export function initApp(): void {
  log.debug('Initializing application');

  try {
    const auth = getAuth();

    // Monitor authentication state to start/stop synchronization based on login status
    onAuthStateChanged(auth, (user) => {
      if (user) {
        (async () => {
          try {
            log.info('Starting clipboard sync', { userId: user.uid });
            startClipboardSync();

            // Close auth window and open main window
            closeAuthWindow();
            createMainWindow();

            registerGlobalShortcut();

            // Monitor device status
            unsubscribeDeviceStatus = listenDeviceStatus(user.uid, () => {
              log.info('Device removed remotely, logging out...');
              logoutUser();
            });

            // Notify renderer that user is authenticated
            const mainWindow = getMainWindow();
            if (mainWindow) {
              mainWindow.webContents.send('auth-state-changed', user.displayName);
            }
          } catch (error) {
            log.error('Failed to setup user for clipboard sync', error);
          }
        })();
      } else {
        log.info('User logged out, stopping clipboard sync');
        stopClipboardSync();

        if (unsubscribeDeviceStatus) {
          unsubscribeDeviceStatus();
          unsubscribeDeviceStatus = null;
        }

        // Close main and settings windows, open auth window
        closeMainWindow();
        closeSettingsWindow();
        createAuthWindow();

        globalShortcut.unregisterAll();

        // Notify renderer of logout (if main window was still open, but we just closed it, so this might be redundant but safe)
        const mainWindow = getMainWindow();
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('auth-state-changed', null);
        }
      }
    });

    // Function to attempt session restoration
    const attemptSessionRestore = async (): Promise<void> => {
      if (sessionRestoreAttempted) return;

      // Mark that we've attempted to restore session
      sessionRestoreAttempted = true;

      log.info('Network is online, attempting to restore session');

      try {
        const displayName = await restoreAuthSession();
        if (displayName) {
          log.info('Previous session restored successfully', { displayName });
        } else {
          log.info('No previous session to restore');
        }
      } catch (error) {
        log.error('Failed to restore authentication session', error);
      }
    };

    // Start network monitoring to attempt session restore when online
    startNetworkMonitoring({
      onOnline: attemptSessionRestore
    });
  } catch (error) {
    log.error('Failed to initialize authentication', error);
  }
}

export function registerGlobalShortcut(shortcut?: string): void {
  // Unregister any existing shortcut first to avoid duplicates or conflicts
  globalShortcut.unregisterAll();

  const shortcutToRegister = shortcut || settingsStorage.getShortcut();

  try {
    const ret = globalShortcut.register(shortcutToRegister, () => {
      const mainWindow = getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    });

    if (!ret) {
      log.error(`Failed to register global shortcut: ${shortcutToRegister}`);
    } else {
      log.info(`Global shortcut registered: ${shortcutToRegister}`);
    }
  } catch (error) {
    log.error(`Error registering global shortcut: ${shortcutToRegister}`, error);
  }
}
