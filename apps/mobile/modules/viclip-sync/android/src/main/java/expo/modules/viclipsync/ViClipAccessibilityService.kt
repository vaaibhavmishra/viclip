package expo.modules.viclipsync

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.util.Log
import android.view.accessibility.AccessibilityEvent

/**
 * ViClipAccessibilityService
 *
 * An Android Accessibility Service that keeps the app process alive indefinitely
 * in the background. This is the same technique used by Grammarly to maintain
 * a persistent background connection.
 *
 * Key behaviors:
 * - Stays alive regardless of Doze mode, App Standby, or battery optimizations.
 * - Monitors the clipboard for changes and broadcasts them to the JS layer.
 * - Minimal resource usage: we do NOT read window content (canRetrieveWindowContent=false).
 */
class ViClipAccessibilityService : AccessibilityService() {

    companion object {
        private const val TAG = "ViClipSync"

        // Static reference so the Expo Module can communicate with the running service
        var instance: ViClipAccessibilityService? = null
            private set

        var isRunning: Boolean = false
            private set
    }

    private var clipboardManager: ClipboardManager? = null
    private var lastClipText: String? = null

    private val clipboardListener = ClipboardManager.OnPrimaryClipChangedListener {
        handleClipboardChange()
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
        isRunning = true

        // Configure the service
        serviceInfo = serviceInfo.apply {
            eventTypes = AccessibilityEvent.TYPES_ALL_MASK
            feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC
            notificationTimeout = 500
            flags = flags or AccessibilityServiceInfo.FLAG_INCLUDE_NOT_IMPORTANT_VIEWS
        }

        // Register clipboard listener
        clipboardManager = getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
        clipboardManager?.addPrimaryClipChangedListener(clipboardListener)

        Log.i(TAG, "ViClip Accessibility Service connected and clipboard listener registered")

        // Notify JS that the service is now running
        ViClipSyncModule.emitServiceStatusChanged(true)
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        // We don't need to process accessibility events directly.
        // The service existing is enough to keep us alive.
        // Clipboard changes are handled by the ClipboardManager listener.
    }

    override fun onInterrupt() {
        Log.w(TAG, "ViClip Accessibility Service interrupted")
    }

    override fun onDestroy() {
        super.onDestroy()
        clipboardManager?.removePrimaryClipChangedListener(clipboardListener)
        instance = null
        isRunning = false
        Log.i(TAG, "ViClip Accessibility Service destroyed")

        // Notify JS that the service has stopped
        ViClipSyncModule.emitServiceStatusChanged(false)
    }

    /**
     * Handle clipboard changes detected by the system ClipboardManager.
     * Extracts the text and sends it over to the JS layer via the Expo Module event emitter.
     */
    private fun handleClipboardChange() {
        try {
            val clip = clipboardManager?.primaryClip
            if (clip != null && clip.itemCount > 0) {
                val item = clip.getItemAt(0)
                val text = item.coerceToText(this)?.toString()

                if (!text.isNullOrEmpty() && text != lastClipText) {
                    lastClipText = text
                    Log.d(TAG, "Clipboard changed: ${text.take(50)}...")

                    // Send new clip to JS
                    ViClipSyncModule.emitClipboardChanged(text)
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error reading clipboard", e)
        }
    }
}
