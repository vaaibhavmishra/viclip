import { getAuth } from "@react-native-firebase/auth";
import {
  AuthorizationStatus,
  getMessaging,
  getToken,
  hasPermission,
  onMessage,
  onNotificationOpenedApp,
  onTokenRefresh,
  type RemoteMessage,
  requestPermission,
  setBackgroundMessageHandler,
} from "@react-native-firebase/messaging";
import * as SecureStore from "expo-secure-store";
import React, {
  createContext,
  type ReactElement,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, type AppStateStatus } from "react-native";
import Toast from "react-native-toast-message";
import { updateDeviceFCMToken } from "./firebase";

// ─── Storage key ─────────────────────────────────────────────────────────────

const SYNC_ENABLED_KEY = "viclip_sync_enabled";

// ─── Register Background Message Handler (Runs when app is in background/killed) ───

try {
  const messagingInstance = getMessaging();
  setBackgroundMessageHandler(
    messagingInstance,
    async (remoteMessage: RemoteMessage) => {
      console.debug(
        "[FCM] Background message received:",
        remoteMessage.messageId,
      );
    },
  );
} catch (error) {
  console.debug("[FCM] Background message handler not registered:", error);
}

// ─── Context Interface ────────────────────────────────────────────────────────

export interface BackgroundSyncState {
  /** Whether push notifications are permitted by the OS */
  notificationsEnabled: boolean;
  /** Whether the user has enabled sync notifications in-app */
  syncEnabled: boolean;
  /** Whether FCM token is registered with Firebase */
  tokenRegistered: boolean;
  /** The current device FCM token */
  fcmToken: string | null;
  /** Toggle sync notifications on/off in-app */
  toggleSync: (enabled: boolean) => Promise<void>;
  /** Request OS notification permission */
  requestNotificationPermission: () => Promise<boolean>;
  /** Re-check notification status and refresh token */
  refreshStatus: () => Promise<boolean>;
}

const BackgroundSyncContext = createContext<BackgroundSyncState>({
  notificationsEnabled: false,
  syncEnabled: true,
  tokenRegistered: false,
  fcmToken: null,
  toggleSync: async () => {},
  requestNotificationPermission: async () => false,
  refreshStatus: async () => false,
});

// ─── Provider ────────────────────────────────────────────────────────────────

export function BackgroundSyncProvider({
  children,
}: {
  children: React.ReactNode;
}): ReactElement {
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [syncEnabled, setSyncEnabled] = useState(true);
  const [tokenRegistered, setTokenRegistered] = useState(false);
  const [fcmToken, setFcmToken] = useState<string | null>(null);

  const syncEnabledRef = useRef(true);

  // 1. Load persisted preference on mount
  useEffect(() => {
    SecureStore.getItemAsync(SYNC_ENABLED_KEY)
      .then((val) => {
        const enabled = val !== "false";
        setSyncEnabled(enabled);
        syncEnabledRef.current = enabled;
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    syncEnabledRef.current = syncEnabled;
  }, [syncEnabled]);

  const toggleSync = useCallback(async (enabled: boolean) => {
    setSyncEnabled(enabled);
    syncEnabledRef.current = enabled;
    try {
      await SecureStore.setItemAsync(SYNC_ENABLED_KEY, String(enabled));
    } catch {
      console.warn("[BackgroundSync] Failed to persist sync preference");
    }
  }, []);

  // 2. Register FCM token with Firebase RTDB
  const registerToken = useCallback(async () => {
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) return;

      const messagingInstance = getMessaging();
      const token = await getToken(messagingInstance);
      if (token) {
        setFcmToken(token);
        await updateDeviceFCMToken(user.uid, token);
        setTokenRegistered(true);
        console.debug("[FCM] Device token registered with Firebase RTDB");
      }
    } catch (err) {
      console.warn("[FCM] Failed to retrieve or register device token:", err);
      setTokenRegistered(false);
    }
  }, []);

  // 3. Check OS notification permission
  const checkPermission = useCallback(async (): Promise<boolean> => {
    try {
      const messagingInstance = getMessaging();
      const authStatus = await hasPermission(messagingInstance);
      const enabled =
        authStatus === AuthorizationStatus.AUTHORIZED ||
        authStatus === AuthorizationStatus.PROVISIONAL;
      setNotificationsEnabled(enabled);
      if (enabled) {
        await registerToken();
      }
      return enabled;
    } catch (err) {
      console.warn("[FCM] Failed to check permission:", err);
      setNotificationsEnabled(false);
      return false;
    }
  }, [registerToken]);

  // 4. Request OS notification permission
  const requestNotificationPermission =
    useCallback(async (): Promise<boolean> => {
      try {
        const messagingInstance = getMessaging();
        const authStatus = await requestPermission(messagingInstance);
        const enabled =
          authStatus === AuthorizationStatus.AUTHORIZED ||
          authStatus === AuthorizationStatus.PROVISIONAL;
        setNotificationsEnabled(enabled);

        if (enabled) {
          await registerToken();
          Toast.show({
            type: "success",
            text1: "Notifications Enabled",
            text2:
              "You will receive alerts when clips are added from your devices.",
          });
        }
        return enabled;
      } catch (err) {
        console.warn("[FCM] Error requesting notification permission:", err);
        return false;
      }
    }, [registerToken]);

  // 5. Initial check & check on app returning to active state
  useEffect(() => {
    checkPermission();

    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (next === "active") {
        checkPermission();
      }
    });

    return () => sub.remove();
  }, [checkPermission]);

  // 6. Listen for incoming foreground messages
  useEffect(() => {
    const messagingInstance = getMessaging();
    const unsubscribeOnMessage = onMessage(
      messagingInstance,
      (remoteMessage: RemoteMessage) => {
        if (!syncEnabledRef.current) return;

        console.debug("[FCM] Foreground message received:", remoteMessage);
        const title =
          remoteMessage.notification?.title ||
          (remoteMessage.data?.sourceDevice
            ? `New Clip from ${remoteMessage.data.sourceDevice}`
            : "New Clip Received");
        const body =
          remoteMessage.notification?.body || "Tap to open and view in ViClip";

        Toast.show({
          type: "info",
          text1: title,
          text2: body,
        });
      },
    );

    // 7. Listen for token refreshes
    const unsubscribeOnTokenRefresh = onTokenRefresh(
      messagingInstance,
      (newToken: string) => {
        setFcmToken(newToken);
        const auth = getAuth();
        const user = auth.currentUser;
        if (user) {
          updateDeviceFCMToken(user.uid, newToken).catch(console.error);
        }
      },
    );

    // 8. Handle user tapping notification while app was backgrounded
    const unsubscribeOnOpened = onNotificationOpenedApp(
      messagingInstance,
      (remoteMessage: RemoteMessage) => {
        console.debug(
          "[FCM] Notification opened app from background:",
          remoteMessage,
        );
      },
    );

    return () => {
      unsubscribeOnMessage();
      unsubscribeOnTokenRefresh();
      unsubscribeOnOpened();
    };
  }, []);

  return (
    <BackgroundSyncContext.Provider
      value={{
        notificationsEnabled,
        syncEnabled,
        tokenRegistered,
        fcmToken,
        toggleSync,
        requestNotificationPermission,
        refreshStatus: checkPermission,
      }}
    >
      {children}
    </BackgroundSyncContext.Provider>
  );
}

// ─── Consumer hook ────────────────────────────────────────────────────────────

export function useBackgroundSync(): BackgroundSyncState {
  return useContext(BackgroundSyncContext);
}
