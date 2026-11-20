import { getAuth } from "@react-native-firebase/auth";
import {
  AuthorizationStatus,
  getInitialNotification,
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
import {
  AndroidImportance,
  setNotificationChannelAsync,
} from "expo-notifications";
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
import {
  AppState,
  type AppStateStatus,
  // biome-ignore lint/correctness/useReactNativePlatformComponents: Platform-guarded Android notification permissions
  PermissionsAndroid,
  Platform,
} from "react-native";
import Toast from "react-native-toast-message";
import { decryptClips, writeClipToClipboard } from "./clipboard";
import { isKeyLoaded } from "./crypto";
import {
  getClips,
  getCurrentDeviceName,
  getDeviceId,
  updateDeviceFCMToken,
} from "./firebase";
import {
  capturePushSession,
  isPushSessionCurrent,
  type PushSession,
} from "./pushSession";

// ─── Storage key ─────────────────────────────────────────────────────────────

const SYNC_ENABLED_KEY = "viclip_sync_enabled";
const ANDROID_NOTIFICATION_CHANNEL_ID = "viclip_sync_notifications";

async function configureAndroidNotificationChannel(): Promise<void> {
  if (Platform.OS !== "android") return;

  try {
    await setNotificationChannelAsync(ANDROID_NOTIFICATION_CHANNEL_ID, {
      name: "Clipboard sync",
      description: "Alerts when a clip arrives from another ViClip device.",
      importance: AndroidImportance.HIGH,
      enableVibrate: true,
      vibrationPattern: [0, 250, 150, 250],
      showBadge: true,
    });
  } catch {
    console.warn("[FCM] Unable to configure Android notification channel");
  }
}

// ─── Register Background Message Handler (Runs when app is in background/killed) ───

try {
  const messagingInstance = getMessaging();
  setBackgroundMessageHandler(
    messagingInstance,
    async (remoteMessage: RemoteMessage) => {
      // Background delivery displays the server's generic alert only. Clipboard
      // access and decryption require an active, authenticated foreground session.
      void remoteMessage;
    },
  );
} catch {
  console.debug("[FCM] Background message handler not registered");
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
  requestNotificationPermission: (
    options?: { showToast?: boolean } | boolean,
  ) => Promise<boolean>;
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

export interface ClipNotification {
  clipId: string;
  userId: string;
  sessionId: string;
}

function validIdentifier(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 256 &&
    !/[.#$[\]/]/.test(value) &&
    !Array.from(value).some(
      (character) =>
        character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    )
  );
}

/** Unscoped legacy notifications are ignored instead of crossing accounts. */
export function parseClipNotification(
  message: RemoteMessage,
): ClipNotification | null {
  const data = message?.data;
  if (
    !data ||
    !validIdentifier(data.clipId) ||
    !validIdentifier(data.userId) ||
    !validIdentifier(data.sessionId)
  )
    return null;
  return {
    clipId: data.clipId,
    userId: data.userId,
    sessionId: data.sessionId,
  };
}

const notificationQueues = new WeakMap<PushSession, Promise<void>>();
const copiedMessages = new Set<string>();

/**
 * Automatically fetch, decrypt, and copy a clip to the system clipboard
 * when a push notification is tapped or received.
 */
export function handleCopyClipFromNotification(
  remoteMessage: RemoteMessage,
  session: PushSession | null = capturePushSession(
    getAuth().currentUser?.uid || "",
  ),
  isAllowed: () => boolean = () => AppState.currentState === "active",
): Promise<void> {
  const payload = parseClipNotification(remoteMessage);
  if (
    !payload ||
    !session ||
    payload.userId !== session.userId ||
    payload.sessionId !== session.id ||
    !isPushSessionCurrent(session)
  )
    return Promise.resolve();
  const operation = (notificationQueues.get(session) ?? Promise.resolve())
    .catch(() => {})
    .then(async () => {
      const canCopy = () =>
        isAllowed() && isPushSessionCurrent(session) && isKeyLoaded();
      if (!canCopy()) return;
      try {
        // Ensure key is loaded
        // Authenticated session restoration owns key loading; push input cannot restore keys.
        const rawClips = await getClips(session);
        if (!canCopy() || !rawClips) return;
        const decrypted = decryptClips(rawClips);
        const targetClip = Object.entries(decrypted).find(
          ([key, clip]) => key === payload.clipId || clip.id === payload.clipId,
        )?.[1];
        const messageKey = `${session.id}:${remoteMessage.messageId || `${payload.clipId}:${targetClip?.timestamp}`}`;
        if (
          copiedMessages.has(messageKey) ||
          !targetClip?.content ||
          targetClip.decryptionFailed ||
          !canCopy()
        )
          return;
        await writeClipToClipboard(targetClip.content, session, canCopy);
        if (!canCopy()) return;
        copiedMessages.add(messageKey);
        if (copiedMessages.size > 100)
          copiedMessages.delete(copiedMessages.values().next().value as string);
        Toast.show({
          type: "success",
          text1: "Copied to Clipboard!",
          text2: "Your clip is ready to paste.",
          visibilityTime: 2500,
        });
      } catch {
        console.warn("[FCM] Unable to copy notification clip");
        if (canCopy())
          Toast.show({
            type: "error",
            text1: "Could Not Copy Clip",
            text2: "Open ViClip and try receiving the clip again.",
          });
      }
    });
  notificationQueues.set(session, operation);
  const release = () => {
    if (notificationQueues.get(session) === operation)
      notificationQueues.delete(session);
  };
  void operation.then(release, release);
  return operation;
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function BackgroundSyncProvider({
  children,
}: {
  children: React.ReactNode;
}): ReactElement {
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [tokenRegistered, setTokenRegistered] = useState(false);
  const [fcmToken, setFcmToken] = useState<string | null>(null);

  const syncEnabledRef = useRef(false);
  const notificationsEnabledRef = useRef(false);
  const permissionReadyRef = useRef(false);
  const mountedRef = useRef(false);
  const lifecycleRef = useRef(0);
  const preferenceReadyRef = useRef(false);
  const preferenceVersionRef = useRef(0);
  const registrationQueueRef = useRef<Promise<void>>(Promise.resolve());
  const registrationSessionRef = useRef<PushSession | null>(null);
  const preferenceQueueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingNotificationsRef = useRef<
    Array<{ message: RemoteMessage; session: PushSession }>
  >([]);
  const flushNotificationsRef = useRef<() => void>(() => {});

  // 3. Check OS notification permission
  const checkPermission = useCallback(async (): Promise<boolean> => {
    const lifecycle = lifecycleRef.current;
    try {
      let enabled = false;
      if (Platform.OS === "android") {
        if (Number(Platform.Version) >= 33) {
          const postNotif =
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS ||
            "android.permission.POST_NOTIFICATIONS";
          enabled = await PermissionsAndroid.check(postNotif);
        } else {
          const authStatus = await hasPermission(getMessaging());
          enabled =
            authStatus === AuthorizationStatus.AUTHORIZED ||
            authStatus === AuthorizationStatus.PROVISIONAL;
        }
      } else {
        const authStatus = await hasPermission(getMessaging());
        enabled =
          authStatus === AuthorizationStatus.AUTHORIZED ||
          authStatus === AuthorizationStatus.PROVISIONAL;
      }
      if (mountedRef.current && lifecycleRef.current === lifecycle) {
        permissionReadyRef.current = true;
        notificationsEnabledRef.current = enabled;
        setNotificationsEnabled(enabled);
      }
      return enabled;
    } catch {
      if (mountedRef.current && lifecycleRef.current === lifecycle) {
        permissionReadyRef.current = true;
        notificationsEnabledRef.current = false;
        setNotificationsEnabled(false);
      }
      console.warn("[FCM] Failed to check notification permission");
      return false;
    }
  }, []);

  // 2. Register FCM token with Firebase RTDB
  const registerToken = useCallback((): Promise<void> => {
    const lifecycle = lifecycleRef.current;
    const session = capturePushSession(getAuth().currentUser?.uid || "");
    if (session !== registrationSessionRef.current) {
      registrationSessionRef.current = session;
      registrationQueueRef.current = Promise.resolve();
    }
    const active = () =>
      mountedRef.current &&
      lifecycleRef.current === lifecycle &&
      !!session &&
      isPushSessionCurrent(session);
    const operation = registrationQueueRef.current
      .catch(() => {})
      .then(async () => {
        if (!session || !active() || !preferenceReadyRef.current) return;
        try {
          // 1. Check current OS notification permission first
          const permissionGranted = await checkPermission();
          if (!active()) return;
          const enabled = () =>
            active() &&
            preferenceReadyRef.current &&
            syncEnabledRef.current &&
            notificationsEnabledRef.current;
          if (!permissionGranted || !enabled()) {
            // Disabled or denied notifications must not retain a server token binding.
            await updateDeviceFCMToken(session.userId, "", session, active);
            if (active()) {
              setTokenRegistered(false);
              setFcmToken(null);
            }
            return;
          }
          // 3. Register device token once permissions are verified
          const token = await getToken(getMessaging());
          if (!enabled() || !token) return;
          const registered = await updateDeviceFCMToken(
            session.userId,
            token,
            session,
            enabled,
          );
          if (!enabled()) return;
          setFcmToken(token);
          setTokenRegistered(registered);
        } catch {
          console.warn("[FCM] Failed to register notification token");
          if (active()) setTokenRegistered(false);
        }
      });
    registrationQueueRef.current = operation;
    return operation;
  }, [checkPermission]);

  const toggleSync = useCallback(
    async (enabled: boolean) => {
      const lifecycle = lifecycleRef.current;
      const session = capturePushSession(getAuth().currentUser?.uid || "");
      if (!session || !mountedRef.current) return;
      const version = ++preferenceVersionRef.current;
      preferenceReadyRef.current = true;
      syncEnabledRef.current = enabled;
      setSyncEnabled(enabled);
      if (!enabled) setTokenRegistered(false);
      const persist = preferenceQueueRef.current
        .catch(() => {})
        .then(() =>
          SecureStore.setItemAsync(SYNC_ENABLED_KEY, String(enabled)),
        );
      preferenceQueueRef.current = persist;
      try {
        await persist;
      } catch {
        // Fail closed if enabling could not be persisted; disabling stays disabled.
        if (
          mountedRef.current &&
          lifecycleRef.current === lifecycle &&
          isPushSessionCurrent(session) &&
          version === preferenceVersionRef.current
        ) {
          syncEnabledRef.current = false;
          setSyncEnabled(false);
        }
        if (mountedRef.current && lifecycleRef.current === lifecycle)
          await registerToken();
        throw new Error(
          "Could not save notification preference. Please try again.",
        );
      }
      if (
        mountedRef.current &&
        lifecycleRef.current === lifecycle &&
        isPushSessionCurrent(session)
      ) {
        await registerToken();
        flushNotificationsRef.current();
      }
    },
    [registerToken],
  );

  // 4. Request OS notification permission
  const requestNotificationPermission = useCallback(
    async (options?: { showToast?: boolean } | boolean): Promise<boolean> => {
      const lifecycle = lifecycleRef.current;
      const showToast =
        typeof options === "boolean" ? options : (options?.showToast ?? true);
      const session = capturePushSession(getAuth().currentUser?.uid || "");
      if (!session || !mountedRef.current) return false;
      // 2. Prompt user if notification permission is not yet granted
      try {
        let enabled = false;
        if (Platform.OS === "android") {
          if (Number(Platform.Version) >= 33) {
            const postNotif =
              PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS ||
              "android.permission.POST_NOTIFICATIONS";
            enabled =
              (await PermissionsAndroid.request(postNotif)) ===
              PermissionsAndroid.RESULTS.GRANTED;
          } else {
            const authStatus = await hasPermission(getMessaging());
            enabled =
              authStatus === AuthorizationStatus.AUTHORIZED ||
              authStatus === AuthorizationStatus.PROVISIONAL;
          }
        } else {
          const authStatus = await requestPermission(getMessaging());
          enabled =
            authStatus === AuthorizationStatus.AUTHORIZED ||
            authStatus === AuthorizationStatus.PROVISIONAL;
        }
        if (
          !mountedRef.current ||
          lifecycleRef.current !== lifecycle ||
          !isPushSessionCurrent(session)
        )
          return false;
        notificationsEnabledRef.current = enabled;
        setNotificationsEnabled(enabled);
        // Always register device token with RTDB
        // Reconcile the binding with permission and preference, removing it when denied.
        await registerToken();
        if (
          enabled &&
          showToast &&
          mountedRef.current &&
          lifecycleRef.current === lifecycle &&
          isPushSessionCurrent(session)
        ) {
          Toast.show({
            type: "success",
            text1: "Notifications Enabled",
            text2:
              "You will receive alerts when clips are added from your devices.",
          });
        }
        return enabled;
      } catch {
        console.warn("[FCM] Unable to request notification permission");
        return false;
      }
    },
    [registerToken],
  );

  // 1. Load persisted preference on mount
  // 5. Initial check, token registration & app lifecycle listener
  useEffect(() => {
    lifecycleRef.current += 1;
    mountedRef.current = true;
    preferenceReadyRef.current = false;
    permissionReadyRef.current = false;
    registrationQueueRef.current = Promise.resolve();
    registrationSessionRef.current = null;
    let disposed = false;
    const loadedVersion = preferenceVersionRef.current;
    const initNotifications = async () => {
      await configureAndroidNotificationChannel();
      if (disposed) return;
      try {
        const value = await SecureStore.getItemAsync(SYNC_ENABLED_KEY);
        if (disposed) return;
        if (loadedVersion === preferenceVersionRef.current) {
          const enabled = value !== "false";
          syncEnabledRef.current = enabled;
          setSyncEnabled(enabled);
        }
        preferenceReadyRef.current = true;
      } catch {
        if (disposed) return;
        if (loadedVersion === preferenceVersionRef.current) {
          preferenceReadyRef.current = true;
          syncEnabledRef.current = false;
          setSyncEnabled(false);
          Toast.show({
            type: "error",
            text1: "Notifications Paused",
            text2:
              "Could not read your preference. Enable notifications in Settings to retry.",
          });
        }
      }
      if (!disposed) {
        await registerToken();
        flushNotificationsRef.current();
      }
    };
    void initNotifications();
    // Re-register token if user logs in
    const unsubscribeAuth = getAuth().onAuthStateChanged(() => {
      if (disposed) return;
      setFcmToken(null);
      setTokenRegistered(false);
      void registerToken();
    });
    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (next === "active" && !disposed)
        void registerToken().then(() => {
          if (!disposed) flushNotificationsRef.current();
        });
    });
    return () => {
      disposed = true;
      lifecycleRef.current += 1;
      mountedRef.current = false;
      unsubscribeAuth();
      sub.remove();
    };
  }, [registerToken]);

  // 6. Listen for incoming foreground messages
  useEffect(() => {
    const lifecycle = lifecycleRef.current;
    const messagingInstance = getMessaging();
    const allowed = () =>
      mountedRef.current &&
      lifecycleRef.current === lifecycle &&
      syncEnabledRef.current &&
      notificationsEnabledRef.current &&
      AppState.currentState === "active";
    const flushPending = () => {
      if (
        !mountedRef.current ||
        lifecycleRef.current !== lifecycle ||
        !preferenceReadyRef.current ||
        !permissionReadyRef.current
      )
        return;
      if (!syncEnabledRef.current || !notificationsEnabledRef.current) {
        pendingNotificationsRef.current = [];
        return;
      }
      if (!allowed()) return;
      const pending = pendingNotificationsRef.current;
      pendingNotificationsRef.current = [];
      for (const item of pending) {
        void handleCopyClipFromNotification(
          item.message,
          item.session,
          allowed,
        );
      }
    };
    flushNotificationsRef.current = flushPending;
    const handleOpened = (message: RemoteMessage) => {
      const payload = parseClipNotification(message);
      const session = capturePushSession(getAuth().currentUser?.uid || "");
      if (
        !mountedRef.current ||
        lifecycleRef.current !== lifecycle ||
        !payload ||
        !session ||
        payload.userId !== session.userId ||
        payload.sessionId !== session.id
      )
        return;
      pendingNotificationsRef.current.push({ message, session });
      if (pendingNotificationsRef.current.length > 20)
        pendingNotificationsRef.current.shift();
      flushPending();
    };
    const unsubscribeOnMessage = onMessage(
      messagingInstance,
      (remoteMessage: RemoteMessage) => {
        const payload = parseClipNotification(remoteMessage);
        const session = capturePushSession(getAuth().currentUser?.uid || "");
        if (
          !allowed() ||
          !payload ||
          !session ||
          payload.userId !== session.userId ||
          payload.sessionId !== session.id
        )
          return;
        getDeviceId()
          .then((currentDeviceId) => {
            if (!allowed() || !isPushSessionCurrent(session)) return;
            const sourceDeviceId = remoteMessage.data?.sourceDeviceId;
            const sourceDevice = remoteMessage.data?.sourceDevice;
            if (
              sourceDeviceId === currentDeviceId ||
              (!sourceDeviceId && sourceDevice === getCurrentDeviceName())
            )
              return;
            Toast.show({
              type: "info",
              text1: "New Clip Received",
              text2: "Tap to copy to clipboard",
              onPress: () => {
                Toast.hide();
                if (allowed() && isPushSessionCurrent(session))
                  void handleCopyClipFromNotification(
                    remoteMessage,
                    session,
                    allowed,
                  );
              },
            });
          })
          .catch(() =>
            console.warn("[FCM] Unable to process foreground notification"),
          );
      },
    );

    // 7. Listen for token refreshes
    const unsubscribeOnTokenRefresh = onTokenRefresh(messagingInstance, () => {
      // Re-fetch the current token in the serialized registration queue.
      if (mountedRef.current && lifecycleRef.current === lifecycle)
        void registerToken();
    });

    // 8. Handle user tapping notification while app was backgrounded
    const unsubscribeOnOpened = onNotificationOpenedApp(
      messagingInstance,
      handleOpened,
    );

    // 9. Handle user tapping notification when app was opened from quit state
    const initialSession = capturePushSession(getAuth().currentUser?.uid || "");
    getInitialNotification(messagingInstance)
      .then((remoteMessage) => {
        if (
          remoteMessage &&
          initialSession &&
          isPushSessionCurrent(initialSession)
        ) {
          handleOpened(remoteMessage);
        }
      })
      .catch(() => console.warn("[FCM] Unable to read initial notification"));
    return () => {
      pendingNotificationsRef.current = [];
      flushNotificationsRef.current = () => {};
      unsubscribeOnMessage();
      unsubscribeOnTokenRefresh();
      unsubscribeOnOpened();
    };
  }, [registerToken]);

  return (
    <BackgroundSyncContext.Provider
      value={{
        notificationsEnabled,
        syncEnabled,
        tokenRegistered,
        fcmToken,
        toggleSync,
        requestNotificationPermission,
        refreshStatus: async () => {
          await registerToken();
          return notificationsEnabledRef.current;
        },
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
