import Ionicons from '@expo/vector-icons/Ionicons'
import { useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { getDevices } from '@/services/firebase'
import { DeviceData } from '@/types/device'
import { formatLastActive } from '@/utils/util'

export default function Devices() {
  const [devicesList, setDevicesList] = useState<DeviceData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchDevices = useCallback(async () => {
    try {
      const devices = await getDevices()
      setDevicesList(devices ? Object.values(devices) : [])
      setError(null)
    } catch (err) {
      console.error('Error fetching devices:', err)
      setError('Failed to load devices. Please try again.')
    } finally {
      setIsLoading(false)
      setRefreshing(false)
    }
  }, [])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    fetchDevices()
  }, [fetchDevices])

  useFocusEffect(
    useCallback(() => {
      fetchDevices()
      return () => {}
    }, [fetchDevices]),
  )

  const renderItem = useCallback(
    ({ item }: { item: DeviceData }) => (
      <View className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 p-5 rounded-3xl mb-4 flex-row items-center gap-5 shadow-sm shadow-blue-900/5">
        <View className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl">
          {item.platform === 'Android' || item.platform === 'iOS' ? (
            <Ionicons name="phone-portrait" size={32} color="#2563eb" />
          ) : (
            <Ionicons name="laptop" size={32} color="#2563eb" />
          )}
        </View>
        <View className="flex-1">
          <Text className="text-gray-900 dark:text-white font-bold text-lg mb-1">
            {item.deviceName}
          </Text>
          <View className="flex-row items-center gap-1.5">
            <Ionicons name="time-outline" size={14} color="#6b7280" />
            <Text className="text-gray-500 dark:text-gray-400 font-medium text-sm">
              {formatLastActive(item.lastActive)}
            </Text>
          </View>
        </View>
      </View>
    ),
    [],
  )

  if (isLoading && !refreshing) {
    return (
      <View className="flex-1 justify-center items-center dark:bg-black bg-[#f9fafb]">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    )
  }

  return (
    <View className="flex-1 bg-[#f9fafb] dark:bg-black">
      <FlatList
        className="flex-1 px-5"
        contentContainerStyle={{
          paddingBottom: 150,
          paddingTop: Platform.OS === 'ios' ? 130 : 110,
        }}
        data={devicesList}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshing={refreshing}
        onRefresh={onRefresh}
        ListEmptyComponent={
          <View className="flex-1 justify-center items-center mt-20 px-8">
            <View className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-full mb-6">
              <Ionicons
                name={error ? 'alert-circle-outline' : 'desktop-outline'}
                size={56}
                color={error ? '#ef4444' : '#2563eb'}
              />
            </View>
            <Text className="dark:text-white text-gray-900 text-xl font-bold mb-2 text-center">
              {error ? 'Oops! Something went wrong' : 'No Devices Found'}
            </Text>
            <Text className="dark:text-gray-400 text-gray-500 text-center leading-relaxed">
              {error
                ? error
                : 'Any devices you log into will appear here so you can manage your connections.'}
            </Text>
          </View>
        }
      />
    </View>
  )
}
