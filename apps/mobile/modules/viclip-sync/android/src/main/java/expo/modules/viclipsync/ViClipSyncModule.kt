package expo.modules.viclipsync

import android.content.Context
import android.content.Intent
import android.provider.Settings
import android.util.Log
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * ViClipSyncModule — Expo Modules API bridge
 *
 * JS-callable functions:
 * - `isAccessibilityEnabled()` — Is the accessibility service toggled on in Android Settings?
 * - `isServiceRunning()`       — Is the service process currently alive?
 * - `openAccessibilitySettings()` — Deep-link to Android Accessibility Settings.
 * - `setSyncPaused(paused)`    — Pause/resume syncing from the in-app toggle.
 *
 * Events emitted to JS:
 * - `onClipboardChanged`   — Clipboard text changed (fires from service).
 * - `onServiceStatusChanged` — Service started or stopped.
 * - `onSyncPauseChanged`   — Pause state toggled via the notification button.
 */
class ViClipSyncModule : Module() {

    companion object {
        private const val TAG = "ViClipSyncModule"

        private const val CLIPBOARD_CHANGED_EVENT  = "onClipboardChanged"
        private const val SERVICE_STATUS_EVENT     = "onServiceStatusChanged"
        private const val SYNC_PAUSE_CHANGED_EVENT = "onSyncPauseChanged"

        private var moduleInstance: ViClipSyncModule? = null

        fun emitClipboardChanged(text: String) {
            try {
                moduleInstance?.sendEvent(
                    CLIPBOARD_CHANGED_EVENT,
                    mapOf("text" to text, "timestamp" to System.currentTimeMillis())
                )
            } catch (e: Exception) {
                Log.e(TAG, "Failed to emit clipboard event", e)
            }
        }

        fun emitServiceStatusChanged(isRunning: Boolean) {
            try {
                moduleInstance?.sendEvent(
                    SERVICE_STATUS_EVENT,
                    mapOf("isRunning" to isRunning)
                )
            } catch (e: Exception) {
                Log.e(TAG, "Failed to emit service status event", e)
            }
        }

        /**
         * Called by ViClipAccessibilityService when the notification action button
         * is tapped (BroadcastReceiver path). JS uses this to keep the in-app
         * toggle in sync with the notification button.
         */
        fun emitSyncPauseChanged(isPaused: Boolean) {
            try {
                moduleInstance?.sendEvent(
                    SYNC_PAUSE_CHANGED_EVENT,
                    mapOf("isPaused" to isPaused)
                )
            } catch (e: Exception) {
                Log.e(TAG, "Failed to emit sync pause event", e)
            }
        }
    }

    override fun definition() = ModuleDefinition {
        Name("ViClipSync")

        OnCreate { moduleInstance = this@ViClipSyncModule }
        OnDestroy { if (moduleInstance == this@ViClipSyncModule) moduleInstance = null }

        Events(CLIPBOARD_CHANGED_EVENT, SERVICE_STATUS_EVENT, SYNC_PAUSE_CHANGED_EVENT)

        Function("isAccessibilityEnabled") {
            val context = appContext.reactContext ?: return@Function false
            isViClipAccessibilityEnabled(context)
        }

        Function("isServiceRunning") {
            ViClipAccessibilityService.isRunning
        }

        Function("openAccessibilitySettings") {
            val context = appContext.reactContext
            if (context != null) {
                val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(intent)
            }
        }

        /**
         * Called from JS (in-app toggle). Updates the notification without emitting
         * the event back to JS (JS already updated its own state).
         */
        Function("setSyncPaused") { paused: Boolean ->
            ViClipAccessibilityService.updateNotificationFromModule(paused)
            Log.d(TAG, "setSyncPaused: $paused")
        }
    }

    private fun isViClipAccessibilityEnabled(context: Context): Boolean {
        return try {
            val enabled = Settings.Secure.getString(
                context.contentResolver,
                Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
            ) ?: return false
            val id = "${context.packageName}/${ViClipAccessibilityService::class.java.canonicalName}"
            enabled.contains(id)
        } catch (e: Exception) {
            Log.e(TAG, "Error checking accessibility status", e)
            false
        }
    }
}
