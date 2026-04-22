import Ionicons from "@expo/vector-icons/Ionicons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { Tabs } from "expo-router";
import type React from "react";
import { Platform, Text, useColorScheme, View } from "react-native";

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
  return (
    <View className="items-center justify-center w-20">
      <View
        className={`w-16 h-8 items-center justify-center rounded-2xl transition-all duration-300 ${
          focused
            ? "bg-blue-600/15 dark:bg-blue-500/20 scale-110"
            : "bg-transparent scale-100"
        }`}
      >
        <Ionicons
          name={focused ? icon : (`${icon}-outline` as IconName)}
          size={focused ? 24 : 22}
          color={focused ? "#2563eb" : "#9ca3af"}
          style={
            focused
              ? { textShadowColor: "#2563eb40", textShadowRadius: 8 }
              : undefined
          }
        />
      </View>
      <Text
        className={`text-[11px] mt-1.5 font-semibold tracking-wide transition-all duration-300 ${
          focused
            ? "text-blue-600 dark:text-blue-400 opacity-100"
            : "text-gray-500 dark:text-gray-400 opacity-70"
        }`}
      >
        {label}
      </Text>
    </View>
  );
};

const HeaderTitle = ({ icon, title }: { icon: IconName; title: string }) => {
  return (
    <View className="flex-row items-center gap-2">
      <View className="bg-blue-600 p-1.5 rounded-xl">
        <Ionicons name={icon} size={20} color="white" />
      </View>
      <Text className="text-[28px] font-black tracking-tight text-gray-900 dark:text-white">
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
        animation: "shift",
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
          <View className="flex-1 overflow-hidden rounded-[36px]">
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
