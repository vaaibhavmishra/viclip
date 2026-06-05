package expo.modules.viclipsync

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat

/**
 * ViClipAccessibilityService
 *
 * An Android Accessibility Service that keeps the app process alive indefinitely
 * in the background.
 *
 * Key behaviors:
 * - Stays alive regardless of Doze mode, App Standby, or battery optimizations.
 * - Monitors the clipboard for changes and broadcasts them to the JS layer.
 * - Posts a persistent notification so the user always knows sync is active.
 * - Supports a "paused" state toggled by EITHER:
 *     (a) the in-app Switch (JS calls setSyncPaused via ViClipSyncModule), OR
 *     (b) tapping "Pause / Resume Sync" directly in the notification.
 *   In both cases the notification is refreshed and a `onSyncPauseChanged` event
 *   is emitted to JS so the in-app toggle stays in sync.
 */
class ViClipAccessibilityService : AccessibilityService() {

    companion object {
        private const val TAG          = "ViClipSync"
        private const val NOTIFICATION_ID   = 1001
        private const val CHANNEL_ID        = "viclip_sync_channel"
        private const val CHANNEL_NAME      = "Background Sync"

        /** Broadcast action sent by the notification's action button. */
        const val ACTION_TOGGLE_SYNC =
            "expo.modules.viclipsync.ACTION_TOGGLE_SYNC"

        var instance: ViClipAccessibilityService? = null
            private set

        var isRunning: Boolean = false
            private set

        /**
         * Called by ViClipSyncModule when JS toggles the in-app switch.
         * Refreshes the notification to stay consistent with the JS state.
         */
        fun updateNotificationFromModule(isPaused: Boolean) {
            instance?.applyPausedState(isPaused, emitEvent = false)
        }
    }

    private var clipboardManager:   ClipboardManager?   = null
    private var notificationManager: NotificationManager? = null
    private var lastClipText: String? = null
    private var isSyncPaused = false

    // ── BroadcastReceiver for the notification action button ─────────────────
    private val syncToggleReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action != ACTION_TOGGLE_SYNC) return
            // Flip the paused state and propagate everywhere
            applyPausedState(!isSyncPaused, emitEvent = true)
        }
    }

    private val clipboardListener = ClipboardManager.OnPrimaryClipChangedListener {
        handleClipboardChange()
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance  = this
        isRunning = true

        serviceInfo = serviceInfo.apply {
            eventTypes       = AccessibilityEvent.TYPES_ALL_MASK
            feedbackType     = AccessibilityServiceInfo.FEEDBACK_GENERIC
            notificationTimeout = 500
            flags = flags or AccessibilityServiceInfo.FLAG_INCLUDE_NOT_IMPORTANT_VIEWS
        }

        clipboardManager = getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
        clipboardManager?.addPrimaryClipChangedListener(clipboardListener)

        // Register the broadcast receiver for the notification's action button.
        // RECEIVER_NOT_EXPORTED: only our own app can send this broadcast (API 33+).
        ContextCompat.registerReceiver(
            this,
            syncToggleReceiver,
            IntentFilter(ACTION_TOGGLE_SYNC),
            ContextCompat.RECEIVER_NOT_EXPORTED
        )

        // Show the initial notification (active state)
        showSyncNotification(isPaused = false)

        Log.i(TAG, "ViClip service connected")
        ViClipSyncModule.emitServiceStatusChanged(true)
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) { /* intentionally empty */ }

    override fun onInterrupt() {
        Log.w(TAG, "ViClip service interrupted")
    }

    override fun onDestroy() {
        super.onDestroy()
        clipboardManager?.removePrimaryClipChangedListener(clipboardListener)
        try { unregisterReceiver(syncToggleReceiver) } catch (_: Exception) {}
        dismissSyncNotification()
        instance  = null
        isRunning = false
        Log.i(TAG, "ViClip service destroyed")
        ViClipSyncModule.emitServiceStatusChanged(false)
    }

    // ── Pause/Resume logic ────────────────────────────────────────────────────

    /**
     * Central method that handles a pause/resume request from any source
     * (notification button OR in-app JS toggle).
     *
     * @param isPaused  New desired paused state.
     * @param emitEvent Whether to emit `onSyncPauseChanged` to JS.
     *                  Pass `true` when the change originates from the notification
     *                  button (JS doesn't know about it yet).
     *                  Pass `false` when the change was already applied by JS.
     */
    fun applyPausedState(isPaused: Boolean, emitEvent: Boolean) {
        isSyncPaused = isPaused
        showSyncNotification(isPaused)
        if (emitEvent) {
            ViClipSyncModule.emitSyncPauseChanged(isPaused)
        }
        Log.d(TAG, "Sync paused=$isPaused (emitEvent=$emitEvent)")
    }

    // ── Notification ──────────────────────────────────────────────────────────

    private fun showSyncNotification(isPaused: Boolean) {
        notificationManager = notificationManager
            ?: (getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID, CHANNEL_NAME,
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Shows when ViClip is syncing your clipboard in the background."
                setShowBadge(false)
            }
            notificationManager?.createNotificationChannel(channel)
        }

        // Tapping the notification body → open the app
        val openAppIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        }
        val openAppPI = openAppIntent?.let {
            PendingIntent.getActivity(
                this, 1, it,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
        }

        // Action button → sends the TOGGLE_SYNC broadcast (handled by syncToggleReceiver above)
        val toggleIntent = Intent(ACTION_TOGGLE_SYNC).apply {
            setPackage(packageName) // Explicit package required for implicit broadcasts
        }
        val togglePI = PendingIntent.getBroadcast(
            this, 0, toggleIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val title       = if (isPaused) "Clipboard Sync Paused" else "Background Sync Active"
        val body        = if (isPaused)
            "Your clipboard is not being synced. Tap to resume."
        else
            "Your clipboard is being synced to your other devices."
        val actionIcon  = if (isPaused) android.R.drawable.ic_popup_sync
                          else          android.R.drawable.ic_menu_close_clear_cancel
        val actionLabel = if (isPaused) "Resume Sync" else "Pause Sync"

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(body)
            .setSmallIcon(android.R.drawable.ic_popup_sync)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setContentIntent(openAppPI)
            .addAction(actionIcon, actionLabel, togglePI)   // ← broadcast, not open-app
            .build()

        notificationManager?.notify(NOTIFICATION_ID, notification)
        Log.d(TAG, "Notification updated — isPaused=$isPaused")
    }

    private fun dismissSyncNotification() {
        notificationManager?.cancel(NOTIFICATION_ID)
    }

    // ── Clipboard handling ────────────────────────────────────────────────────

    private fun handleClipboardChange() {
        try {
            val clip = clipboardManager?.primaryClip ?: return
            if (clip.itemCount == 0) return
            val text = clip.getItemAt(0).coerceToText(this)?.toString() ?: return
            if (text.isEmpty() || text == lastClipText) return
            lastClipText = text
            Log.d(TAG, "Clipboard changed: ${text.take(50)}")
            ViClipSyncModule.emitClipboardChanged(text)
        } catch (e: Exception) {
            Log.e(TAG, "Error reading clipboard", e)
        }
    }
}
