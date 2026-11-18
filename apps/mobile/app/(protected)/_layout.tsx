import { getAuth, type User } from "@react-native-firebase/auth";
import { Redirect, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import Toast from "react-native-toast-message";
import { colors } from "@/constants/theme";
import { logoutUser } from "@/services/auth";
import { BackgroundSyncProvider } from "@/services/backgroundSync";
import { isKeyLoaded, setActiveDEK } from "@/services/crypto";
import {
  getCurrentDeviceName,
  getDeviceId,
  listenOwnDeviceRemoval,
} from "@/services/firebase";
import {
  capturePushSession,
  isPushSessionCurrent,
} from "@/services/pushSession";
import { authStorage } from "@/services/secureStorage";
import { StateProvider } from "@/utils/statesContext";

export default function ProtectedLayout() {
  const auth = getAuth();
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [keyOwner, setKeyOwner] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const unsubscribeAuth = auth.onAuthStateChanged((currentUser) => {
      if (!mounted || currentUser?.uid !== auth.currentUser?.uid) return;
      setUser(currentUser);
      setKeyOwner(null);
      const session = currentUser ? capturePushSession(currentUser.uid) : null;
      if (currentUser && session) {
        try {
          if (!isKeyLoaded(currentUser.uid)) {
            const dek = authStorage.getMasterKey(currentUser.uid);
            if (dek && isPushSessionCurrent(session)) {
              setActiveDEK(dek, currentUser.uid);
            }
          }
          if (isPushSessionCurrent(session) && isKeyLoaded(currentUser.uid)) {
            setKeyOwner(currentUser.uid);
          }
        } catch {
          console.warn(
            "Unable to restore the current account's encryption key",
          );
        }
      }
      setInitializing(false);
    });

    return () => {
      mounted = false;
      unsubscribeAuth();
    };
  }, [auth]);

  // Set up remote logout listener — if another device removes this device
  // from Firebase, we log out immediately.
  useEffect(() => {
    if (!user || keyOwner !== user.uid) return;
    const session = capturePushSession(user.uid);
    if (!session) return;

    let isMounted = true;
    let hasTriggeredLogout = false;
    let unsubscribeRemoval: (() => void) | undefined;

    getDeviceId()
      .then((deviceId) => {
        if (!isMounted || !isPushSessionCurrent(session)) return;
        const deviceName = getCurrentDeviceName();

        unsubscribeRemoval = listenOwnDeviceRemoval(
          deviceName,
          () => {
            if (hasTriggeredLogout || !isPushSessionCurrent(session)) return;
            hasTriggeredLogout = true;

            Toast.show({
              type: "info",
              text1: "Device Removed",
              text2: "This device was removed from another device.",
            });
            // Delay logout so the toast is visible before the screen changes
            // Session invalidation must happen immediately; the toast can outlive this screen.
            setKeyOwner(null);
            void logoutUser().catch(() => {
              if (!isMounted) return;
              Toast.show({
                type: "error",
                text1: "Could Not Log Out",
                text2: "Please try logging out from Settings.",
              });
            });
          },
          deviceId,
        );
      })
      .catch(() => {
        if (isMounted && isPushSessionCurrent(session)) {
          console.warn("Unable to monitor this device's registration");
        }
      });

    return () => {
      isMounted = false;
      if (unsubscribeRemoval) unsubscribeRemoval();
    };
  }, [user, keyOwner]);

  if (initializing) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: colors.background.light,
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  const isKeyReady = keyOwner === user.uid && isKeyLoaded(user.uid);

  if (!isKeyReady) {
    return <Redirect href="/login" />;
  }

  return (
    <StateProvider>
      {/*
       * BackgroundSyncProvider registers the FCM push notification and sync
       * listeners exactly once for the entire authenticated session.
       * Any screen can read the current sync state via useBackgroundSync().
       */}
      <BackgroundSyncProvider key={user.uid}>
        <Stack screenOptions={{ headerShown: false }} />
      </BackgroundSyncProvider>
    </StateProvider>
  );
}
