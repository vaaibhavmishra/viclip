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
  // Check if notifications are enabled
  if (!getNotificationsEnabled()) {
    return;
  }
  // Create a new notification instance
  const notification = new Notification({
    title,
    body,
  });
  notification.show();
}
