import Ionicons from "@expo/vector-icons/Ionicons";
import { CLIPBOARD_CONFIG } from "@viclip/constants";
import type { ClipData } from "@viclip/types";
import { BlurView } from "expo-blur";
import * as Clipboard from "expo-clipboard";
import { useFocusEffect } from "expo-router";
import { useShareIntentContext } from "expo-share-intent";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  useColorScheme,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import Toast from "react-native-toast-message";
import { colors } from "@/constants/theme";
import {
  decryptClips,
  editClip,
  sendClip,
  writeClipToClipboard,
} from "@/services/clipboard";
import {
  getClips,
  listenClips,
  removeAllClips,
  removeClip,
  togglePinClip,
} from "@/services/firebase";
import { useSessionScope } from "@/utils/sessionScope";
import {
  detectClipboardType,
  formatClipTime,
  formatDeviceName,
  getDeviceIcon,
  getSharedText,
} from "@/utils/util";

export default function Index() {
  const scope = useSessionScope();
  const { height: screenHeight } = useWindowDimensions();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const [clipboardContent, setClipboardContent] = useState<ClipData[]>([]);
  const clipboardContentRef = useRef(clipboardContent);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedClip, setSelectedClip] = useState<string>();
  const busy = useRef(false);
  const saving = useRef(false);
  const mutationIds = useRef(new Set<string>());
  const requestVersion = useRef(0);
  const consumedShare = useRef<unknown>(null);

  // Edit modal state
  const [editingClip, setEditingClip] = useState<ClipData | null>(null);
  const [editContent, setEditContent] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const editInputRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  const { hasShareIntent, shareIntent, resetShareIntent } =
    useShareIntentContext();

  useEffect(() => {
    clipboardContentRef.current = clipboardContent;
  }, [clipboardContent]);

  const fetchClips = useCallback(async () => {
    const session = scope.capture();
    if (!session) return;
    const version = ++requestVersion.current;
    try {
      const clips = await getClips(session);
      if (!scope.isCurrent(session) || version !== requestVersion.current)
        return;
      const decryptedClips = clips ? decryptClips(clips) : null;
      const sortedClips = decryptedClips
        ? Object.values(decryptedClips).sort((a, b) => {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            const timeA = new Date(a.timestamp).getTime() || 0;
            const timeB = new Date(b.timestamp).getTime() || 0;
            return timeB - timeA;
          })
        : [];
      setClipboardContent(sortedClips);
      setError(null);
    } catch (error) {
      if (!scope.isCurrent(session) || version !== requestVersion.current)
        return;
      console.error("Error fetching clips:", error);
      setError("Failed to load clips. Please try again.");
    } finally {
      if (scope.isCurrent(session) && version === requestVersion.current) {
        setIsLoading(false);
        setRefreshing(false);
      }
    }
  }, [scope]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchClips();
  }, [fetchClips]);

  // Real-time live listener for clips
  useEffect(() => {
    const session = scope.capture();
    if (!session) return;
    const unsubscribe = listenClips(
      (clips) => {
        if (!scope.isCurrent(session)) return;
        requestVersion.current += 1;
        if (clips) {
          const decryptedClips = decryptClips(clips);
          const sortedClips = Object.values(decryptedClips).sort((a, b) => {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            const timeA = new Date(a.timestamp).getTime() || 0;
            const timeB = new Date(b.timestamp).getTime() || 0;
            return timeB - timeA;
          });
          setClipboardContent(sortedClips);
        } else {
          setClipboardContent([]);
        }
        setIsLoading(false);
        setRefreshing(false);
        setError(null);
      },
      (err) => {
        if (!scope.isCurrent(session)) return;
        requestVersion.current += 1;
        console.error("Clips listener failed:", err);
        setIsLoading(false);
        setRefreshing(false);
        setError("Failed to sync clips. Please check your network connection.");
      },
    );

    return () => unsubscribe();
  }, [scope]);

  useEffect(() => {
    if (
      hasShareIntent &&
      shareIntent &&
      consumedShare.current !== shareIntent
    ) {
      const session = scope.capture();
      if (!session) return;
      consumedShare.current = shareIntent;
      resetShareIntent();
      const handleShare = async () => {
        let contentToSave: string;
        try {
          contentToSave = getSharedText(shareIntent);
        } catch (err) {
          Toast.show({
            type: "error",
            text1: "Cannot Share This Content",
            text2:
              err instanceof Error ? err.message : "Share text or a web link.",
          });
          return;
        }

        if (contentToSave) {
          if (contentToSave.length > CLIPBOARD_CONFIG.maxContentLength) {
            Toast.show({
              type: "error",
              text1: "Content Too Large",
              text2: `Shared content exceeds ${CLIPBOARD_CONFIG.maxContentLength.toLocaleString()} characters limit.`,
            });
          } else {
            setRefreshing(true);
            try {
              const contentType = await detectClipboardType(contentToSave);
              if (!scope.isCurrent(session)) return;
              await sendClip(
                contentToSave,
                contentType,
                clipboardContentRef.current,
                session,
              );
              if (!scope.isCurrent(session)) return;
              await fetchClips();
              if (!scope.isCurrent(session)) return;
              Toast.show({
                type: "success",
                text1: "Clip Shared",
                text2: "Saved to your ViClip history.",
              });
            } catch (err) {
              if (!scope.isCurrent(session)) return;
              const msg =
                err instanceof Error ? err.message : "Failed to share clip";
              Toast.show({
                type: "error",
                text1: "Failed to Share Clip",
                text2: msg,
              });
            } finally {
              if (scope.isCurrent(session)) setRefreshing(false);
            }
          }
        }
      };

      void handleShare();
    }
  }, [hasShareIntent, shareIntent, resetShareIntent, fetchClips, scope]);

  useFocusEffect(
    useCallback(() => {
      fetchClips();
    }, [fetchClips]),
  );

  const handleSend = async () => {
    const session = scope.capture();
    if (!session || busy.current || AppState.currentState !== "active") return;
    busy.current = true;
    setRefreshing(true);
    try {
      const clipboard = await Clipboard.getStringAsync();
      if (!scope.isCurrent(session)) return;
      if (!clipboard) {
        Toast.show({
          type: "info",
          text1: "Clipboard is Empty",
          text2: "Copy some text first to send.",
        });
        return;
      }
      if (clipboard.length > CLIPBOARD_CONFIG.maxContentLength) {
        Toast.show({
          type: "error",
          text1: "Clipboard Sync Warning",
          text2: "Clipboard content is too large to sync.",
        });
        return;
      }
      const contentType = await detectClipboardType(clipboard);
      if (!scope.isCurrent(session)) return;
      await sendClip(
        clipboard,
        contentType,
        clipboardContentRef.current,
        session,
      );
      if (!scope.isCurrent(session)) return;
      await fetchClips();
      if (!scope.isCurrent(session)) return;
      Toast.show({
        type: "success",
        text1: "Clip Sent",
        text2: "Available on all your devices.",
      });
    } catch {
      if (!scope.isCurrent(session)) return;
      Toast.show({
        type: "error",
        text1: "Failed to Send Clip",
        text2:
          "Check clipboard permissions and your connection, then try again.",
      });
    } finally {
      busy.current = false;
      if (scope.isCurrent(session)) setRefreshing(false);
    }
  };

  const handleReceive = async () => {
    const session = scope.capture();
    if (!session || busy.current) return;
    busy.current = true;
    const version = ++requestVersion.current;
    setRefreshing(true);
    try {
      const clips = await getClips(session);
      if (!scope.isCurrent(session) || version !== requestVersion.current)
        return;
      const decryptedClips = clips ? decryptClips(clips) : null;
      const sortedClips = decryptedClips
        ? Object.values(decryptedClips).sort((a, b) => {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            const timeA = new Date(a.timestamp).getTime() || 0;
            const timeB = new Date(b.timestamp).getTime() || 0;
            return timeB - timeA;
          })
        : [];
      setClipboardContent(sortedClips);
      setError(null);

      if (sortedClips.length > 0) {
        // Pick the chronologically latest clip regardless of pinned sorting
        const latest = [...sortedClips].sort(
          (a, b) =>
            (new Date(b.timestamp).getTime() || 0) -
            (new Date(a.timestamp).getTime() || 0),
        )[0];
        if (!latest.decryptionFailed) {
          if (!scope.isCurrent(session) || AppState.currentState !== "active")
            return;
          await writeClipToClipboard(latest.content, session, () =>
            scope.isCurrent(session),
          );
          if (!scope.isCurrent(session)) return;
          Toast.show({
            type: "success",
            text1: "Copied to Clipboard!",
            text2: `Latest clip from ${formatDeviceName(latest.sourceDevice)} is ready to paste.`,
          });
        } else {
          Toast.show({
            type: "warning",
            text1: "Synced, But Could Not Decrypt",
            text2: "Latest clip could not be decrypted with your current key.",
          });
        }
      } else {
        Toast.show({
          type: "info",
          text1: "No Clips Found",
          text2: "Your clipboard history is currently empty.",
        });
      }
    } catch (err) {
      if (!scope.isCurrent(session)) return;
      console.error("Error receiving clips:", err);
      Toast.show({
        type: "error",
        text1: "Failed to Sync",
        text2: "Please try again later.",
      });
    } finally {
      busy.current = false;
      if (scope.isCurrent(session)) setRefreshing(false);
    }
  };

  const handleTogglePin = useCallback(
    async (clipId: string, currentPinned: boolean) => {
      const session = scope.capture();
      if (!session || mutationIds.current.has(clipId)) return;
      mutationIds.current.add(clipId);
      // Optimistic UI update
      setClipboardContent((prev) => {
        const newClips = prev.map((c) =>
          c.id === clipId ? { ...c, pinned: !currentPinned } : c,
        );
        return newClips.sort((a, b) => {
          if (a.pinned && !b.pinned) return -1;
          if (!a.pinned && b.pinned) return 1;
          const timeA = new Date(a.timestamp).getTime() || 0;
          const timeB = new Date(b.timestamp).getTime() || 0;
          return timeB - timeA;
        });
      });

      try {
        await togglePinClip(clipId, !currentPinned, session);
      } catch {
        if (!scope.isCurrent(session)) return;
        // Revert on error
        await fetchClips();
        if (!scope.isCurrent(session)) return;
        Toast.show({
          type: "error",
          text1: "Failed to pin clip",
          text2: "Please try again later.",
        });
      } finally {
        mutationIds.current.delete(clipId);
      }
    },
    [fetchClips, scope],
  );

  const handleDelete = useCallback(
    async (clipId: string) => {
      const session = scope.capture();
      if (!session || mutationIds.current.has(clipId)) return;
      mutationIds.current.add(clipId);
      // Optimistic UI update
      setClipboardContent((prev) => prev.filter((c) => c.id !== clipId));

      try {
        await removeClip(clipId, session);
        if (!scope.isCurrent(session)) return;
        Toast.show({
          type: "success",
          text1: "Clip Deleted",
          text2: "The clip has been removed.",
        });
      } catch {
        if (!scope.isCurrent(session)) return;
        // Revert on error
        await fetchClips();
        if (!scope.isCurrent(session)) return;
        Toast.show({
          type: "error",
          text1: "Failed to delete clip",
          text2: "Please try again later.",
        });
      } finally {
        mutationIds.current.delete(clipId);
      }
    },
    [fetchClips, scope],
  );

  const handleClearHistory = () => {
    const session = scope.capture();
    if (!session || busy.current) return;
    Alert.alert(
      "Clear Clipboard History",
      "Are you sure you want to remove all unpinned clips? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear All",
          style: "destructive",
          onPress: async () => {
            if (!scope.isCurrent(session) || busy.current) return;
            busy.current = true;
            setRefreshing(true);

            // Optimistic UI update
            setClipboardContent((prev) => prev.filter((c) => c.pinned));

            try {
              await removeAllClips(session);
              if (!scope.isCurrent(session)) return;
              Toast.show({
                type: "success",
                text1: "History Cleared",
                text2: "All unpinned clips have been removed.",
              });
            } catch {
              if (!scope.isCurrent(session)) return;
              Toast.show({
                type: "error",
                text1: "Failed to clear history",
                text2: "Please try again later.",
              });
            } finally {
              busy.current = false;
              if (scope.isCurrent(session)) {
                await fetchClips();
                if (scope.isCurrent(session)) {
                  setRefreshing(false);
                  setSelectedClip(undefined);
                }
              }
            }
          },
        },
      ],
    );
  };

  const handleOpenEdit = useCallback(
    (clip: ClipData) => {
      if (!scope.capture() || saving.current) return;
      setEditingClip(clip);
      setEditContent(clip.content);
    },
    [scope],
  );

  const handleSaveEdit = useCallback(async () => {
    const session = scope.capture();
    if (!session || saving.current) return;
    if (!editingClip || editContent === editingClip.content) {
      setEditingClip(null);
      return;
    }

    if (editContent.trim().length === 0) {
      Toast.show({
        type: "error",
        text1: "Cannot Save Empty Clip",
        text2: "Please enter some content.",
      });
      return;
    }

    if (editContent.length > CLIPBOARD_CONFIG.maxContentLength) {
      Toast.show({
        type: "error",
        text1: "Clip Too Large",
        text2: `Content exceeds ${CLIPBOARD_CONFIG.maxContentLength.toLocaleString()} characters limit.`,
      });
      return;
    }

    saving.current = true;
    setIsSavingEdit(true);

    // Optimistic UI update
    const clipId = editingClip.id;
    try {
      const detectedType = await detectClipboardType(editContent);
      if (!scope.isCurrent(session)) return;
      setClipboardContent((prev) =>
        prev.map((c) =>
          c.id === clipId
            ? { ...c, content: editContent, type: detectedType }
            : c,
        ),
      );
      await editClip(clipId, editContent, detectedType, session);
      if (!scope.isCurrent(session)) return;
      setEditingClip(null);
      await fetchClips();
      if (!scope.isCurrent(session)) return;
      Toast.show({
        type: "success",
        text1: "Clip Updated",
        text2: "Your changes have been saved.",
      });
    } catch {
      if (!scope.isCurrent(session)) return;
      // Revert on error
      await fetchClips();
      if (!scope.isCurrent(session)) return;
      Toast.show({
        type: "error",
        text1: "Failed to Update Clip",
        text2: "Please try again later.",
      });
    } finally {
      saving.current = false;
      if (scope.isCurrent(session)) setIsSavingEdit(false);
    }
  }, [editingClip, editContent, fetchClips, scope]);

  const handleCopy = useCallback(
    async (clipId: string, content: string, _type?: string) => {
      const session = scope.capture();
      if (!session || AppState.currentState !== "active") return;
      if (
        clipboardContentRef.current.find((clip) => clip.id === clipId)
          ?.decryptionFailed
      ) {
        Toast.show({
          type: "error",
          text1: "Cannot Copy",
          text2: "This clip could not be decrypted with your current key.",
        });
        return;
      }
      try {
        await writeClipToClipboard(content, session, () =>
          scope.isCurrent(session),
        );
      } catch {
        if (scope.isCurrent(session)) {
          Toast.show({
            type: "error",
            text1: "Could Not Copy",
            text2: "Try again.",
          });
        }
        return;
      }
      if (!scope.isCurrent(session)) return;
      setSelectedClip(clipId);
      Toast.show({
        type: "success",
        text1: "Copied to Clipboard!",
        text2: "Ready to paste anywhere.",
        visibilityTime: 1500,
      });
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = setTimeout(() => {
        if (scope.isCurrent(session)) setSelectedClip(undefined);
      }, 2000);
    },
    [scope],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: ClipData; index: number }) => {
      const isCopied = item.id === selectedClip;
      const deviceName = formatDeviceName(item.sourceDevice);
      const deviceIcon = getDeviceIcon(item.sourceDevice);
      const timeDisplay = formatClipTime(item.timestamp);

      return (
        <Animated.View
          entering={FadeInDown.delay(Math.min(index, 10) * 50).duration(400)}
          style={[
            styles.clipCard,
            item.pinned
              ? isDark
                ? styles.clipCardPinnedDark
                : styles.clipCardPinnedLight
              : isDark
                ? styles.clipCardDark
                : styles.clipCardLight,
          ]}
        >
          {item.pinned && (
            <View
              style={[
                styles.pinnedBadge,
                isDark ? styles.pinnedBadgeDark : styles.pinnedBadgeLight,
              ]}
            >
              <Ionicons
                name="pin"
                size={10}
                color={isDark ? colors.amber : "#92400e"}
                style={{ marginRight: 3 }}
              />
              <Text
                style={[
                  styles.pinnedBadgeText,
                  { color: isDark ? colors.amber : "#92400e" },
                ]}
              >
                Pinned
              </Text>
            </View>
          )}

          {/* Clip Content & Copy Button */}
          <View style={styles.clipContentRow}>
            <TouchableOpacity
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Copy clip"
              onPress={() => handleCopy(item.id, item.content, item.type)}
              style={styles.clipTextWrapper}
            >
              <Text
                style={[
                  styles.clipContentText,
                  { color: isDark ? colors.text.dark : colors.text.light },
                ]}
                numberOfLines={4}
              >
                {item.content}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Copy clip"
              onPress={() => handleCopy(item.id, item.content, item.type)}
              style={[
                styles.copyButton,
                isCopied
                  ? isDark
                    ? styles.copyButtonCopiedDark
                    : styles.copyButtonCopiedLight
                  : isDark
                    ? styles.copyButtonDark
                    : styles.copyButtonLight,
              ]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name={isCopied ? "checkmark" : "copy-outline"}
                size={18}
                color={isCopied ? colors.successAlt : colors.primary}
              />
            </TouchableOpacity>
          </View>

          {/* Footer Metadata & Action Buttons */}
          <View
            style={[
              styles.clipMetaRow,
              isDark ? styles.clipMetaRowDark : styles.clipMetaRowLight,
            ]}
          >
            {/* Left: Device & Timestamp stream */}
            <View style={styles.metaLeftGroup}>
              <Ionicons
                name={deviceIcon}
                size={13}
                color={isDark ? colors.text.mutedDark : colors.text.mutedLight}
                style={styles.metaDeviceIcon}
              />
              <Text
                style={[
                  styles.metaText,
                  styles.metaDeviceText,
                  {
                    color: isDark
                      ? colors.text.mutedDark
                      : colors.text.mutedLight,
                  },
                ]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {deviceName}
              </Text>
              <Text
                style={[
                  styles.metaDot,
                  {
                    color: isDark
                      ? "rgba(255, 255, 255, 0.3)"
                      : "rgba(0, 0, 0, 0.3)",
                  },
                ]}
              >
                •
              </Text>
              <Text
                style={[
                  styles.metaText,
                  styles.metaTimeText,
                  {
                    color: isDark
                      ? colors.text.mutedDark
                      : colors.text.mutedLight,
                  },
                ]}
                numberOfLines={1}
              >
                {timeDisplay}
              </Text>
            </View>

            {/* Right: Quick Actions */}
            <View style={styles.actionButtonGroup}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Edit clip"
                onPress={() => handleOpenEdit(item)}
                style={[
                  styles.actionIconBtn,
                  isDark ? styles.actionIconBtnDark : styles.actionIconBtnLight,
                ]}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name="create-outline"
                  size={15}
                  color={colors.primary}
                />
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={item.pinned ? "Unpin clip" : "Pin clip"}
                onPress={() => handleTogglePin(item.id, !!item.pinned)}
                style={[
                  styles.actionIconBtn,
                  item.pinned
                    ? isDark
                      ? styles.actionIconBtnPinnedDark
                      : styles.actionIconBtnPinnedLight
                    : isDark
                      ? styles.actionIconBtnDark
                      : styles.actionIconBtnLight,
                ]}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name={item.pinned ? "pin" : "pin-outline"}
                  size={15}
                  color={
                    item.pinned
                      ? colors.amber
                      : isDark
                        ? colors.text.mutedDark
                        : colors.text.mutedLight
                  }
                />
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Delete clip"
                onPress={() => handleDelete(item.id)}
                style={[
                  styles.actionIconBtn,
                  isDark ? styles.actionIconBtnDark : styles.actionIconBtnLight,
                ]}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name="trash-outline"
                  size={15}
                  color={colors.danger}
                />
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      );
    },
    [
      isDark,
      selectedClip,
      handleCopy,
      handleTogglePin,
      handleDelete,
      handleOpenEdit,
    ],
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
          paddingBottom: 180,
          paddingTop: Platform.OS === "ios" ? 130 : 110,
        }}
        ListHeaderComponent={
          error ? (
            <Text accessibilityRole="alert" style={{ color: colors.danger }}>
              {error}
            </Text>
          ) : undefined
        }
        data={clipboardContent}
        renderItem={renderItem}
        refreshing={refreshing}
        onRefresh={onRefresh}
        keyExtractor={(item) => item.id}
        extraData={selectedClip}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View
              style={[
                styles.emptyIconBox,
                isDark ? styles.emptyIconBoxDark : styles.emptyIconBoxLight,
              ]}
            >
              <Ionicons
                name={error ? "alert-circle-outline" : "clipboard-outline"}
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
              {error ? "Oops! Something went wrong" : "Your Clipboard is Empty"}
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
                : "Send text from any of your connected devices, and it will magically appear right here."}
            </Text>
          </View>
        }
        ListFooterComponent={
          clipboardContent.filter((c) => !c.pinned).length > 0 ? (
            <TouchableOpacity
              style={styles.clearHistoryButton}
              activeOpacity={0.7}
              onPress={handleClearHistory}
            >
              <Text style={styles.clearHistoryText}>
                Clear Unpinned History
              </Text>
            </TouchableOpacity>
          ) : undefined
        }
      />

      {/* Edit Clip Modal */}
      <Modal
        visible={editingClip !== null}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!saving.current) setEditingClip(null);
        }}
      >
        <TouchableWithoutFeedback
          onPress={() => {
            if (!saving.current) setEditingClip(null);
          }}
        >
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : undefined}
              >
                <View
                  style={[
                    styles.modalContent,
                    {
                      minHeight: screenHeight * 0.55,
                      maxHeight: screenHeight * 0.85,
                      backgroundColor: isDark
                        ? colors.card.dark
                        : colors.card.light,
                      borderColor: isDark
                        ? "rgba(255,255,255,0.1)"
                        : "rgba(0,0,0,0.05)",
                    },
                  ]}
                >
                  {/* Drag Handle */}
                  <View style={styles.dragHandleWrapper}>
                    <View
                      style={[
                        styles.dragHandle,
                        {
                          backgroundColor: isDark
                            ? "rgba(255,255,255,0.2)"
                            : "rgba(0,0,0,0.15)",
                        },
                      ]}
                    />
                  </View>

                  {/* Header */}
                  <View style={styles.modalHeader}>
                    <View style={styles.modalHeaderTitleGroup}>
                      <View style={styles.modalHeaderIconBox}>
                        <Ionicons name="create" size={18} color="white" />
                      </View>
                      <Text
                        style={[
                          styles.modalHeaderTitle,
                          {
                            color: isDark
                              ? colors.text.dark
                              : colors.text.light,
                          },
                        ]}
                      >
                        Edit Clip
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => {
                        if (!saving.current) setEditingClip(null);
                      }}
                      style={[
                        styles.modalCloseBtn,
                        isDark
                          ? styles.modalCloseBtnDark
                          : styles.modalCloseBtnLight,
                      ]}
                    >
                      <Ionicons
                        name="close"
                        size={20}
                        color={isDark ? colors.text.mutedDark : "#6b7280"}
                      />
                    </TouchableOpacity>
                  </View>

                  {/* Text Input */}
                  <View style={styles.modalInputWrapper}>
                    <TextInput
                      ref={editInputRef}
                      multiline
                      autoFocus
                      editable={!isSavingEdit}
                      maxLength={CLIPBOARD_CONFIG.maxContentLength}
                      value={editContent}
                      onChangeText={setEditContent}
                      placeholder="Enter clip content..."
                      placeholderTextColor={isDark ? "#52525b" : "#a1a1aa"}
                      style={[
                        styles.modalTextInput,
                        {
                          minHeight: screenHeight * 0.25,
                          color: isDark ? "#fafafa" : "#18181b",
                          fontFamily:
                            Platform.OS === "ios" ? "Menlo" : "monospace",
                          backgroundColor: isDark
                            ? "rgba(255,255,255,0.05)"
                            : "rgba(0,0,0,0.03)",
                          borderColor: isDark
                            ? "rgba(255,255,255,0.08)"
                            : "rgba(0,0,0,0.06)",
                        },
                      ]}
                    />
                  </View>

                  {/* Footer Info */}
                  <View style={styles.modalStatsRow}>
                    <View style={styles.modalStatsGroup}>
                      <View
                        style={[
                          styles.metaBadge,
                          isDark
                            ? styles.subtleIconBoxDark
                            : styles.subtleIconBoxLight,
                        ]}
                      >
                        <Ionicons
                          name="text-outline"
                          size={13}
                          color="#6b7280"
                        />
                        <Text
                          style={[
                            styles.metaText,
                            {
                              color: isDark
                                ? colors.text.mutedDark
                                : colors.text.mutedLight,
                            },
                          ]}
                        >
                          {editContent.length} chars
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.metaBadge,
                          isDark
                            ? styles.subtleIconBoxDark
                            : styles.subtleIconBoxLight,
                        ]}
                      >
                        <Ionicons
                          name="document-text-outline"
                          size={13}
                          color="#6b7280"
                        />
                        <Text
                          style={[
                            styles.metaText,
                            {
                              color: isDark
                                ? colors.text.mutedDark
                                : colors.text.mutedLight,
                            },
                          ]}
                        >
                          {editContent.split(/\s+/).filter(Boolean).length}{" "}
                          words
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Action Buttons */}
                  <View
                    style={[
                      styles.modalActionButtonsRow,
                      {
                        paddingBottom: Platform.OS === "ios" ? 36 : 20,
                      },
                    ]}
                  >
                    <TouchableOpacity
                      style={[
                        styles.modalCancelBtn,
                        isDark
                          ? styles.modalCancelBtnDark
                          : styles.modalCancelBtnLight,
                      ]}
                      activeOpacity={0.7}
                      onPress={() => {
                        if (!saving.current) setEditingClip(null);
                      }}
                    >
                      <Text
                        style={[
                          styles.modalCancelText,
                          {
                            color: isDark ? colors.text.mutedDark : "#4b5563",
                          },
                        ]}
                      >
                        Cancel
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.modalSaveBtn}
                      activeOpacity={0.8}
                      onPress={handleSaveEdit}
                      disabled={isSavingEdit}
                    >
                      {isSavingEdit ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                      ) : (
                        <>
                          <Ionicons
                            name="checkmark"
                            size={20}
                            color="#ffffff"
                          />
                          <Text style={styles.modalSaveText}>Save</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </KeyboardAvoidingView>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Floating Action Area */}
      <View
        style={[
          styles.floatingActionArea,
          {
            borderColor: isDark
              ? "rgba(39, 39, 42, 0.8)"
              : "rgba(229, 231, 235, 0.5)",
          },
        ]}
      >
        <BlurView
          intensity={80}
          tint={isDark ? "dark" : "light"}
          style={styles.floatingActionBlur}
        >
          <TouchableOpacity
            style={[
              styles.floatingActionBtnReceive,
              isDark
                ? styles.floatingActionBtnReceiveDark
                : styles.floatingActionBtnReceiveLight,
            ]}
            activeOpacity={0.7}
            onPress={handleReceive}
          >
            <Ionicons
              name="cloud-download-outline"
              size={20}
              color={colors.primary}
            />
            <Text
              style={[
                styles.floatingActionBtnReceiveText,
                { color: isDark ? colors.primaryLight : colors.primary },
              ]}
            >
              Receive
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.floatingActionBtnSend}
            activeOpacity={0.8}
            onPress={handleSend}
          >
            <Ionicons name="paper-plane" size={20} color="#ffffff" />
            <Text style={styles.floatingActionBtnSendText}>Send</Text>
          </TouchableOpacity>
        </BlurView>
      </View>
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
  clipCard: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    borderRadius: 20,
    marginBottom: 14,
    borderWidth: 1,
    shadowColor: "#1e3a8a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  clipCardLight: {
    backgroundColor: colors.card.light,
    borderColor: colors.border.light,
  },
  clipCardDark: {
    backgroundColor: colors.card.dark,
    borderColor: colors.border.dark,
  },
  clipCardPinnedLight: {
    backgroundColor: colors.amberTint,
    borderColor: colors.amberBorder,
    borderWidth: 1.5,
    position: "relative",
  },
  clipCardPinnedDark: {
    backgroundColor: colors.amberTintDark,
    borderColor: colors.amberBorderDark,
    borderWidth: 1.5,
    position: "relative",
  },
  pinnedBadge: {
    position: "absolute",
    top: -10,
    right: 18,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  pinnedBadgeLight: {
    backgroundColor: "#fef3c7",
    borderColor: "#fde68a",
  },
  pinnedBadgeDark: {
    backgroundColor: "rgba(180, 83, 9, 0.7)",
    borderColor: "rgba(217, 119, 6, 0.6)",
  },
  pinnedBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  clipContentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  clipTextWrapper: {
    flex: 1,
    marginRight: 12,
  },
  clipContentText: {
    fontWeight: "500",
    fontSize: 16,
    lineHeight: 23,
  },
  copyButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  copyButtonLight: {
    backgroundColor: colors.primaryTint,
  },
  copyButtonDark: {
    backgroundColor: colors.primaryTintDark,
  },
  copyButtonCopiedLight: {
    backgroundColor: "#ecfdf5",
  },
  copyButtonCopiedDark: {
    backgroundColor: "rgba(16, 185, 129, 0.2)",
  },
  subtleIconBoxLight: {
    backgroundColor: "#f9fafb",
  },
  subtleIconBoxDark: {
    backgroundColor: colors.border.dark,
  },
  clipMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
    borderTopWidth: 1,
    paddingTop: 10,
  },
  clipMetaRowLight: {
    borderTopColor: "rgba(0, 0, 0, 0.05)",
  },
  clipMetaRowDark: {
    borderTopColor: "rgba(255, 255, 255, 0.07)",
  },
  metaLeftGroup: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    marginRight: 8,
  },
  metaDeviceIcon: {
    marginRight: 5,
    flexShrink: 0,
  },
  metaText: {
    fontSize: 12,
    fontWeight: "500",
  },
  metaDeviceText: {
    flexShrink: 1,
  },
  metaDot: {
    fontSize: 12,
    marginHorizontal: 5,
    flexShrink: 0,
  },
  metaTimeText: {
    flexShrink: 0,
  },
  metaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  actionButtonGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
  },
  actionIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  actionIconBtnLight: {
    backgroundColor: "#f3f4f6",
  },
  actionIconBtnDark: {
    backgroundColor: "#27272a",
  },
  actionIconBtnPinnedLight: {
    backgroundColor: "#fef3c7",
    borderWidth: 1,
    borderColor: "#fde68a",
  },
  actionIconBtnPinnedDark: {
    backgroundColor: "rgba(180, 83, 9, 0.3)",
    borderWidth: 1,
    borderColor: "rgba(217, 119, 6, 0.4)",
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
  clearHistoryButton: {
    marginTop: 24,
    marginBottom: 40,
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    opacity: 0.8,
  },
  clearHistoryText: {
    color: colors.danger,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
  },
  dragHandleWrapper: {
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 4,
  },
  dragHandle: {
    width: 40,
    height: 5,
    borderRadius: 999,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  modalHeaderTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  modalHeaderIconBox: {
    backgroundColor: colors.primary,
    padding: 6,
    borderRadius: 12,
  },
  modalHeaderTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  modalCloseBtn: {
    padding: 8,
    borderRadius: 999,
  },
  modalCloseBtnLight: {
    backgroundColor: "#f3f4f6",
  },
  modalCloseBtnDark: {
    backgroundColor: colors.border.dark,
  },
  modalInputWrapper: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  modalTextInput: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    textAlignVertical: "top",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  modalStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  modalStatsGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  modalActionButtonsRow: {
    flexDirection: "row",
    paddingHorizontal: 24,
    gap: 12,
    paddingTop: 8,
  },
  modalCancelBtn: {
    flex: 1,
    borderWidth: 1,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCancelBtnLight: {
    backgroundColor: "#f3f4f6",
    borderColor: colors.border.lightStrong,
  },
  modalCancelBtnDark: {
    backgroundColor: colors.border.dark,
    borderColor: colors.border.darkStrong,
  },
  modalCancelText: {
    fontWeight: "700",
    fontSize: 15,
  },
  modalSaveBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  modalSaveText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 15,
  },
  floatingActionArea: {
    position: "absolute",
    bottom: 110,
    left: 20,
    right: 20,
    overflow: "hidden",
    borderRadius: 24,
    borderWidth: 1,
    shadowColor: "#1e3a8a",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
  },
  floatingActionBlur: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
  },
  floatingActionBtnReceive: {
    flex: 1,
    marginRight: 6,
    borderWidth: 1,
    paddingVertical: 14,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  floatingActionBtnReceiveLight: {
    backgroundColor: colors.primaryTint,
    borderColor: "#bfdbfe",
  },
  floatingActionBtnReceiveDark: {
    backgroundColor: colors.primaryTintDark,
    borderColor: "rgba(30, 64, 175, 0.4)",
  },
  floatingActionBtnReceiveText: {
    fontWeight: "700",
    fontSize: 15,
  },
  floatingActionBtnSend: {
    flex: 1,
    marginLeft: 6,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  floatingActionBtnSendText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 15,
  },
});
