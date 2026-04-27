import Ionicons from "@expo/vector-icons/Ionicons";
import type { ClipData } from "@viclip/types";
import { BlurView } from "expo-blur";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "expo-router";
import { useShareIntentContext } from "expo-share-intent";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  Platform,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  useColorScheme,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import Toast from "react-native-toast-message";
import { decryptClips, sendClip } from "@/services/clipboard";
import {
  addClip,
  enforceClipLimit,
  getClips,
  removeAllClips,
  removeClip,
  togglePinClip,
} from "@/services/firebase";
import { detectClipboardType, extractTextFromShare } from "@/utils/util";

export default function Index() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const [clipboardContent, setClipboardContent] = useState<ClipData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedClip, setSelectedClip] = useState<string>();
  const [lastClip, setLastClip] = useState<string | null>(null);

  const { hasShareIntent, shareIntent, resetShareIntent } =
    useShareIntentContext();

  const fetchClips = useCallback(async () => {
    try {
      const clips = await getClips();
      const decryptedClips = clips ? decryptClips(clips) : null;
      const sortedClips = decryptedClips
        ? Object.values(decryptedClips).sort((a, b) => {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            return (
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );
          })
        : [];
      setClipboardContent(sortedClips);
      setError(null);
    } catch (error) {
      console.error("Error fetching clips:", error);
      setError("Failed to load clips. Please try again.");
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (hasShareIntent && shareIntent) {
      let exitTimer: ReturnType<typeof setTimeout> | undefined;

      const handleShare = async () => {
        const originalContent = shareIntent?.text || "";
        const cleanContent = extractTextFromShare(originalContent);
        const contentToSave = cleanContent.trim() || originalContent.trim();

        if (contentToSave && contentToSave.length < 1000) {
          setRefreshing(true);
          await enforceClipLimit();
          await addClip(contentToSave, "text");
          await fetchClips();
          setRefreshing(false);
        }

        exitTimer = setTimeout(() => {
          BackHandler.exitApp();
        }, 1500);
      };

      handleShare();
      resetShareIntent();

      return () => {
        if (exitTimer !== undefined) {
          clearTimeout(exitTimer);
        }
      };
    }
  }, [hasShareIntent, shareIntent, fetchClips, resetShareIntent]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchClips();
  }, [fetchClips]);

  useFocusEffect(
    useCallback(() => {
      fetchClips();
      return () => {};
    }, [fetchClips]),
  );

  const handleSend = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const clipboard = await Clipboard.getStringAsync();
    if (clipboard && clipboard !== lastClip && clipboard.length < 1000) {
      setRefreshing(true);
      const contentType = await detectClipboardType(clipboard);
      if (
        contentType === "text" ||
        contentType === "url" ||
        contentType === "text-formatted" ||
        contentType === "email" ||
        contentType === "color"
      ) {
        if (clipboard.length > 10000) {
          console.warn("Content exceeds maximum size limit, skipping sync", {
            contentLength: clipboard.length,
            maxLength: 10000,
          });
          Toast.show({
            type: "warning",
            text1: "Clipboard Sync Warning",
            text2: "Clipboard content is too large to sync.",
          });
          setLastClip(clipboard);
          return;
        }
      }

      try {
        await sendClip(clipboard, contentType);
      } catch {
        return;
      }
      setLastClip(clipboard);
      await fetchClips();
      setRefreshing(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Toast.show({
        type: "success",
        text1: "Clip Sent",
        text2: "Available on all your devices.",
      });
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Toast.show({
        type: "info",
        text1: "Nothing New to Send",
        text2: "Your clipboard is unchanged or empty.",
      });
    }
  };

  const handleReceive = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    await fetchClips();
    setRefreshing(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Toast.show({
      type: "success",
      text1: "Synced Successfully",
      text2: "Your clips are up to date.",
    });
  };

  const handleTogglePin = useCallback(
    async (clipId: string, currentPinned: boolean) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // Optimistic UI update
      setClipboardContent((prev) => {
        const newClips = prev.map((c) =>
          c.id === clipId ? { ...c, pinned: !currentPinned } : c,
        );
        return newClips.sort((a, b) => {
          if (a.pinned && !b.pinned) return -1;
          if (!a.pinned && b.pinned) return 1;
          return (
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
        });
      });

      try {
        await togglePinClip(clipId, !currentPinned);
      } catch {
        // Revert on error
        await fetchClips();
        Toast.show({
          type: "error",
          text1: "Failed to pin clip",
          text2: "Please try again later.",
        });
      }
    },
    [fetchClips],
  );

  const handleDelete = useCallback(
    async (clipId: string) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

      // Optimistic UI update
      setClipboardContent((prev) => prev.filter((c) => c.id !== clipId));

      try {
        await removeClip(clipId);
        Toast.show({
          type: "success",
          text1: "Clip Deleted",
          text2: "The clip has been removed.",
        });
      } catch {
        // Revert on error
        await fetchClips();
        Toast.show({
          type: "error",
          text1: "Failed to delete clip",
          text2: "Please try again later.",
        });
      }
    },
    [fetchClips],
  );

  const handleClearHistory = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setRefreshing(true);

    // Optimistic UI update
    setClipboardContent((prev) => prev.filter((c) => c.pinned));

    try {
      await removeAllClips();
      Toast.show({
        type: "success",
        text1: "History Cleared",
        text2: "All unpinned clips have been removed.",
      });
    } catch {
      Toast.show({
        type: "error",
        text1: "Failed to clear history",
        text2: "Please try again later.",
      });
    } finally {
      await fetchClips();
      setRefreshing(false);
      setError(null);
      setSelectedClip(undefined);
    }
  };

  const renderItem = useCallback(
    ({ item, index }: { item: ClipData; index: number }) => (
      <Animated.View
        entering={FadeInDown.delay(index * 50).duration(400)}
        className={[
          "p-5 rounded-3xl mb-4 shadow-sm shadow-blue-900/5",
          item.pinned
            ? "bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-200 dark:border-amber-800/40 relative"
            : "bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800",
        ].join(" ")}
      >
        {item.pinned && (
          <View className="absolute -top-3 right-6 bg-amber-100 dark:bg-amber-900/60 px-3 py-1 rounded-full border border-amber-200 dark:border-amber-700/50">
            <Text className="text-amber-800 dark:text-amber-400 text-[10px] font-bold tracking-widest uppercase">
              Pinned
            </Text>
          </View>
        )}
        <View className="flex-row justify-between items-start mb-3 mt-1">
          <View className="flex-1 mr-4">
            <Text
              className="dark:text-white text-gray-900 font-medium text-lg leading-6"
              numberOfLines={4}
            >
              {item.content}
            </Text>
          </View>
          <TouchableWithoutFeedback
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSelectedClip(item.id);
              Clipboard.setStringAsync(item.content);
              setLastClip(item.content);
              Toast.show({
                type: "success",
                text1: "Copied to Clipboard!",
                text2: "Ready to paste anywhere.",
                visibilityTime: 1500,
              });
              setTimeout(() => {
                setSelectedClip(undefined);
              }, 2000);
            }}
          >
            <View className="bg-gray-50 dark:bg-zinc-800 p-2.5 rounded-full">
              {item.id === selectedClip ? (
                <Ionicons name="checkmark" size={20} color="#10b981" />
              ) : (
                <Ionicons name="copy-outline" size={20} color="#2563eb" />
              )}
            </View>
          </TouchableWithoutFeedback>
        </View>

        <View className="flex-row justify-between items-center mt-2 border-t border-gray-100 dark:border-zinc-800/50 pt-3">
          <View className="flex-row items-center justify-start gap-2">
            <View className="flex-row items-center gap-1.5 bg-gray-50 dark:bg-zinc-800 px-3 py-1.5 rounded-full">
              <Ionicons name="time-outline" size={14} color="#6b7280" />
              <Text className="dark:text-gray-400 text-gray-500 text-xs font-medium">
                {new Date(item.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </View>
            <View className="flex-row items-center gap-1.5 bg-gray-50 dark:bg-zinc-800 px-3 py-1.5 rounded-full">
              <Ionicons name="desktop-outline" size={14} color="#6b7280" />
              <Text
                className="dark:text-gray-400 text-gray-500 text-xs font-medium"
                numberOfLines={1}
                style={{ maxWidth: 100 }}
              >
                {item.sourceDevice}
              </Text>
            </View>
          </View>
          <View className="flex-row items-center gap-2">
            <TouchableOpacity
              onPress={() => handleTogglePin(item.id, !!item.pinned)}
              className="p-1.5 bg-gray-50 dark:bg-zinc-800 rounded-full"
            >
              <Ionicons
                name={item.pinned ? "pin" : "pin-outline"}
                size={16}
                color={item.pinned ? "#eab308" : "#6b7280"}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleDelete(item.id)}
              className="p-1.5 bg-gray-50 dark:bg-zinc-800 rounded-full"
            >
              <Ionicons name="trash-outline" size={16} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    ),
    [selectedClip, handleTogglePin, handleDelete],
  );

  if (isLoading && !refreshing) {
    return (
      <View className="flex-1 justify-center items-center dark:bg-black bg-[#f9fafb]">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View className="flex-1 dark:bg-black bg-[#f9fafb]">
      <FlatList
        className="flex-1 px-5"
        contentContainerStyle={{
          paddingBottom: 180,
          paddingTop: Platform.OS === "ios" ? 130 : 110,
        }}
        data={clipboardContent}
        renderItem={renderItem}
        refreshing={refreshing}
        onRefresh={onRefresh}
        keyExtractor={(item) => item.id}
        extraData={selectedClip}
        ListEmptyComponent={
          <View className="flex-1 justify-center items-center mt-20 px-8">
            <View className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-full mb-6">
              <Ionicons
                name={error ? "alert-circle-outline" : "clipboard-outline"}
                size={56}
                color={error ? "#ef4444" : "#2563eb"}
              />
            </View>
            <Text className="dark:text-white text-gray-900 text-xl font-bold mb-2 text-center">
              {error ? "Oops! Something went wrong" : "Your Clipboard is Empty"}
            </Text>
            <Text className="dark:text-gray-400 text-gray-500 text-center leading-relaxed">
              {error
                ? error
                : "Send text from any of your connected devices, and it will magically appear right here."}
            </Text>
          </View>
        }
        ListFooterComponent={
          clipboardContent.filter((c) => !c.pinned).length > 0 ? (
            <TouchableOpacity
              className="mt-6 mb-10 py-4 flex-row justify-center items-center opacity-80"
              activeOpacity={0.7}
              onPress={handleClearHistory}
            >
              <Text className="text-red-500 font-semibold tracking-wide">
                Clear Unpinned History
              </Text>
            </TouchableOpacity>
          ) : null
        }
      />

      {/* Floating Action Area */}
      <View className="absolute bottom-[110px] left-5 right-5 overflow-hidden rounded-[28px] border border-gray-200/50 dark:border-zinc-800/80 shadow-lg shadow-blue-900/10">
        <BlurView
          intensity={80}
          tint={isDark ? "dark" : "light"}
          className="flex-row justify-between items-center p-2.5"
        >
          <TouchableOpacity
            className="flex-1 bg-green-600 dark:bg-green-500 py-3.5 rounded-[22px] flex-row items-center justify-center gap-2 ml-1.5 shadow-md shadow-green-500/30"
            activeOpacity={0.8}
            onPress={handleReceive}
          >
            <Ionicons name="cloud-download" size={20} color="#ffffff" />
            <Text className="text-white font-bold text-[15px]">Receive</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-1 bg-blue-600 dark:bg-blue-500 py-3.5 rounded-[22px] flex-row items-center justify-center gap-2 ml-1.5 shadow-md shadow-blue-500/30"
            activeOpacity={0.8}
            onPress={handleSend}
          >
            <Ionicons name="paper-plane" size={20} color="#ffffff" />
            <Text className="text-white font-bold text-[15px]">Send</Text>
          </TouchableOpacity>
        </BlurView>
      </View>
    </View>
  );
}
