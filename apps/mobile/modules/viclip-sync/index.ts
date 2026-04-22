import ViClipSyncNative from "./src/ViClipSyncModule";

// ─── Types ───────────────────────────────────────────────────

export interface ClipboardChangedEvent {
  text: string;
  timestamp: number;
}

export interface ServiceStatusEvent {
  isRunning: boolean;
}

export interface EventSubscription {
  remove(): void;
}

interface ViClipSyncModule {
  isAccessibilityEnabled(): boolean;
  isServiceRunning(): boolean;
  openAccessibilitySettings(): void;
  addListener(
    eventName: "onClipboardChanged",
    listener: (event: ClipboardChangedEvent) => void,
  ): EventSubscription;
  addListener(
    eventName: "onServiceStatusChanged",
    listener: (event: ServiceStatusEvent) => void,
  ): EventSubscription;
}

// ─── Native Event Emitter ────────────────────────────────────

const module = ViClipSyncNative as ViClipSyncModule;

// ─── Functions ───────────────────────────────────────────────

/**
 * Check if the ViClip Accessibility Service has been enabled by the user
 * in Android Settings > Accessibility.
 */
export function isAccessibilityEnabled(): boolean {
  return module.isAccessibilityEnabled();
}

/**
 * Check if the Accessibility Service background process is currently alive.
 */
export function isServiceRunning(): boolean {
  return module.isServiceRunning();
}

/**
 * Opens the Android Accessibility Settings screen so the user can enable ViClip.
 */
export function openAccessibilitySettings(): void {
  module.openAccessibilitySettings();
}

// ─── Event Subscriptions ─────────────────────────────────────

/**
 * Subscribe to clipboard changes detected by the background Accessibility Service.
 * This fires even when the app UI is not visible.
 *
 * @example
 * ```ts
 * const sub = addClipboardListener((event) => {
 *   console.log('New clip:', event.text)
 *   // Push to Firebase here
 * })
 *
 * // Later: sub.remove()
 * ```
 */
export function addClipboardListener(
  listener: (event: ClipboardChangedEvent) => void,
): EventSubscription {
  return module.addListener("onClipboardChanged", listener);
}

/**
 * Subscribe to service status changes (started/stopped).
 */
export function addServiceStatusListener(
  listener: (event: ServiceStatusEvent) => void,
): EventSubscription {
  return module.addListener("onServiceStatusChanged", listener);
}
