import Ionicons from "@expo/vector-icons/Ionicons";
import { getAuth } from "@react-native-firebase/auth";
import { router } from "expo-router";
import {
  ActivityIndicator,
  Image,
  Platform,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { logoutUser } from "@/services/auth";
import { useBackgroundSync } from "@/services/backgroundSync";

// ─── Background Sync Status Card ──────────────────────────────────────────────

function SyncStatusCard() {
  const {
    accessibilityEnabled,
    serviceRunning,
    isSyncing,
    syncEnabled,
    toggleSync,
    openAccessibilitySettings,
  } = useBackgroundSync();

  // Once the accessibility service is granted we show a simple in-app toggle.
  // Before that, we guide the user to enable the service in Android Settings.
  const serviceGranted = accessibilityEnabled;

  // The toggle reflects the in-app syncEnabled state (not accessibilityEnabled).
  // When the service isn't granted yet, the toggle reflects whether the service
  // is enabled at the OS level (read-only at that point).
  const toggleValue = serviceGranted ? syncEnabled : false;

  // Status badge
  const statusColor = !serviceGranted
    ? "#ef4444" // red  – not set up
    : syncEnabled && serviceRunning
      ? isSyncing
        ? "#3b82f6"
        : "#22c55e" // blue while syncing, green active
      : syncEnabled
        ? "#f59e0b" // amber – enabled but not yet live
        : "#6b7280"; // grey  – paused

  const statusLabel = !serviceGranted
    ? "Not Set Up"
    : syncEnabled && serviceRunning
      ? isSyncing
        ? "Syncing…"
        : "Active"
      : syncEnabled
        ? "Starting…"
        : "Paused";

  const handleToggle = (value: boolean) => {
    if (!serviceGranted) {
      // Service not set up — send user to Accessibility Settings
      openAccessibilitySettings();
      return;
    }
    // Service already granted — simply pause/resume in-app
    toggleSync(value);
  };

  return (
    <View className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-3xl mb-6 shadow-sm shadow-blue-900/5 overflow-hidden">
      {/* ── Main toggle row ── */}
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => handleToggle(!toggleValue)}
        className="flex-row items-center justify-between px-5 py-4"
      >
        <View className="flex-row items-center gap-3 flex-1 mr-3">
          <View
            className="p-2.5 rounded-xl"
            style={{
              backgroundColor: toggleValue ? "#2563eb18" : "#6b728018",
            }}
          >
            <Ionicons
              name={toggleValue ? "sync" : "sync-outline"}
              size={20}
              color={toggleValue ? "#2563eb" : "#6b7280"}
            />
          </View>
          <View className="flex-1">
            <Text className="text-base font-semibold dark:text-white text-gray-900">
              Clipboard Sync
            </Text>
            <Text
              className="text-xs text-gray-400 dark:text-gray-500 mt-0.5"
              numberOfLines={1}
            >
              {!serviceGranted
                ? "Tap to enable in Accessibility Settings"
                : toggleValue
                  ? "Syncing across your devices"
                  : "Sync is paused"}
            </Text>
          </View>
        </View>

        {/* Switch — taps also handled by the parent TouchableOpacity */}
        <Switch
          value={toggleValue}
          onValueChange={handleToggle}
          thumbColor={toggleValue ? "#ffffff" : "#f4f4f5"}
          trackColor={{ false: "#e4e4e7", true: "#2563eb" }}
          ios_backgroundColor="#e4e4e7"
        />
      </TouchableOpacity>

      {/* ── Divider ── */}
      <View className="h-px bg-gray-100 dark:bg-zinc-800/50 mx-5" />

      {/* ── Status row ── */}
      <View className="flex-row items-center justify-between px-5 py-3.5">
        <Text className="text-sm text-gray-500 dark:text-gray-400 font-medium">
          Status
        </Text>
        <View
          className="flex-row items-center gap-1.5 px-3 py-1 rounded-full"
          style={{ backgroundColor: `${statusColor}18` }}
        >
          {isSyncing && syncEnabled ? (
            <ActivityIndicator size={10} color={statusColor} />
          ) : (
            <View
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: statusColor }}
            />
          )}
          <Text className="text-xs font-bold" style={{ color: statusColor }}>
            {statusLabel}
          </Text>
        </View>
      </View>

      {/* ── Info rows depending on state ── */}

      {/* Active + syncing */}
      {serviceGranted && syncEnabled && serviceRunning && (
        <>
          <View className="h-px bg-gray-100 dark:bg-zinc-800/50 mx-5" />
          <View className="flex-row items-center gap-2.5 px-5 py-3.5">
            <Ionicons name="checkmark-circle" size={16} color="#22c55e" />
            <Text className="text-sm text-gray-500 dark:text-gray-400 flex-1">
              Your text is being synced to all connected devices
            </Text>
          </View>
        </>
      )}

      {/* Paused */}
      {serviceGranted && !syncEnabled && (
        <>
          <View className="h-px bg-gray-100 dark:bg-zinc-800/50 mx-5" />
          <View className="flex-row items-center gap-2.5 px-5 py-3.5">
            <Ionicons name="pause-circle-outline" size={16} color="#6b7280" />
            <Text className="text-sm text-gray-500 dark:text-gray-400 flex-1">
              Sync is paused — flip the toggle above to resume
            </Text>
          </View>
        </>
      )}

      {/* Not set up — first-time CTA */}
      {!serviceGranted && (
        <>
          <View className="h-px bg-gray-100 dark:bg-zinc-800/50 mx-5" />
          <TouchableOpacity
            onPress={openAccessibilitySettings}
            activeOpacity={0.75}
            className="mx-5 my-4 bg-blue-600 rounded-2xl flex-row items-center justify-center gap-2 py-3"
          >
            <Ionicons name="accessibility" size={18} color="white" />
            <Text className="text-white font-bold text-sm">
              Enable in Accessibility Settings
            </Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

// ─── Main Settings Screen ──────────────────────────────────────────────────────

export default function Settings() {
  const auth = getAuth();
  const user = auth.currentUser;
  const userEmail = user?.email;
  const userPhoto = user?.photoURL;
  const userName = user?.displayName;

  return (
    <ScrollView
      className="flex-1 bg-[#f9fafb] dark:bg-black"
      contentContainerStyle={{
        padding: 20,
        paddingBottom: 150,
        paddingTop: Platform.OS === "ios" ? 130 : 110,
      }}
    >
      {/* Profile Section */}
      <View className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 p-6 rounded-3xl mb-6 shadow-sm shadow-blue-900/5 items-center">
        <View className="p-1.5 rounded-full bg-blue-50 dark:bg-blue-900/20 mb-4">
          <Image
            source={
              userPhoto
                ? { uri: userPhoto }
                : require("../../../assets/images/default-avatar.png")
            }
            className="w-24 h-24 rounded-full"
          />
        </View>
        <Text className="font-bold text-2xl dark:text-white text-gray-900 mb-1 text-center">
          {userName?.slice(0, 25) || "User"}
        </Text>
        <Text className="text-gray-500 dark:text-gray-400 font-medium text-base text-center">
          {userEmail?.slice(0, 35)}
        </Text>
      </View>

      {/* Background Sync Section — Android only */}
      {Platform.OS === "android" && <SyncStatusCard />}

      {/* Logout Button */}
      <TouchableOpacity
        onPress={() => {
          logoutUser();
          router.replace("/login");
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
  );
}
