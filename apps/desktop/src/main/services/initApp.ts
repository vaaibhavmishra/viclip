import { globalShortcut } from "electron";
import log from "electron-log/main";
import { getAuth, onIdTokenChanged } from "firebase/auth";
import { clearCachedClips, getMainWindow } from "../globalStates";
import {
  closeAuthWindow,
  closeMainWindow,
  closeSettingsWindow,
  createAuthWindow,
  createMainWindow,
} from "../modules/window";
import {
  getAuthGeneration,
  invalidateAuthWork,
  isAuthenticationPending,
  isInteractiveAuthSession,
  isSessionRevoked,
  logoutUser,
  restoreAuthSession,
  subscribeSessionRevoked,
} from "./auth";
import { startClipboardSync, stopClipboardSync } from "./clipboard";
import {
  clearActiveDEK,
  isKeyLoaded,
  setActiveDEK,
  waitForKeyLoaded,
} from "./crypto";
import { listenDeviceStatus } from "./firebase";
import { startNetworkMonitoring, stopNetworkMonitoring } from "./network";
import { authStorage } from "./secureStorage";
import { settingsStorage } from "./settings";

let sessionRestoreAttempted = false;
let unsubscribeDeviceStatus: (() => void) | null = null;
let activeUserId: string | null = null;
let unsubscribeAuth: (() => void) | null = null;
let unsubscribeSessionRevoked: (() => void) | null = null;
let initializationEpoch = 0;
let activeGeneration = -1;
let authStateRevision = 0;
let registeredShortcut: string | null = null;

export function disposeApp(): void {
  initializationEpoch++;
  invalidateAuthWork();
  unsubscribeAuth?.();
  unsubscribeAuth = null;
  unsubscribeSessionRevoked?.();
  unsubscribeSessionRevoked = null;
  unsubscribeDeviceStatus?.();
  unsubscribeDeviceStatus = null;
  activeUserId = null;
  activeGeneration = -1;
  sessionRestoreAttempted = false;
  stopClipboardSync();
  stopNetworkMonitoring();
  globalShortcut.unregisterAll();
  registeredShortcut = null;
  clearActiveDEK();
  clearCachedClips();
}

function clearAuthenticatedSession(): void {
  authStateRevision++;
  activeUserId = null;
  activeGeneration = -1;
  clearActiveDEK();
  clearCachedClips();
  stopClipboardSync();
  unsubscribeDeviceStatus?.();
  unsubscribeDeviceStatus = null;
  globalShortcut.unregisterAll();
  registeredShortcut = null;

  const mainWindow = getMainWindow();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("auth-state-changed", null);
  }
  closeMainWindow();
  closeSettingsWindow();
  createAuthWindow();
}

export function initApp(): void {
  if (unsubscribeAuth) return;
  const epoch = ++initializationEpoch;
  log.debug("Initializing application");

  try {
    const auth = getAuth();
    unsubscribeSessionRevoked = subscribeSessionRevoked(() => {
      if (epoch === initializationEpoch) clearAuthenticatedSession();
    });

    // Monitor authentication state to start/stop synchronization based on login status
    // Same-UID sign-in emits a token change; auth-state changes alone omit it.
    unsubscribeAuth = onIdTokenChanged(auth, (user) => {
      if (epoch !== initializationEpoch) return;
      const generation = getAuthGeneration();
      const revision = ++authStateRevision;
      if (user) {
        // Requested logout stays locked even if SDK persistence/sign-out fails.
        if (isSessionRevoked()) return;
        // If the user is already initialized, just update UI on token refresh without stealing focus
        if (
          activeUserId === user.uid &&
          activeGeneration === generation &&
          isKeyLoaded(user.uid)
        ) {
          const mainWindow = getMainWindow();
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send(
              "auth-state-changed",
              user.displayName || user.email || "User",
            );
          }
          return;
        }

        stopClipboardSync();
        unsubscribeDeviceStatus?.();
        unsubscribeDeviceStatus = null;
        if (activeUserId !== user.uid) {
          if (!isKeyLoaded(user.uid)) clearActiveDEK();
          clearCachedClips();
        }
        activeUserId = null;
        (async () => {
          try {
            // Ensure encryption key is loaded
            if (!isKeyLoaded(user.uid)) {
              const masterKey = isAuthenticationPending()
                ? null
                : await authStorage.getMasterKey(user.uid);
              if (
                epoch !== initializationEpoch ||
                revision !== authStateRevision ||
                generation !== getAuthGeneration() ||
                auth.currentUser?.uid !== user.uid
              ) {
                return;
              }
              if (!isKeyLoaded(user.uid) && masterKey) {
                setActiveDEK(masterKey, user.uid);
                log.info("Master encryption key loaded on token change");
              } else if (!isKeyLoaded(user.uid)) {
                // If not in storage, an interactive login/recovery might be deriving it right now
                log.info(
                  "Master key not in storage yet; waiting for in-flight auth...",
                );
                const loaded = await waitForKeyLoaded(10000, user.uid);
                if (!loaded) {
                  if (
                    epoch === initializationEpoch &&
                    revision === authStateRevision &&
                    generation === getAuthGeneration() &&
                    auth.currentUser?.uid === user.uid
                  ) {
                    log.warn(
                      "User authenticated but master key not found within timeout. Logging out.",
                    );
                    await logoutUser();
                  }
                  return;
                }
              }
            }

            // Verify user hasn't changed or signed out during the wait
            if (
              epoch !== initializationEpoch ||
              revision !== authStateRevision ||
              generation !== getAuthGeneration() ||
              auth.currentUser?.uid !== user.uid
            ) {
              log.info("Auth user changed or signed out while waiting for key");
              return;
            }

            if (activeUserId === user.uid && activeGeneration === generation)
              return;
            activeUserId = user.uid;
            activeGeneration = generation;
            log.info("Starting clipboard sync", { userId: user.uid });
            if (settingsStorage.getClipboardSyncEnabled()) startClipboardSync();

            // Close auth window and open main window
            closeAuthWindow();
            createMainWindow(isInteractiveAuthSession() ? true : undefined);

            registerGlobalShortcut();

            // Monitor device status
            const unsubscribeDevice = listenDeviceStatus(user.uid, () => {
              log.info("Device removed remotely, logging out...");
              if (
                epoch !== initializationEpoch ||
                generation !== getAuthGeneration() ||
                auth.currentUser?.uid !== user.uid
              )
                return;
              logoutUser().catch(() => log.warn("Remote logout failed"));
            });

            if (
              epoch !== initializationEpoch ||
              revision !== authStateRevision ||
              generation !== getAuthGeneration() ||
              auth.currentUser?.uid !== user.uid ||
              !isKeyLoaded(user.uid) ||
              isSessionRevoked()
            ) {
              // Cached device callbacks can revoke access before registration returns.
              unsubscribeDevice();
              return;
            }
            unsubscribeDeviceStatus = unsubscribeDevice;

            // Notify renderer that user is authenticated
            const mainWindow = getMainWindow();
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send(
                "auth-state-changed",
                user.displayName || user.email || "User",
              );
            }
          } catch {
            log.error("Failed to setup user for clipboard sync");
            if (
              epoch === initializationEpoch &&
              revision === authStateRevision &&
              generation === getAuthGeneration()
            )
              await logoutUser().catch(() => {});
          }
        })();
      } else {
        log.info("User logged out, stopping clipboard sync");
        // Close main and settings windows, open auth window
        // Notify renderer of logout (if main window was still open, but we just closed it, so this might be redundant but safe)
        clearAuthenticatedSession();
      }
    });

    // Function to attempt session restoration
    const attemptSessionRestore = async (): Promise<void> => {
      if (
        sessionRestoreAttempted ||
        epoch !== initializationEpoch ||
        isAuthenticationPending()
      )
        return;

      // Mark that we've attempted to restore session
      sessionRestoreAttempted = true;

      log.info("Network is online, attempting to restore session");

      try {
        const displayName = await restoreAuthSession();
        if (displayName) {
          log.info("Previous session restored successfully", { displayName });
        } else {
          log.info("No previous session to restore");
        }
      } catch {
        log.error("Failed to restore authentication session");
      }
    };

    void attemptSessionRestore();

    // Start network monitoring to attempt session restore when online
    startNetworkMonitoring({
      onOnline: attemptSessionRestore,
    });
  } catch {
    unsubscribeAuth?.();
    unsubscribeAuth = null;
    unsubscribeSessionRevoked?.();
    unsubscribeSessionRevoked = null;
    log.error("Failed to initialize authentication");
  }
}

export function registerGlobalShortcut(shortcut?: string): boolean {
  // Unregister any existing shortcut first to avoid duplicates or conflicts
  // Keep the old binding until a new registration succeeds, then remove it.
  const previousShortcut = registeredShortcut;

  const shortcutToRegister = shortcut || settingsStorage.getShortcut();

  try {
    if (globalShortcut.isRegistered(shortcutToRegister)) {
      if (registeredShortcut && registeredShortcut !== shortcutToRegister)
        globalShortcut.unregister(registeredShortcut);
      registeredShortcut = shortcutToRegister;
      return true;
    }
    const ret = globalShortcut.register(shortcutToRegister, () => {
      const user = getAuth().currentUser;
      if (!user || !isKeyLoaded(user.uid) || isSessionRevoked()) {
        createAuthWindow();
        return;
      }
      const mainWindow = getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();
        }
      } else {
        createMainWindow(true);
      }
    });

    if (!ret) {
      log.error("Failed to register global shortcut");
      return false;
    } else {
      if (previousShortcut && previousShortcut !== shortcutToRegister)
        globalShortcut.unregister(previousShortcut);
      registeredShortcut = shortcutToRegister;
      log.info("Global shortcut registered");
      return true;
    }
  } catch {
    log.error("Error registering global shortcut");
    return false;
  }
}
