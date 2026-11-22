/**
 * Notification Module
 *
 * A simple utility for displaying system notifications to the user.
 * Uses Electron's Notification API to show native system notifications.
 */

import { Notification } from "electron/main";
import log from "electron-log/main";
import { getNotificationsEnabled } from "../globalStates";

/**
 * Shows a system notification with the specified title and body text
 *
 * @param title The notification title
 * @param body The notification message body
 */
export function showNotification(title: string, body: string): void {
  try {
    // Check if notifications are enabled and supported by OS
    if (!getNotificationsEnabled() || !Notification.isSupported()) {
      return;
    }
    const notification = new Notification({
      title,
      body,
    });
    notification.on("failed", () => {
      log.warn(
        "System notification failed. Check notification permissions and the OS notification service.",
      );
    });
    notification.show();
  } catch {
    // Non-fatal: OS notification daemon might be absent or busy
    log.warn(
      "System notification failed. Check notification permissions and the OS notification service.",
    );
  }
}
