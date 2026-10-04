import Ionicons from "@expo/vector-icons/Ionicons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { Tabs } from "expo-router";
import type React from "react";
import { Platform, StyleSheet, Text, useColorScheme, View } from "react-native";
import { colors } from "@/constants/theme";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

const TabIcon = ({
  focused,
  icon,
  label,
}: {
  focused: boolean;
  icon: IconName;
  label: string;
}) => {
  const isDark = useColorScheme() === "dark";

  return (
    <View style={styles.tabIconContainer}>
      <View
        style={[
          styles.tabIconPill,
          focused &&
            (isDark
              ? styles.tabIconPillFocusedDark
              : styles.tabIconPillFocusedLight),
        ]}
      >
        <Ionicons
          name={focused ? icon : (`${icon}-outline` as IconName)}
          size={focused ? 24 : 22}
          color={focused ? colors.primary : "#9ca3af"}
          style={
            focused
              ? { textShadowColor: "#2563eb40", textShadowRadius: 8 }
              : undefined
          }
        />
      </View>
      <Text
        style={[
          styles.tabLabel,
          {
            color: focused
              ? isDark
                ? colors.primaryLight
                : colors.primary
              : isDark
                ? colors.text.mutedDark
                : colors.text.mutedLight,
            opacity: focused ? 1 : 0.7,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
};

const HeaderTitle = ({ icon, title }: { icon: IconName; title: string }) => {
  const isDark = useColorScheme() === "dark";

  return (
    <View style={styles.headerTitleRow}>
      <View style={styles.headerIconBox}>
        <Ionicons name={icon} size={20} color="white" />
      </View>
      <Text
        style={[
          styles.headerText,
          { color: isDark ? colors.text.dark : colors.text.light },
        ]}
      >
        {title}
      </Text>
    </View>
  );
};

export default function TabsLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  return (
    <Tabs
      screenOptions={{
        headerTitleAlign: "left",
        headerTransparent: true,
        headerBackground: () => (
          <BlurView
            tint={isDark ? "dark" : "light"}
            intensity={80}
            style={{
              flex: 1,
              borderBottomWidth: 1,
              borderBottomColor: isDark
                ? "rgba(255,255,255,0.05)"
                : "rgba(0,0,0,0.05)",
            }}
          />
        ),
        headerStyle: {
          height: Platform.OS === "ios" ? 120 : 100,
        },
        headerTitleContainerStyle: {
          paddingHorizontal: 16,
          paddingBottom: 8,
        },
        sceneStyle: {
          backgroundColor: isDark ? "#000000" : "#f9fafb",
        },
        animation: "none",
        tabBarShowLabel: false,
        tabBarStyle: {
          position: "absolute",
          bottom: Platform.OS === "ios" ? 30 : 20,
          left: 20,
          right: 20,
          elevation: 20,
          height: 60,
          borderRadius: 36,
          backgroundColor: isDark ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.8)",
          borderWidth: 1,
          borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.15,
          shadowRadius: 20,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          paddingBottom: 20,
        },
        tabBarBackground: () => (
          <View style={styles.tabBarBgWrapper}>
            <BlurView
              tint={isDark ? "dark" : "light"}
              intensity={80}
              style={{ flex: 1 }}
            />
          </View>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          headerTitle: () => <HeaderTitle icon="clipboard" title="My Clips" />,
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon="clipboard" label="Clips" />
          ),
        }}
        listeners={{
          tabPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          },
        }}
      />
      <Tabs.Screen
        name="devices"
        options={{
          headerTitle: () => <HeaderTitle icon="desktop" title="Devices" />,
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon="desktop" label="Devices" />
          ),
        }}
        listeners={{
          tabPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          },
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          headerTitle: () => <HeaderTitle icon="settings" title="Settings" />,
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon="settings" label="Settings" />
          ),
        }}
        listeners={{
          tabPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          },
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabIconContainer: {
    alignItems: "center",
    justifyContent: "center",
    width: 80,
  },
  tabIconPill: {
    width: 64,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: "transparent",
  },
  tabIconPillFocusedLight: {
    backgroundColor: "rgba(37, 99, 235, 0.15)",
  },
  tabIconPillFocusedDark: {
    backgroundColor: "rgba(59, 130, 246, 0.20)",
  },
  tabLabel: {
    fontSize: 11,
    marginTop: 6,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerIconBox: {
    backgroundColor: colors.primary,
    padding: 6,
    borderRadius: 12,
  },
  headerText: {
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  tabBarBgWrapper: {
    flex: 1,
    overflow: "hidden",
    borderRadius: 36,
  },
});
