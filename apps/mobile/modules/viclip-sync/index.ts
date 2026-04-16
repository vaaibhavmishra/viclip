import { NativeModulesProxy, EventEmitter, type Subscription } from 'expo-modules-core'
import ViClipSyncNative from './src/ViClipSyncModule'

// ─── Types ───────────────────────────────────────────────────

export interface ClipboardChangedEvent {
  text: string
  timestamp: number
}

export interface ServiceStatusEvent {
  isRunning: boolean
}

// ─── Native Event Emitter ────────────────────────────────────

const emitter = new EventEmitter(ViClipSyncNative)

// ─── Functions ───────────────────────────────────────────────

/**
 * Check if the ViClip Accessibility Service has been enabled by the user
 * in Android Settings > Accessibility.
 */
export function isAccessibilityEnabled(): boolean {
  return ViClipSyncNative.isAccessibilityEnabled()
}

/**
 * Check if the Accessibility Service background process is currently alive.
 */
export function isServiceRunning(): boolean {
  return ViClipSyncNative.isServiceRunning()
}

/**
 * Opens the Android Accessibility Settings screen so the user can enable ViClip.
 */
export function openAccessibilitySettings(): void {
  ViClipSyncNative.openAccessibilitySettings()
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
): Subscription {
  return emitter.addListener('onClipboardChanged', listener)
}

/**
 * Subscribe to service status changes (started/stopped).
 */
export function addServiceStatusListener(
  listener: (event: ServiceStatusEvent) => void,
): Subscription {
  return emitter.addListener('onServiceStatusChanged', listener)
}
