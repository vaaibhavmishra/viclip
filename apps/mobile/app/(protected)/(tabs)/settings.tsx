import Ionicons from "@expo/vector-icons/Ionicons";
import { getAuth } from "@react-native-firebase/auth";
import { router } from "expo-router";
import {
  ActivityIndicator,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { colors } from "@/constants/theme";
import { logoutUser } from "@/services/auth";
import { useBackgroundSync } from "@/services/backgroundSync";

// ─── Background Sync Status Card ──────────────────────────────────────────────

function SyncStatusCard() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

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
    ? colors.danger // red  – not set up
    : syncEnabled && serviceRunning
      ? isSyncing
        ? colors.primaryLight
        : colors.success // blue while syncing, green active
      : syncEnabled
        ? colors.warning // amber – enabled but not yet live
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
    <View style={[styles.card, isDark ? styles.cardDark : styles.cardLight]}>
      {/* ── Main toggle row ── */}
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => handleToggle(!toggleValue)}
        style={styles.toggleRow}
      >
        <View style={styles.toggleLeft}>
          <View
            style={[
              styles.toggleIconBox,
              {
                backgroundColor: toggleValue
                  ? "rgba(37, 99, 235, 0.1)"
                  : "rgba(107, 114, 128, 0.1)",
              },
            ]}
          >
            <Ionicons
              name={toggleValue ? "sync" : "sync-outline"}
              size={20}
              color={toggleValue ? colors.primary : "#6b7280"}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={[
                styles.toggleTitle,
                { color: isDark ? colors.text.dark : colors.text.light },
              ]}
            >
              Clipboard Sync
            </Text>
            <Text
              style={[
                styles.toggleSubtitle,
                {
                  color: isDark ? colors.text.mutedDark : "#9ca3af",
                },
              ]}
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
          trackColor={{ false: "#e4e4e7", true: colors.primary }}
          ios_backgroundColor="#e4e4e7"
        />
      </TouchableOpacity>

      {/* ── Divider ── */}
      <View
        style={[
          styles.divider,
          isDark ? styles.dividerDark : styles.dividerLight,
        ]}
      />

      {/* ── Status row ── */}
      <View style={styles.statusRow}>
        <Text
          style={[
            styles.statusLabelText,
            {
              color: isDark ? colors.text.mutedDark : colors.text.mutedLight,
            },
          ]}
        >
          Status
        </Text>
        <View
          style={[styles.statusBadge, { backgroundColor: `${statusColor}18` }]}
        >
          {isSyncing && syncEnabled ? (
            <ActivityIndicator size={10} color={statusColor} />
          ) : (
            <View
              style={[styles.statusDot, { backgroundColor: statusColor }]}
            />
          )}
          <Text style={[styles.statusBadgeText, { color: statusColor }]}>
            {statusLabel}
          </Text>
        </View>
      </View>

      {/* ── Info rows depending on state ── */}

      {/* Active + syncing */}
      {serviceGranted && syncEnabled && serviceRunning && (
        <>
          <View
            style={[
              styles.divider,
              isDark ? styles.dividerDark : styles.dividerLight,
            ]}
          />
          <View style={styles.infoRow}>
            <Ionicons
              name="checkmark-circle"
              size={16}
              color={colors.success}
            />
            <Text
              style={[
                styles.infoText,
                {
                  color: isDark
                    ? colors.text.mutedDark
                    : colors.text.mutedLight,
                },
              ]}
            >
              Your text is being synced to all connected devices
            </Text>
          </View>
        </>
      )}

      {/* Paused */}
      {serviceGranted && !syncEnabled && (
        <>
          <View
            style={[
              styles.divider,
              isDark ? styles.dividerDark : styles.dividerLight,
            ]}
          />
          <View style={styles.infoRow}>
            <Ionicons name="pause-circle-outline" size={16} color="#6b7280" />
            <Text
              style={[
                styles.infoText,
                {
                  color: isDark
                    ? colors.text.mutedDark
                    : colors.text.mutedLight,
                },
              ]}
            >
              Sync is paused — flip the toggle above to resume
            </Text>
          </View>
        </>
      )}

      {/* Not set up — first-time CTA */}
      {!serviceGranted && (
        <>
          <View
            style={[
              styles.divider,
              isDark ? styles.dividerDark : styles.dividerLight,
            ]}
          />
          <TouchableOpacity
            onPress={openAccessibilitySettings}
            activeOpacity={0.75}
            style={styles.ctaButton}
          >
            <Ionicons name="accessibility" size={18} color="white" />
            <Text style={styles.ctaButtonText}>
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
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const auth = getAuth();
  const user = auth.currentUser;
  const userEmail = user?.email;
  const userPhoto = user?.photoURL;
  const userName = user?.displayName;

  return (
    <ScrollView
      style={[
        styles.scrollView,
        {
          backgroundColor: isDark
            ? colors.background.dark
            : colors.background.light,
        },
      ]}
      contentContainerStyle={{
        padding: 20,
        paddingBottom: 150,
        paddingTop: Platform.OS === "ios" ? 130 : 110,
      }}
    >
      {/* Profile Section */}
      <View
        style={[
          styles.profileCard,
          isDark ? styles.cardDark : styles.cardLight,
        ]}
      >
        <View
          style={[
            styles.avatarWrapper,
            isDark ? styles.avatarWrapperDark : styles.avatarWrapperLight,
          ]}
        >
          <Image
            source={
              userPhoto
                ? { uri: userPhoto }
                : require("../../../assets/images/default-avatar.png")
            }
            style={styles.avatarImage}
          />
        </View>
        <Text
          style={[
            styles.userName,
            { color: isDark ? colors.text.dark : colors.text.light },
          ]}
        >
          {userName?.slice(0, 25) || "User"}
        </Text>
        <Text
          style={[
            styles.userEmail,
            {
              color: isDark ? colors.text.mutedDark : colors.text.mutedLight,
            },
          ]}
        >
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
        style={[
          styles.logoutBtn,
          isDark ? styles.logoutBtnDark : styles.logoutBtnLight,
        ]}
        activeOpacity={0.7}
      >
        <Ionicons name="log-out-outline" size={24} color={colors.danger} />
        <Text style={styles.logoutBtnText}>Log Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: 24,
    overflow: "hidden",
    shadowColor: "#1e3a8a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  cardLight: {
    backgroundColor: colors.card.light,
    borderColor: colors.border.light,
  },
  cardDark: {
    backgroundColor: colors.card.dark,
    borderColor: colors.border.dark,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  toggleLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
    marginRight: 12,
  },
  toggleIconBox: {
    padding: 10,
    borderRadius: 12,
  },
  toggleTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  toggleSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginHorizontal: 20,
  },
  dividerLight: {
    backgroundColor: colors.border.light,
  },
  dividerDark: {
    backgroundColor: "rgba(39, 39, 42, 0.5)",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  statusLabelText: {
    fontSize: 14,
    fontWeight: "500",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  infoText: {
    fontSize: 14,
    flex: 1,
  },
  ctaButton: {
    marginHorizontal: 20,
    marginVertical: 16,
    backgroundColor: colors.primary,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
  },
  ctaButtonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 14,
  },
  profileCard: {
    borderWidth: 1,
    padding: 24,
    borderRadius: 24,
    marginBottom: 24,
    alignItems: "center",
    shadowColor: "#1e3a8a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  avatarWrapper: {
    padding: 6,
    borderRadius: 999,
    marginBottom: 16,
  },
  avatarWrapperLight: {
    backgroundColor: colors.primaryTint,
  },
  avatarWrapperDark: {
    backgroundColor: colors.primaryTintDark,
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  userName: {
    fontWeight: "700",
    fontSize: 24,
    marginBottom: 4,
    textAlign: "center",
  },
  userEmail: {
    fontWeight: "500",
    fontSize: 16,
    textAlign: "center",
  },
  logoutBtn: {
    borderWidth: 1,
    padding: 16,
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 16,
  },
  logoutBtnLight: {
    backgroundColor: colors.dangerTint,
    borderColor: colors.dangerBorder,
  },
  logoutBtnDark: {
    backgroundColor: colors.dangerTintDark,
    borderColor: colors.dangerBorderDark,
  },
  logoutBtnText: {
    textAlign: "center",
    color: colors.danger,
    fontWeight: "700",
    fontSize: 18,
  },
});
