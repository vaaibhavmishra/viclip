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
 * Exposes the following to JavaScript:
 * - `isAccessibilityEnabled()`: Check if the ViClip Accessibility Service is enabled
 * - `openAccessibilitySettings()`: Deep-link user to Android Accessibility Settings
 * - `isServiceRunning()`: Check if the service instance is currently alive
 *
 * Events emitted to JS:
 * - `onClipboardChanged`: Fires when clipboard text changes (detected by the Accessibility Service)
 * - `onServiceStatusChanged`: Fires when the service starts or stops
 */
class ViClipSyncModule : Module() {

    companion object {
        private const val TAG = "ViClipSyncModule"
        private const val CLIPBOARD_CHANGED_EVENT = "onClipboardChanged"
        private const val SERVICE_STATUS_EVENT = "onServiceStatusChanged"

        // Static reference to the module instance for the service to emit events
        private var moduleInstance: ViClipSyncModule? = null

        fun emitClipboardChanged(text: String) {
            try {
                moduleInstance?.sendEvent(CLIPBOARD_CHANGED_EVENT, mapOf(
                    "text" to text,
                    "timestamp" to System.currentTimeMillis()
                ))
            } catch (e: Exception) {
                Log.e(TAG, "Failed to emit clipboard event to JS", e)
            }
        }

        fun emitServiceStatusChanged(isRunning: Boolean) {
            try {
                moduleInstance?.sendEvent(SERVICE_STATUS_EVENT, mapOf(
                    "isRunning" to isRunning
                ))
            } catch (e: Exception) {
                Log.e(TAG, "Failed to emit service status event to JS", e)
            }
        }
    }

    override fun definition() = ModuleDefinition {
        Name("ViClipSync")

        // Register this instance so the Service can call back
        OnCreate {
            moduleInstance = this@ViClipSyncModule
        }

        OnDestroy {
            if (moduleInstance == this@ViClipSyncModule) {
                moduleInstance = null
            }
        }

        // Define events that JS can subscribe to
        Events(CLIPBOARD_CHANGED_EVENT, SERVICE_STATUS_EVENT)

        // Check if ViClip's Accessibility Service is enabled in Android Settings
        Function("isAccessibilityEnabled") {
            val context = appContext.reactContext ?: return@Function false
            return@Function isViClipAccessibilityEnabled(context)
        }

        // Check if the service instance is actually running right now
        Function("isServiceRunning") {
            return@Function ViClipAccessibilityService.isRunning
        }

        // Open the Android Accessibility Settings page so the user can enable ViClip
        Function("openAccessibilitySettings") {
            val context = appContext.reactContext
            if (context != null) {
                val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(intent)
            }
        }
    }

    /**
     * Checks if the ViClip Accessibility Service is enabled by the user
     * in Android Settings > Accessibility.
     */
    private fun isViClipAccessibilityEnabled(context: Context): Boolean {
        try {
            val enabledServices = Settings.Secure.getString(
                context.contentResolver,
                Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
            ) ?: return false

            val serviceId = "${context.packageName}/${ViClipAccessibilityService::class.java.canonicalName}"
            return enabledServices.contains(serviceId)
        } catch (e: Exception) {
            Log.e(TAG, "Error checking accessibility service status", e)
            return false
        }
    }
}
