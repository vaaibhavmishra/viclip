import Ionicons from "@expo/vector-icons/Ionicons";
import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import { type ComponentProps, useState } from "react";
import { StyleSheet, Text, useColorScheme, View } from "react-native";
import { colors } from "@/constants/theme";
import { useResponsiveLayout } from "@/utils/layout";

type IconName = ComponentProps<typeof Ionicons>["name"];

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
        numberOfLines={1}
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

const HeaderTitle = ({
  icon,
  title,
  onHeightChange,
}: {
  icon: IconName;
  title: string;
  onHeightChange: (height: number) => void;
}) => {
  const isDark = useColorScheme() === "dark";
  const { isCompact } = useResponsiveLayout();

  return (
    <View
      style={styles.headerTitleRow}
      onLayout={(event) => onHeightChange(event.nativeEvent.layout.height)}
    >
      <View style={styles.headerIconBox}>
        <Ionicons name={icon} size={20} color="white" />
      </View>
      <Text
        style={[
          styles.headerText,
          isCompact && { fontSize: 24 },
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
  const layout = useResponsiveLayout();
  const [titleHeights, setTitleHeights] = useState<Record<string, number>>({});
  const updateTitleHeight = (name: string, height: number) => {
    setTitleHeights((previous) =>
      previous[name] === height ? previous : { ...previous, [name]: height },
    );
  };
  const headerHeight = (name: string) =>
    layout.modalInsets.top +
    Math.max(
      64,
      Math.ceil((layout.isCompact ? 24 : 28) * layout.fontScale * 1.4 + 16),
      (titleHeights[name] ?? 0) + 16,
    );

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerTitleAlign: "left",
        headerTransparent: false,
        headerStyle: { height: headerHeight(route.name) },
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
        headerTitleContainerStyle: {
          paddingRight: 12,
        },
        sceneStyle: {
          backgroundColor: isDark ? "#000000" : "#f9fafb",
        },
        animation: "none",
        tabBarShowLabel: false,
        tabBarLabelPosition: "below-icon",
        tabBarHideOnKeyboard: true,
        tabBarItemStyle: { paddingVertical: 8 },
        tabBarIconStyle: { width: "100%", height: "100%", margin: 0 },
        tabBarStyle: {
          position: "absolute",
          ...layout.tabBarStyle,
          elevation: 20,
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
          paddingBottom: 0,
          paddingTop: 0,
          paddingHorizontal: 0,
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
      })}
    >
      <Tabs.Screen
        name="index"
        options={{
          headerTitle: () => (
            <HeaderTitle
              icon="clipboard"
              title="My Clips"
              onHeightChange={(height) => updateTitleHeight("index", height)}
            />
          ),
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon="clipboard" label="Clips" />
          ),
        }}
      />
      <Tabs.Screen
        name="devices"
        options={{
          headerTitle: () => (
            <HeaderTitle
              icon="desktop"
              title="Devices"
              onHeightChange={(height) => updateTitleHeight("devices", height)}
            />
          ),
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon="desktop" label="Devices" />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          headerTitle: () => (
            <HeaderTitle
              icon="settings"
              title="Settings"
              onHeightChange={(height) => updateTitleHeight("settings", height)}
            />
          ),
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon="settings" label="Settings" />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabIconContainer: {
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    minWidth: 0,
  },
  tabIconPill: {
    width: 64,
    maxWidth: "100%",
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: "transparent",
    marginBottom: 2,
  },
  tabIconPillFocusedLight: {
    backgroundColor: "rgba(37, 99, 235, 0.15)",
  },
  tabIconPillFocusedDark: {
    backgroundColor: "rgba(59, 130, 246, 0.20)",
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.3,
    lineHeight: 14,
    maxWidth: "100%",
    textAlign: "center",
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 1,
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
    flexShrink: 1,
  },
  tabBarBgWrapper: {
    flex: 1,
    overflow: "hidden",
    borderRadius: 36,
  },
});
