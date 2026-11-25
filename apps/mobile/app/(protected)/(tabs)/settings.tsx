import Ionicons from "@expo/vector-icons/Ionicons";
import { getAuth } from "@react-native-firebase/auth";
import { LINKS } from "@viclip/constants";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import Toast from "react-native-toast-message";
import { colors } from "@/constants/theme";
import { logoutUser } from "@/services/auth";
import { useBackgroundSync } from "@/services/backgroundSync";
import { useResponsiveLayout } from "@/utils/layout";
import { openExternalLink } from "@/utils/openExternalLink";
import { useSessionScope } from "@/utils/sessionScope";

// ─── Background Sync Status Card ──────────────────────────────────────────────

function SyncStatusCard() {
  const scope = useSessionScope();
  const toggling = useRef(false);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const { isCompact } = useResponsiveLayout();

  const {
    notificationsEnabled,
    syncEnabled,
    tokenRegistered,
    toggleSync,
    requestNotificationPermission,
  } = useBackgroundSync();

  const toggleValue = notificationsEnabled ? syncEnabled : false;

  // Status badge
  const statusColor = !notificationsEnabled
    ? colors.warning // amber – permission needed
    : syncEnabled && tokenRegistered
      ? colors.success // green – active
      : syncEnabled
        ? colors.primary // blue – connecting
        : "#6b7280"; // grey – paused

  const statusLabel = !notificationsEnabled
    ? "Permission Needed"
    : syncEnabled && tokenRegistered
      ? "Active"
      : syncEnabled
        ? "Connecting…"
        : "Paused";

  const handleToggle = async (value: boolean) => {
    const session = scope.capture();
    if (!session || toggling.current) return;
    toggling.current = true;
    try {
      if (!notificationsEnabled) {
        const permitted = await requestNotificationPermission();
        if (!scope.isCurrent(session) || !permitted) return;
      }
      await toggleSync(value);
    } catch {
      if (scope.isCurrent(session)) {
        Toast.show({
          type: "error",
          text1: "Could Not Save Preference",
          text2: "Try again.",
        });
      }
    } finally {
      toggling.current = false;
    }
  };

  return (
    <View style={[styles.card, isDark ? styles.cardDark : styles.cardLight]}>
      {/* ── Main toggle row ── */}
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => handleToggle(!toggleValue)}
        style={[styles.toggleRow, isCompact && styles.toggleRowCompact]}
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
              name={toggleValue ? "notifications" : "notifications-outline"}
              size={20}
              color={toggleValue ? colors.primary : "#6b7280"}
            />
          </View>
          <View style={styles.rowText}>
            <Text
              style={[
                styles.toggleTitle,
                { color: isDark ? colors.text.dark : colors.text.light },
              ]}
            >
              Clip Notifications
            </Text>
            <Text
              style={[
                styles.toggleSubtitle,
                {
                  color: isDark ? colors.text.mutedDark : "#9ca3af",
                },
              ]}
            >
              {!notificationsEnabled
                ? "Tap to enable push notifications"
                : toggleValue
                  ? "Receiving alerts for clips from your devices"
                  : "Sync notifications are paused"}
            </Text>
          </View>
        </View>

        {/* Switch */}
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
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusBadgeText, { color: statusColor }]}>
            {statusLabel}
          </Text>
        </View>
      </View>

      {/* ── Active info row ── */}
      {notificationsEnabled && syncEnabled && (
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
              You'll be alerted whenever another device adds a new clip
            </Text>
          </View>
        </>
      )}

      {/* ── Permission Request CTA ── */}
      {!notificationsEnabled && (
        <>
          <View
            style={[
              styles.divider,
              isDark ? styles.dividerDark : styles.dividerLight,
            ]}
          />
          <TouchableOpacity
            onPress={() => {
              void handleToggle(true);
            }}
            activeOpacity={0.75}
            style={styles.ctaButton}
          >
            <Ionicons name="notifications" size={18} color="white" />
            <Text style={styles.ctaButtonText}>Enable Push Notifications</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

// ─── Main Settings Screen ──────────────────────────────────────────────────────

export default function Settings() {
  const scope = useSessionScope();
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const { isCompact, contentContainerStyle } = useResponsiveLayout();

  const auth = getAuth();
  const user = auth.currentUser;
  const userEmail = user?.email;
  const userPhoto = user?.photoURL;
  const userName = user?.displayName;

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const logoutInProgress = useRef(false);

  const handleLogout = () => {
    const session = scope.capture();
    if (!session || logoutInProgress.current) return;
    Alert.alert(
      "Log Out",
      "Are you sure you want to log out of ViClip on this device?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log Out",
          style: "destructive",
          onPress: async () => {
            if (!scope.isCurrent(session) || logoutInProgress.current) return;
            logoutInProgress.current = true;
            setIsLoggingOut(true);
            try {
              await logoutUser();
              if (mounted.current && !getAuth().currentUser)
                router.replace("/login");
            } catch {
              if (!mounted.current) return;
              Alert.alert(
                "Could Not Log Out",
                "Your session could not be closed. Please try again.",
              );
            } finally {
              logoutInProgress.current = false;
              if (mounted.current) setIsLoggingOut(false);
            }
          },
        },
      ],
    );
  };

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
      contentContainerStyle={contentContainerStyle}
    >
      {/* Profile Section */}
      <View
        style={[
          styles.profileCard,
          isCompact && styles.profileCardCompact,
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
              userPhoto && userPhoto.trim().length > 0
                ? { uri: userPhoto.trim() }
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

      {/* Background Sync Section */}
      <SyncStatusCard />

      <View style={[styles.card, isDark ? styles.cardDark : styles.cardLight]}>
        {(
          [
            {
              label: "Delete account",
              subtitle: "Request account and data deletion by email",
              icon: "trash-outline",
              url: LINKS.deleteAccount,
            },
            {
              label: "Privacy Policy",
              subtitle: "How ViClip handles your data",
              icon: "shield-checkmark-outline",
              url: LINKS.privacy,
            },
            {
              label: "Terms of Service",
              subtitle: "Terms for using ViClip",
              icon: "document-text-outline",
              url: LINKS.terms,
            },
          ] as const
        ).map((link) => (
          <TouchableOpacity
            key={link.url}
            accessibilityRole="link"
            accessibilityLabel={link.label}
            accessibilityHint="Opens the ViClip website in your browser"
            onPress={() => void openExternalLink(link.url)}
            activeOpacity={0.7}
            style={[styles.toggleRow, isCompact && styles.toggleRowCompact]}
          >
            <View style={styles.toggleLeft}>
              <Ionicons
                name={link.icon}
                size={22}
                color={isDark ? colors.text.mutedDark : colors.text.mutedLight}
              />
              <View style={styles.rowText}>
                <Text
                  style={[
                    styles.toggleTitle,
                    { color: isDark ? colors.text.dark : colors.text.light },
                  ]}
                >
                  {link.label}
                </Text>
                <Text
                  style={[
                    styles.toggleSubtitle,
                    {
                      color: isDark
                        ? colors.text.mutedDark
                        : colors.text.mutedLight,
                    },
                  ]}
                >
                  {link.subtitle}
                </Text>
              </View>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={isDark ? colors.text.mutedDark : colors.text.mutedLight}
            />
          </TouchableOpacity>
        ))}
      </View>

      {/* Logout Button */}
      <TouchableOpacity
        onPress={handleLogout}
        disabled={isLoggingOut}
        style={[
          styles.logoutBtn,
          isDark ? styles.logoutBtnDark : styles.logoutBtnLight,
          isLoggingOut && { opacity: 0.6 },
        ]}
        activeOpacity={0.7}
      >
        <Ionicons name="log-out-outline" size={24} color={colors.danger} />
        <Text style={styles.logoutBtnText}>
          {isLoggingOut ? "Logging Out..." : "Log Out"}
        </Text>
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
  toggleRowCompact: {
    paddingHorizontal: 16,
  },
  toggleLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
    minWidth: 0,
    marginRight: 12,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
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
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  statusLabelText: {
    fontSize: 14,
    fontWeight: "500",
  },
  statusBadge: {
    maxWidth: "100%",
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
    flexShrink: 1,
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
    paddingHorizontal: 12,
  },
  ctaButtonText: {
    flexShrink: 1,
    textAlign: "center",
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
  profileCardCompact: {
    padding: 16,
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
    alignSelf: "stretch",
    fontWeight: "700",
    fontSize: 24,
    marginBottom: 4,
    textAlign: "center",
  },
  userEmail: {
    alignSelf: "stretch",
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
    flexShrink: 1,
    textAlign: "center",
    color: colors.danger,
    fontWeight: "700",
    fontSize: 18,
  },
});
