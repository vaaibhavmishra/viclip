import * as Sentry from '@sentry/react-native'
import { Stack } from 'expo-router'
import { ShareIntentProvider } from 'expo-share-intent'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import Toast from 'react-native-toast-message'
import './global.css'

Sentry.init({
  dsn: 'https://a8c36d74ca9712011f9f240f71d714c1@o4507732755546112.ingest.de.sentry.io/4509248450330704',
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1,
  integrations: [Sentry.mobileReplayIntegration()],
})

export default Sentry.wrap(function RootLayout() {
  return (
    <SafeAreaProvider>
      <ShareIntentProvider>
        <StatusBar style="auto" />
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'none',
          }}
        >
          <Stack.Screen name="(protected)" />
          <Stack.Screen name="login" />
        </Stack>
        <Toast />
      </ShareIntentProvider>
    </SafeAreaProvider>
  )
})
