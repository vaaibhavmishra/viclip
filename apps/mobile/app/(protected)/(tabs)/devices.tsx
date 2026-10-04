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
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import Toast from "react-native-toast-message";
import { colors } from "@/constants/theme";
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
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

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
        <View
          style={[
            styles.deviceCard,
            isDark ? styles.deviceCardDark : styles.deviceCardLight,
          ]}
        >
          <View
            style={[
              styles.deviceIconBox,
              isDark ? styles.deviceIconBoxDark : styles.deviceIconBoxLight,
            ]}
          >
            {item.platform === "Android" || item.platform === "iOS" ? (
              <Ionicons
                name="phone-portrait"
                size={32}
                color={colors.primary}
              />
            ) : (
              <Ionicons name="laptop" size={32} color={colors.primary} />
            )}
          </View>
          <View style={styles.deviceInfo}>
            <View style={styles.deviceNameRow}>
              <Text
                style={[
                  styles.deviceName,
                  { color: isDark ? colors.text.dark : colors.text.light },
                ]}
              >
                {item.deviceName}
              </Text>
              {isCurrentDevice && (
                <View
                  style={[
                    styles.thisDeviceBadge,
                    isDark
                      ? styles.thisDeviceBadgeDark
                      : styles.thisDeviceBadgeLight,
                  ]}
                >
                  <Text style={styles.thisDeviceBadgeText}>This Device</Text>
                </View>
              )}
            </View>
            <View style={styles.lastActiveRow}>
              <Ionicons name="time-outline" size={14} color="#6b7280" />
              <Text
                style={[
                  styles.lastActiveText,
                  {
                    color: isDark
                      ? colors.text.mutedDark
                      : colors.text.mutedLight,
                  },
                ]}
              >
                {formatLastActive(item.lastActive)}
              </Text>
            </View>
          </View>
          {!isCurrentDevice && (
            <TouchableOpacity
              onPress={() => handleRemoveDevice(item)}
              style={[
                styles.removeBtn,
                isDark ? styles.removeBtnDark : styles.removeBtnLight,
              ]}
              activeOpacity={0.7}
            >
              <Ionicons
                name="log-out-outline"
                size={20}
                color={colors.danger}
              />
            </TouchableOpacity>
          )}
        </View>
      );
    },
    [isDark, handleRemoveDevice],
  );

  if (isLoading && !refreshing) {
    return (
      <View
        style={[
          styles.loadingContainer,
          {
            backgroundColor: isDark
              ? colors.background.dark
              : colors.background.light,
          },
        ]}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isDark
            ? colors.background.dark
            : colors.background.light,
        },
      ]}
    >
      <FlatList
        style={styles.list}
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
          <View style={styles.emptyContainer}>
            <View
              style={[
                styles.emptyIconBox,
                isDark ? styles.emptyIconBoxDark : styles.emptyIconBoxLight,
              ]}
            >
              <Ionicons
                name={error ? "alert-circle-outline" : "desktop-outline"}
                size={56}
                color={error ? colors.danger : colors.primary}
              />
            </View>
            <Text
              style={[
                styles.emptyTitle,
                { color: isDark ? colors.text.dark : colors.text.light },
              ]}
            >
              {error ? "Oops! Something went wrong" : "No Devices Found"}
            </Text>
            <Text
              style={[
                styles.emptyDescription,
                {
                  color: isDark
                    ? colors.text.mutedDark
                    : colors.text.mutedLight,
                },
              ]}
            >
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  list: {
    flex: 1,
    paddingHorizontal: 20,
  },
  deviceCard: {
    borderWidth: 1,
    padding: 20,
    borderRadius: 24,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    shadowColor: "#1e3a8a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  deviceCardLight: {
    backgroundColor: colors.card.light,
    borderColor: colors.border.light,
  },
  deviceCardDark: {
    backgroundColor: colors.card.dark,
    borderColor: colors.border.dark,
  },
  deviceIconBox: {
    padding: 16,
    borderRadius: 16,
  },
  deviceIconBoxLight: {
    backgroundColor: colors.primaryTint,
  },
  deviceIconBoxDark: {
    backgroundColor: colors.primaryTintDark,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  deviceName: {
    fontWeight: "700",
    fontSize: 18,
  },
  thisDeviceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  thisDeviceBadgeLight: {
    backgroundColor: "#dbeafe",
  },
  thisDeviceBadgeDark: {
    backgroundColor: "rgba(37, 99, 235, 0.3)",
  },
  thisDeviceBadgeText: {
    color: colors.primaryLight,
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  lastActiveRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  lastActiveText: {
    fontWeight: "500",
    fontSize: 14,
  },
  removeBtn: {
    padding: 12,
    borderRadius: 16,
  },
  removeBtnLight: {
    backgroundColor: colors.dangerTint,
  },
  removeBtnDark: {
    backgroundColor: colors.dangerTintDark,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 80,
    paddingHorizontal: 32,
  },
  emptyIconBox: {
    padding: 24,
    borderRadius: 999,
    marginBottom: 24,
  },
  emptyIconBoxLight: {
    backgroundColor: colors.primaryTint,
  },
  emptyIconBoxDark: {
    backgroundColor: colors.primaryTintDark,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyDescription: {
    textAlign: "center",
    lineHeight: 22,
  },
});
