/**
 * Notification Module
 *
 * A simple utility for displaying system notifications to the user.
 * Uses Electron's Notification API to show native system notifications.
 */

import { Notification } from "electron/main";
import { getNotificationsEnabled } from "../globalStates";

/**
 * Shows a system notification with the specified title and body text
 *
 * @param title The notification title
 * @param body The notification message body
 */
export function showNotification(title: string, body: string): void {
  // Check if notifications are enabled and supported by OS
  if (!getNotificationsEnabled() || !Notification.isSupported()) {
    return;
  }
  try {
    const notification = new Notification({
      title,
      body,
    });
    notification.show();
  } catch {
    // Non-fatal: OS notification daemon might be absent or busy
  }
}
