import React, {
  createContext,
  type ReactElement,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, type AppStateStatus, Platform } from "react-native";
import { sendClip } from "@/services/clipboard";
import {
  addClipboardListener,
  addServiceStatusListener,
  type ClipboardChangedEvent,
  isAccessibilityEnabled,
  isServiceRunning,
  openAccessibilitySettings,
} from "../modules/viclip-sync";

// ─── Context ─────────────────────────────────────────────────────────────────

export interface BackgroundSyncState {
  /** Whether the Accessibility Service is toggled on in Android Settings */
  accessibilityEnabled: boolean;
  /** Whether the service process is currently live */
  serviceRunning: boolean;
  /** Whether a clip is currently being uploaded to Firebase */
  isSyncing: boolean;
  /** Deep-links user to Android > Settings > Accessibility */
  openAccessibilitySettings: () => void;
  /** Re-checks status immediately (e.g. after returning from Settings) */
  refreshStatus: () => void;
}

const BackgroundSyncContext = createContext<BackgroundSyncState>({
  accessibilityEnabled: false,
  serviceRunning: false,
  isSyncing: false,
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
  const lastSyncedText = useRef<string | null>(null);

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

  // ── Native event subscriptions ──────────────────────────────────────────────
  useEffect(() => {
    if (Platform.OS !== "android") return;

    // 1. Clipboard events → encrypt + push to Firebase
    const clipSub = addClipboardListener(async (ev: ClipboardChangedEvent) => {
      if (ev.text === lastSyncedText.current) return; // deduplicate

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
    });

    return () => {
      clipSub.remove();
      statusSub.remove();
    };
  }, [checkStatus]);

  return (
    <BackgroundSyncContext.Provider
      value={{
        accessibilityEnabled,
        serviceRunning,
        isSyncing,
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
