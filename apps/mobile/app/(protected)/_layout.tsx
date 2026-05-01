import { getAuth } from "@react-native-firebase/auth";
import * as Device from "expo-device";
import { Redirect, router, Stack } from "expo-router";
import { useEffect } from "react";
import Toast from "react-native-toast-message";
import { logoutUser } from "@/services/auth";
import { BackgroundSyncProvider } from "@/services/backgroundSync";
import { setActiveDEK } from "@/services/crypto";
import { listenOwnDeviceRemoval } from "@/services/firebase";
import { authStorage } from "@/services/secureStorage";
import { StateProvider } from "@/utils/statesContext";

export default function ProtectedLayout() {
  const auth = getAuth();
  const user = auth.currentUser;

  // Set up remote logout listener — if another device removes this device
  // from Firebase, we log out immediately.
  useEffect(() => {
    if (!user) return;

    const deviceName = Device.deviceName ?? "";
    if (!deviceName) return;

    const unsubscribe = listenOwnDeviceRemoval(deviceName, () => {
      Toast.show({
        type: "info",
        text1: "Logged Out Remotely",
        text2: "This device was removed from another device.",
      });
      // Delay logout so the toast is visible before the screen changes
      setTimeout(() => {
        logoutUser();
        router.replace("/login");
      }, 1500);
    });

    return () => unsubscribe();
  }, [user]);

  if (!user) {
    return <Redirect href="/login" />;
  } else {
    const dek = authStorage.getMasterKey();
    if (!dek) {
      return <Redirect href="/login" />;
    }
    setActiveDEK(dek);
  }

  return (
    <StateProvider>
      {/*
       * BackgroundSyncProvider registers the native Accessibility Service
       * event listeners exactly once for the entire authenticated session.
       * Any screen can read the current sync state via useBackgroundSync().
       */}
      <BackgroundSyncProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </BackgroundSyncProvider>
    </StateProvider>
  );
}
