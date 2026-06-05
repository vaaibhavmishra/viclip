import * as SecureStore from "expo-secure-store";
import React, {
  createContext,
  type ReactElement,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  AppState,
  type AppStateStatus,
  PermissionsAndroid,
  Platform,
} from "react-native";
import { sendClip } from "@/services/clipboard";
import {
  addClipboardListener,
  addServiceStatusListener,
  addSyncPauseChangedListener,
  type ClipboardChangedEvent,
  isAccessibilityEnabled,
  isServiceRunning,
  openAccessibilitySettings,
  setSyncPaused,
} from "../modules/viclip-sync";

// ─── Storage key ─────────────────────────────────────────────────────────────

const SYNC_ENABLED_KEY = "viclip_sync_enabled";

// ─── Context ─────────────────────────────────────────────────────────────────

export interface BackgroundSyncState {
  /** Whether the Accessibility Service is toggled on in Android Settings */
  accessibilityEnabled: boolean;
  /** Whether the service process is currently live */
  serviceRunning: boolean;
  /** Whether a clip is currently being uploaded to Firebase */
  isSyncing: boolean;
  /**
   * Whether the user has enabled clipboard syncing via the in-app toggle.
   * Distinct from `accessibilityEnabled` — the service can be running but
   * sync can still be paused here without touching Accessibility Settings.
   */
  syncEnabled: boolean;
  /** Toggle clipboard syncing on/off without disabling the Accessibility Service */
  toggleSync: (enabled: boolean) => Promise<void>;
  /** Deep-links user to Android > Settings > Accessibility */
  openAccessibilitySettings: () => void;
  /** Re-checks status immediately (e.g. after returning from Settings) */
  refreshStatus: () => void;
}

const BackgroundSyncContext = createContext<BackgroundSyncState>({
  accessibilityEnabled: false,
  serviceRunning: false,
  isSyncing: false,
  syncEnabled: true,
  toggleSync: async () => {},
  openAccessibilitySettings,
  refreshStatus: () => {},
});

// ─── Provider (mount once at the protected layout level) ─────────────────────

/**
 * BackgroundSyncProvider
 *
 * Registers the Accessibility Service event listeners once for the
 * entire authenticated session. Any screen that needs to read the
 * current status should use `useBackgroundSync()` instead.
 */
export function BackgroundSyncProvider({
  children,
}: {
  children: React.ReactNode;
}): ReactElement {
  const [accessibilityEnabled, setAccessibilityEnabled] = useState(false);
  const [serviceRunning, setServiceRunning] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncEnabled, setSyncEnabled] = useState(true);

  // Keep a ref so the clipboard listener closure always reads the latest value
  // without stale-closure issues.
  const syncEnabledRef = useRef(true);
  const lastSyncedText = useRef<string | null>(null);

  // ── Sync enabled state persistence ─────────────────────────────────────────

  // Load persisted preference on mount
  useEffect(() => {
    if (Platform.OS !== "android") return;
    SecureStore.getItemAsync(SYNC_ENABLED_KEY)
      .then((val) => {
        // Default to enabled if never set
        const enabled = val !== "false";
        setSyncEnabled(enabled);
        syncEnabledRef.current = enabled;
        // Sync the notification state immediately if service is already running
        if (!enabled) setSyncPaused(true);
      })
      .catch(() => {
        // Ignore read errors — default to enabled
      });
  }, []);

  // Keep ref in sync with state
  useEffect(() => {
    syncEnabledRef.current = syncEnabled;
  }, [syncEnabled]);

  /**
   * Toggle clipboard syncing on/off.
   * - Does NOT touch the Accessibility Service.
   * - Persists the choice via SecureStore.
   * - Updates the native notification to reflect the new state.
   */
  const toggleSync = useCallback(async (enabled: boolean) => {
    setSyncEnabled(enabled);
    syncEnabledRef.current = enabled;

    try {
      await SecureStore.setItemAsync(SYNC_ENABLED_KEY, String(enabled));
    } catch {
      console.warn("[BackgroundSync] Failed to persist sync preference");
    }

    // Update the persistent notification so it reflects paused/active state
    setSyncPaused(!enabled);
  }, []);

  // ── Status polling ──────────────────────────────────────────────────────────
  const checkStatus = useCallback(() => {
    if (Platform.OS !== "android") return;
    try {
      setAccessibilityEnabled(isAccessibilityEnabled());
      setServiceRunning(isServiceRunning());
    } catch (err) {
      console.warn("[BackgroundSync] Failed to check status:", err);
    }
  }, []);

  // Re-check whenever the app returns to the foreground (e.g. user comes back
  // from Android Accessibility Settings after enabling the service).
  useEffect(() => {
    if (Platform.OS !== "android") return;

    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (next === "active") checkStatus();
    });
    checkStatus(); // initial read

    return () => sub.remove();
  }, [checkStatus]);

  // ── Request POST_NOTIFICATIONS permission (Android 13+) ────────────────────
  // Declaring the permission in AndroidManifest.xml is not enough on API 33+;
  // it must also be requested at runtime before the service can post notifications.
  useEffect(() => {
    if (Platform.OS !== "android") return;
    if (Platform.Version < 33) return; // TIRAMISU = 33

    PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    )
      .then((result) => {
        console.debug(
          "[BackgroundSync] POST_NOTIFICATIONS permission:",
          result,
        );
      })
      .catch((err) => {
        console.warn(
          "[BackgroundSync] Failed to request notification permission:",
          err,
        );
      });
  }, []);

  // ── Native event subscriptions ──────────────────────────────────────────────
  useEffect(() => {
    if (Platform.OS !== "android") return;

    // 1. Clipboard events → encrypt + push to Firebase (only if sync is enabled)
    const clipSub = addClipboardListener(async (ev: ClipboardChangedEvent) => {
      if (ev.text === lastSyncedText.current) return; // deduplicate

      // Skip upload if the user has paused sync via the in-app toggle
      if (!syncEnabledRef.current) {
        console.debug("[BackgroundSync] Sync paused — skipping upload");
        return;
      }

      try {
        setIsSyncing(true);
        lastSyncedText.current = ev.text;
        await sendClip(ev.text, "text");
        console.debug(
          "[BackgroundSync] Clip synced:",
          ev.text.substring(0, 40),
        );
      } catch (err) {
        console.error("[BackgroundSync] Sync failed:", err);
      } finally {
        setIsSyncing(false);
      }
    });

    // 2. Service lifecycle events → update running state
    const statusSub = addServiceStatusListener((ev) => {
      setServiceRunning(ev.isRunning);
      // Also refresh the full status so accessibilityEnabled stays current
      checkStatus();

      // When the service starts, re-apply the persisted paused state
      // (the native service always starts in "active" mode)
      if (ev.isRunning && !syncEnabledRef.current) {
        setSyncPaused(true);
      }
    });

    // 3. Notification button events → keep in-app toggle in sync
    //    Fires when the user taps "Pause Sync" or "Resume Sync" in the notification
    //    (BroadcastReceiver path — JS has no other way to know about this tap).
    const pauseSub = addSyncPauseChangedListener(({ isPaused }) => {
      const enabled = !isPaused;
      setSyncEnabled(enabled);
      syncEnabledRef.current = enabled;
      SecureStore.setItemAsync(SYNC_ENABLED_KEY, String(enabled)).catch(
        () => {},
      );
      console.debug("[BackgroundSync] Notification toggled sync:", enabled);
    });

    return () => {
      clipSub.remove();
      statusSub.remove();
      pauseSub.remove();
    };
  }, [checkStatus]);

  return (
    <BackgroundSyncContext.Provider
      value={{
        accessibilityEnabled,
        serviceRunning,
        isSyncing,
        syncEnabled,
        toggleSync,
        openAccessibilitySettings,
        refreshStatus: checkStatus,
      }}
    >
      {children}
    </BackgroundSyncContext.Provider>
  );
}

// ─── Consumer hook ────────────────────────────────────────────────────────────

/**
 * useBackgroundSync
 *
 * Read-only hook. MUST be used inside a `<BackgroundSyncProvider>`.
 * The provider is mounted at the protected layout level — call this hook
 * from any screen to access current sync state without registering duplicate
 * native listeners.
 */
export function useBackgroundSync(): BackgroundSyncState {
  return useContext(BackgroundSyncContext);
}
