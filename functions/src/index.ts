import * as admin from "firebase-admin";
import { onValueCreated } from "firebase-functions/v2/database";

admin.initializeApp();

/**
 * Triggers automatically whenever a new clip is created in Firebase Realtime Database.
 * Sends a high-priority FCM push notification to all other devices registered by the user.
 */
export const sendClipPushNotification = onValueCreated(
  {
    ref: "/users/{userId}/clips/{clipId}",
    instance: "viclip-4c869-test",
  },
  async (event) => {
    const clip = event.data.val();
    if (!clip) return;

    const { userId, clipId } = event.params;
    const sourceDevice = clip.sourceDevice || "another device";

    // 1. Fetch user's registered devices
    const db = admin.database();
    const devicesSnap = await db.ref(`/users/${userId}/devices`).get();
    if (!devicesSnap.exists()) {
      return;
    }

    const devices = devicesSnap.val() as Record<
      string,
      { deviceName?: string; fcmToken?: string }
    >;
    const fcmTokens: string[] = [];

    for (const dev of Object.values(devices)) {
      if (dev.fcmToken && dev.deviceName !== sourceDevice) {
        fcmTokens.push(dev.fcmToken);
      }
    }

    if (fcmTokens.length === 0) {
      console.log(`No recipient FCM tokens for user ${userId}`);
      return;
    }

    // 2. Prepare notification payload
    const title = `New Clip from ${sourceDevice}`;
    const body =
      clip.type === "image"
        ? "Image clip received"
        : "Tap to open and view clip";

    // 3. Send high-priority multicast notification
    const response = await admin.messaging().sendEachForMulticast({
      tokens: fcmTokens,
      notification: {
        title,
        body,
      },
      data: {
        clipId,
        sourceDevice,
        type: clip.type || "text",
      },
      android: {
        priority: "high",
        notification: {
          sound: "default",
          channelId: "viclip_sync_channel",
        },
      },
    });

    console.log(
      `Push notification sent for clip ${clipId}: ${response.successCount} succeeded, ${response.failureCount} failed`,
    );
  },
);
