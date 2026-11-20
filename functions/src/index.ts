import { getApps, initializeApp } from "firebase-admin/app";
import { getDatabaseWithUrl } from "firebase-admin/database";
import {
  getMessaging,
  type Message,
  type SendResponse,
} from "firebase-admin/messaging";
import { onValueWritten } from "firebase-functions/v2/database";

const RTDB_URL = process.env.MAIN_VITE_FIREBASE_DATABASE_URL;
const ANDROID_NOTIFICATION_CHANNEL_ID = "viclip_sync_notifications";

if (!RTDB_URL) {
  throw new Error("Missing required environment variable: RTDB_URL");
}

const rtdbInstance = RTDB_URL.match(/^https?:\/\/([^.]+)\./)?.[1];

if (!getApps().length) {
  initializeApp({
    databaseURL: RTDB_URL,
  });
}

/**
 * Sanitizes device names to prevent formatting breakages and control character injection.
 */
function sanitizeDeviceName(name?: unknown): string {
  if (!name || typeof name !== "string") return "another device";
  // biome-ignore lint/suspicious/noControlCharactersInRegex: intentional control character stripping for device names
  const cleaned = name.replace(/[\r\n\x00-\x1F\x7F-\x9F]/g, "").trim();
  return cleaned.length > 40
    ? cleaned.slice(0, 40)
    : cleaned || "another device";
}

/**
 * Triggers automatically whenever a clip is created or updated in Firebase Realtime Database.
 * Sends a high-priority FCM push notification to all other devices registered by the user.
 */
export const sendClipPushNotification = onValueWritten(
  {
    ref: "/users/{userId}/clips/{clipId}",
    ...(rtdbInstance ? { instance: rtdbInstance } : {}),
    region: "us-central1",
    maxInstances: 10,
  },
  async (event) => {
    try {
      const beforeClip = event.data.before?.val();
      const clip = event.data.after?.val();
      if (!clip) return;

      // Skip pin/unpin toggles where timestamp and content are unchanged
      if (
        beforeClip &&
        beforeClip.timestamp === clip.timestamp &&
        beforeClip.content === clip.content
      ) {
        return;
      }

      const { userId, clipId } = event.params;
      const sourceDevice = sanitizeDeviceName(clip.sourceDevice);
      const sourceDeviceId = (clip.sourceDeviceId as string | undefined) || "";
      const effectiveClipId = String(clip.id || clipId);

      // 1. Fetch user's registered devices from RTDB
      const db = getDatabaseWithUrl(RTDB_URL);
      const devicesSnap = await db.ref(`/users/${userId}/devices`).get();
      if (!devicesSnap.exists()) {
        return;
      }

      const rawDevices = devicesSnap.val();
      if (!rawDevices || typeof rawDevices !== "object") {
        return;
      }

      const devices = rawDevices as Record<
        string,
        { id?: string; deviceName?: string; fcmToken?: string }
      >;

      // 2. Identify sender tokens to strictly prevent self-notifications (even with stale/duplicate records)
      const senderTokens = new Set<string>();
      for (const [key, dev] of Object.entries(devices)) {
        if (!dev || typeof dev !== "object") continue;
        const isSender = sourceDeviceId
          ? dev.id === sourceDeviceId || key === sourceDeviceId
          : dev.deviceName === sourceDevice;

        if (
          isSender &&
          typeof dev.fcmToken === "string" &&
          dev.fcmToken.trim().length > 0
        ) {
          senderTokens.add(dev.fcmToken.trim());
        }
      }

      // 3. Map unique recipient tokens to device keys
      const tokenToKeysMap = new Map<string, string[]>();
      for (const [key, dev] of Object.entries(devices)) {
        if (
          !dev ||
          typeof dev !== "object" ||
          typeof dev.fcmToken !== "string"
        ) {
          continue;
        }

        const token = dev.fcmToken.trim();
        if (!token || senderTokens.has(token)) {
          continue;
        }

        const isSender = sourceDeviceId
          ? dev.id === sourceDeviceId || key === sourceDeviceId
          : dev.deviceName === sourceDevice;

        if (!isSender) {
          const keys = tokenToKeysMap.get(token) || [];
          keys.push(key);
          tokenToKeysMap.set(token, keys);
        }
      }

      const uniqueTokens = Array.from(tokenToKeysMap.keys()).slice(0, 500);
      if (uniqueTokens.length === 0) {
        console.log(`No recipient FCM tokens for user ${userId}`);
        return;
      }

      console.log(
        `Found ${uniqueTokens.length} unique recipient token(s) for user ${userId} (source: ${sourceDevice})`,
      );

      // 4. Notification payload
      const title = `New Clip from ${sourceDevice}`;
      const body = "Tap to open and view clip";
      const dataPayload: Record<string, string> = {
        clipId: effectiveClipId,
        sourceDevice,
        sourceDeviceId,
        type: String(clip.type || "text"),
      };

      // 5. Send multicast in batches of up to 500
      const BATCH_SIZE = 500;
      for (let i = 0; i < uniqueTokens.length; i += BATCH_SIZE) {
        const tokenBatch = uniqueTokens.slice(i, i + BATCH_SIZE);

        const messages: Message[] = tokenBatch.map((token) => ({
          token,
          notification: {
            title,
            body,
          },
          data: dataPayload,
          android: {
            priority: "high",
            notification: {
              channelId: ANDROID_NOTIFICATION_CHANNEL_ID,
              sound: "default",
              priority: "high",
            },
          },
          apns: {
            headers: {
              "apns-priority": "10",
              "apns-push-type": "alert",
            },
            payload: {
              aps: {
                sound: "default",
                badge: 1,
                contentAvailable: true,
              },
            },
          },
        }));

        const response = await getMessaging().sendEach(messages);

        console.log(
          `Push notification batch sent for clip ${clipId}: ${response.successCount} succeeded, ${response.failureCount} failed`,
        );

        // 6. Atomically clean up invalid/unregistered tokens
        if (response.failureCount > 0) {
          const cleanupUpdates: Record<string, null> = {};

          response.responses.forEach((resp: SendResponse, idx: number) => {
            if (!resp.success) {
              const failedToken = tokenBatch[idx];
              const errCode = resp.error?.code;
              console.error(
                `FCM delivery error for token [${failedToken}]:`,
                resp.error,
              );

              if (
                errCode === "messaging/registration-token-not-registered" ||
                errCode === "messaging/invalid-registration-token"
              ) {
                const matchedKeys = tokenToKeysMap.get(failedToken) || [];
                for (const key of matchedKeys) {
                  cleanupUpdates[`${key}/fcmToken`] = null;
                  cleanupUpdates[`${key}/fcmTokenSessionId`] = null;
                }
              }
            }
          });

          if (Object.keys(cleanupUpdates).length > 0) {
            await db.ref(`/users/${userId}/devices`).update(cleanupUpdates);
            console.log(
              `Cleaned up invalid FCM tokens for user ${userId}:`,
              Object.keys(cleanupUpdates),
            );
          }
        }
      }
    } catch (error) {
      console.error("Error in sendClipPushNotification function:", error);
    }
  },
);
