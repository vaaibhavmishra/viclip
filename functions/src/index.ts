import * as admin from "firebase-admin";
import { getDatabaseWithUrl } from "firebase-admin/database";
import { onValueCreated } from "firebase-functions/v2/database";

const TEST_RTDB_URL =
  "https://viclip-4c869-test.asia-southeast1.firebasedatabase.app/";

admin.initializeApp({
  databaseURL: TEST_RTDB_URL,
});

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

    // 1. Fetch user's registered devices from the active database instance
    const db = getDatabaseWithUrl(TEST_RTDB_URL);
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

    console.log(
      `Found ${fcmTokens.length} recipient device token(s) for user ${userId} (source: ${sourceDevice})`,
    );

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
          priority: "high",
        },
      },
      apns: {
        headers: {
          "apns-priority": "10",
        },
        payload: {
          aps: {
            sound: "default",
            badge: 1,
            contentAvailable: true,
          },
        },
      },
    });

    console.log(
      `Push notification sent for clip ${clipId}: ${response.successCount} succeeded, ${response.failureCount} failed`,
    );

    if (response.failureCount > 0) {
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          console.error(
            `FCM delivery error for token [${fcmTokens[idx]}]:`,
            resp.error,
          );
        }
      });
    }
  },
);
