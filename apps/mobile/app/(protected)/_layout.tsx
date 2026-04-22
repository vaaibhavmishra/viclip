import { getAuth } from "@react-native-firebase/auth";
import { Redirect, Stack } from "expo-router";
import { BackgroundSyncProvider } from "@/services/backgroundSync";
import { setActiveDEK } from "@/services/crypto";
import { authStorage } from "@/services/secureStorage";
import { StateProvider } from "@/utils/statesContext";

export default function ProtectedLayout() {
  const auth = getAuth();
  const user = auth.currentUser;

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
