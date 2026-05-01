import Ionicons from "@expo/vector-icons/Ionicons";
import type { DeviceData } from "@viclip/types";
import * as Device from "expo-device";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Toast from "react-native-toast-message";
import { getDevices, listenDevices, removeDevice } from "@/services/firebase";
import { formatLastActive } from "@/utils/util";

interface ExtendedDeviceData extends DeviceData {
  firebaseKey: string;
}

function devicesRecordToSortedArray(
  devices: Record<string, DeviceData> | null,
): ExtendedDeviceData[] {
  if (!devices) return [];
  return Object.entries(devices)
    .map(([key, value]) => ({
      ...value,
      firebaseKey: key,
    }))
    .sort(
      (a, b) =>
        new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime(),
    );
}

export default function Devices() {
  const [devicesList, setDevicesList] = useState<ExtendedDeviceData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Real-time listener — device list updates instantly when any device
  // is added or removed from Firebase (including from the desktop app).
  useEffect(() => {
    const unsubscribe = listenDevices((devices) => {
      setDevicesList(devicesRecordToSortedArray(devices));
      setIsLoading(false);
      setError(null);
    });

    return () => unsubscribe();
  }, []);

  // Pull-to-refresh as a manual fallback
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const devices = await getDevices();
      setDevicesList(devicesRecordToSortedArray(devices));
      setError(null);
    } catch (err) {
      console.error("Error fetching devices:", err);
      setError("Failed to load devices. Please try again.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  const handleRemoveDevice = useCallback((device: ExtendedDeviceData) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Alert.alert(
      "Remove Device",
      `Are you sure you want to remove "${device.deviceName || "Unknown Device"}"? It will need to sign in again to sync.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            // Optimistic UI update
            setDevicesList((prev) =>
              prev.filter((d) => d.firebaseKey !== device.firebaseKey),
            );

            try {
              await removeDevice(device.firebaseKey);
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
              );
              Toast.show({
                type: "success",
                text1: "Device Removed",
                text2: `${device.deviceName || "Device"} has been logged out.`,
              });
            } catch {
              // Real-time listener will auto-revert, but show error toast
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Toast.show({
                type: "error",
                text1: "Failed to Remove",
                text2: "Please try again later.",
              });
            }
          },
        },
      ],
    );
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: ExtendedDeviceData }) => {
      const isCurrentDevice = item.deviceName === Device.deviceName;

      return (
        <View className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 p-5 rounded-3xl mb-4 flex-row items-center gap-5 shadow-sm shadow-blue-900/5">
          <View className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl">
            {item.platform === "Android" || item.platform === "iOS" ? (
              <Ionicons name="phone-portrait" size={32} color="#2563eb" />
            ) : (
              <Ionicons name="laptop" size={32} color="#2563eb" />
            )}
          </View>
          <View className="flex-1">
            <View className="flex-row items-center gap-2 mb-1">
              <Text className="text-gray-900 dark:text-white font-bold text-lg">
                {item.deviceName}
              </Text>
              {isCurrentDevice && (
                <View className="bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 rounded-full">
                  <Text className="text-blue-600 dark:text-blue-400 text-[10px] font-bold uppercase tracking-wide">
                    This Device
                  </Text>
                </View>
              )}
            </View>
            <View className="flex-row items-center gap-1.5">
              <Ionicons name="time-outline" size={14} color="#6b7280" />
              <Text className="text-gray-500 dark:text-gray-400 font-medium text-sm">
                {formatLastActive(item.lastActive)}
              </Text>
            </View>
          </View>
          {!isCurrentDevice && (
            <TouchableOpacity
              onPress={() => handleRemoveDevice(item)}
              className="bg-red-50 dark:bg-red-900/10 p-3 rounded-2xl"
              activeOpacity={0.7}
            >
              <Ionicons name="log-out-outline" size={20} color="#ef4444" />
            </TouchableOpacity>
          )}
        </View>
      );
    },
    [handleRemoveDevice],
  );

  if (isLoading && !refreshing) {
    return (
      <View className="flex-1 justify-center items-center dark:bg-black bg-[#f9fafb]">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#f9fafb] dark:bg-black">
      <FlatList
        className="flex-1 px-5"
        contentContainerStyle={{
          paddingBottom: 150,
          paddingTop: Platform.OS === "ios" ? 130 : 110,
        }}
        data={devicesList}
        keyExtractor={(item) => item.firebaseKey}
        renderItem={renderItem}
        refreshing={refreshing}
        onRefresh={onRefresh}
        ListEmptyComponent={
          <View className="flex-1 justify-center items-center mt-20 px-8">
            <View className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-full mb-6">
              <Ionicons
                name={error ? "alert-circle-outline" : "desktop-outline"}
                size={56}
                color={error ? "#ef4444" : "#2563eb"}
              />
            </View>
            <Text className="dark:text-white text-gray-900 text-xl font-bold mb-2 text-center">
              {error ? "Oops! Something went wrong" : "No Devices Found"}
            </Text>
            <Text className="dark:text-gray-400 text-gray-500 text-center leading-relaxed">
              {error
                ? error
                : "Any devices you log into will appear here so you can manage your connections."}
            </Text>
          </View>
        }
      />
    </View>
  );
}
