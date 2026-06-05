import ViClipSyncNative from "./src/ViClipSyncModule";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ClipboardChangedEvent {
  text: string;
  timestamp: number;
}

export interface ServiceStatusEvent {
  isRunning: boolean;
}

/** Fired when the notification's Pause/Resume button is tapped. */
export interface SyncPauseChangedEvent {
  isPaused: boolean;
}

export interface EventSubscription {
  remove(): void;
}

interface ViClipSyncModule {
  isAccessibilityEnabled(): boolean;
  isServiceRunning(): boolean;
  openAccessibilitySettings(): void;
  setSyncPaused(paused: boolean): void;
  addListener(
    eventName: "onClipboardChanged",
    listener: (event: ClipboardChangedEvent) => void,
  ): EventSubscription;
  addListener(
    eventName: "onServiceStatusChanged",
    listener: (event: ServiceStatusEvent) => void,
  ): EventSubscription;
  addListener(
    eventName: "onSyncPauseChanged",
    listener: (event: SyncPauseChangedEvent) => void,
  ): EventSubscription;
}

// ─── Module instance ─────────────────────────────────────────────────────────

const module = ViClipSyncNative as ViClipSyncModule;

// ─── Synchronous functions ────────────────────────────────────────────────────

/** Check if the ViClip Accessibility Service is enabled in Android Settings. */
export function isAccessibilityEnabled(): boolean {
  return module.isAccessibilityEnabled();
}

/** Check if the Accessibility Service process is currently alive. */
export function isServiceRunning(): boolean {
  return module.isServiceRunning();
}

/** Deep-link the user to Android Settings > Accessibility. */
export function openAccessibilitySettings(): void {
  module.openAccessibilitySettings();
}

/**
 * Pause or resume clipboard syncing from the in-app toggle.
 * This updates the persistent notification (Pause ↔ Resume label) without
 * emitting a `onSyncPauseChanged` event back to JS (JS already knows).
 */
export function setSyncPaused(paused: boolean): void {
  try {
    module.setSyncPaused(paused);
  } catch {
    // No-op on iOS or when the service is not running
  }
}

// ─── Event subscriptions ─────────────────────────────────────────────────────

/** Subscribe to clipboard changes from the background Accessibility Service. */
export function addClipboardListener(
  listener: (event: ClipboardChangedEvent) => void,
): EventSubscription {
  return module.addListener("onClipboardChanged", listener);
}

/** Subscribe to service lifecycle changes (started / stopped). */
export function addServiceStatusListener(
  listener: (event: ServiceStatusEvent) => void,
): EventSubscription {
  return module.addListener("onServiceStatusChanged", listener);
}

/**
 * Subscribe to sync-pause state changes triggered by the notification button.
 *
 * This fires ONLY when the user taps "Pause Sync" / "Resume Sync" directly in
 * the system notification (BroadcastReceiver path). Use it to keep the in-app
 * toggle in sync with the notification.
 *
 * @example
 * ```ts
 * const sub = addSyncPauseChangedListener(({ isPaused }) => {
 *   setSyncEnabled(!isPaused)          // update local state
 *   SecureStore.setItemAsync(KEY, ...)  // persist preference
 * })
 * // Later: sub.remove()
 * ```
 */
export function addSyncPauseChangedListener(
  listener: (event: SyncPauseChangedEvent) => void,
): EventSubscription {
  return module.addListener("onSyncPauseChanged", listener);
}
