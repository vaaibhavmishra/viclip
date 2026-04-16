import Ionicons from '@expo/vector-icons/Ionicons'
import { getAuth } from '@react-native-firebase/auth'
import { router } from 'expo-router'
import React from 'react'
import {
  ActivityIndicator,
  Image,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { logoutUser } from '@/services/auth'
import { useBackgroundSync } from '@/services/backgroundSync'

// ─── Background Sync Status Card ──────────────────────────────────────────────

function SyncStatusCard() {
  const {
    accessibilityEnabled,
    serviceRunning,
    isSyncing,
    openAccessibilitySettings,
  } = useBackgroundSync()

  // Determine status pill color and label
  const statusColor = serviceRunning
    ? '#22c55e' // green
    : accessibilityEnabled
      ? '#f59e0b' // amber – enabled but service not yet alive
      : '#ef4444' // red  – not enabled

  const statusLabel = serviceRunning
    ? 'Active'
    : accessibilityEnabled
      ? 'Starting…'
      : 'Disabled'

  const statusDesc = serviceRunning
    ? 'Clipboard changes are being synced in the background.'
    : accessibilityEnabled
      ? 'The service is enabled but not yet running. Try restarting the app.'
      : 'Enable the accessibility service so ViClip can sync clipboard changes even when the app is closed.'

  return (
    <View className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-3xl mb-6 shadow-sm shadow-blue-900/5 overflow-hidden">
      {/* Header row */}
      <View className="flex-row items-center justify-between p-5 border-b border-gray-100 dark:border-zinc-800/50">
        <View className="flex-row items-center gap-3">
          <View className="bg-blue-50 dark:bg-blue-900/20 p-2.5 rounded-xl">
            <Ionicons name="sync" size={20} color="#2563eb" />
          </View>
          <View>
            <Text className="text-base font-semibold dark:text-white text-gray-900">
              Background Sync
            </Text>
            <Text className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              Accessibility Service
            </Text>
          </View>
        </View>

        {/* Status pill */}
        <View
          className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full"
          style={{ backgroundColor: `${statusColor}18` }}
        >
          {isSyncing ? (
            <ActivityIndicator size={10} color={statusColor} />
          ) : (
            <View
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: statusColor }}
            />
          )}
          <Text
            className="text-xs font-bold"
            style={{ color: statusColor }}
          >
            {isSyncing ? 'Syncing…' : statusLabel}
          </Text>
        </View>
      </View>

      {/* Description */}
      <View className="px-5 pt-4 pb-2">
        <Text className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
          {statusDesc}
        </Text>
      </View>

      {/* CTA button – only when not yet enabled */}
      {!accessibilityEnabled && (
        <TouchableOpacity
          onPress={openAccessibilitySettings}
          activeOpacity={0.75}
          className="mx-5 mb-5 mt-3 bg-blue-600 rounded-2xl flex-row items-center justify-center gap-2 py-3"
        >
          <Ionicons name="accessibility" size={18} color="white" />
          <Text className="text-white font-bold text-sm">
            Enable in Accessibility Settings
          </Text>
        </TouchableOpacity>
      )}

      {/* Service live indicator */}
      {serviceRunning && (
        <View className="flex-row items-center gap-2 mx-5 mb-5 mt-3 bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/30 rounded-2xl px-4 py-3">
          <Ionicons name="checkmark-circle" size={18} color="#22c55e" />
          <Text className="text-green-700 dark:text-green-400 text-sm font-medium">
            Service is running — clipboard syncs automatically
          </Text>
        </View>
      )}
    </View>
  )
}

// ─── Main Settings Screen ──────────────────────────────────────────────────────

export default function Settings() {
  const auth = getAuth()
  const user = auth.currentUser
  const userEmail = user?.email
  const userPhoto = user?.photoURL
  const userName = user?.displayName

  return (
    <ScrollView
      className="flex-1 bg-[#f9fafb] dark:bg-black"
      contentContainerStyle={{
        padding: 20,
        paddingBottom: 150,
        paddingTop: Platform.OS === 'ios' ? 130 : 110,
      }}
    >
      {/* Profile Section */}
      <View className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 p-6 rounded-3xl mb-6 shadow-sm shadow-blue-900/5 items-center">
        <View className="p-1.5 rounded-full bg-blue-50 dark:bg-blue-900/20 mb-4">
          <Image
            source={
              userPhoto
                ? { uri: userPhoto }
                : require('../../../assets/images/default-avatar.png')
            }
            className="w-24 h-24 rounded-full"
          />
        </View>
        <Text className="font-bold text-2xl dark:text-white text-gray-900 mb-1 text-center">
          {userName?.slice(0, 25) || 'User'}
        </Text>
        <Text className="text-gray-500 dark:text-gray-400 font-medium text-base text-center">
          {userEmail?.slice(0, 35)}
        </Text>
      </View>

      {/* Background Sync Section — Android only */}
      {Platform.OS === 'android' && <SyncStatusCard />}

      {/* Logout Button */}
      <TouchableOpacity
        onPress={() => {
          logoutUser()
          router.replace('/login')
        }}
        className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 p-4 rounded-3xl flex-row items-center justify-center gap-2 mt-4"
        activeOpacity={0.7}
      >
        <Ionicons name="log-out-outline" size={24} color="#ef4444" />
        <Text className="text-center text-red-500 font-bold text-lg">
          Log Out
        </Text>
      </TouchableOpacity>
    </ScrollView>
  )
}
