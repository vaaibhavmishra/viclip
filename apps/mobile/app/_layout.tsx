import { Stack } from "expo-router";
import { ShareIntentProvider } from "expo-share-intent";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import "./global.css";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ShareIntentProvider>
        <StatusBar style="auto" />
        <Stack
          screenOptions={{
            headerShown: false,
            animation: "none",
          }}
        >
          <Stack.Screen name="(protected)" />
          <Stack.Screen name="login" />
        </Stack>
        <Toast />
      </ShareIntentProvider>
    </SafeAreaProvider>
  );
}
