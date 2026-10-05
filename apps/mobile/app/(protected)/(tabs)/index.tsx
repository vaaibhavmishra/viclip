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
  BackHandler,
  Dimensions,
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
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import Toast from "react-native-toast-message";
import { colors } from "@/constants/theme";
import { decryptClips, editClip, sendClip } from "@/services/clipboard";
import {
  enforceClipLimit,
  getClips,
  removeAllClips,
  removeClip,
  togglePinClip,
} from "@/services/firebase";
import { detectClipboardType, extractTextFromShare } from "@/utils/util";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function Index() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const [clipboardContent, setClipboardContent] = useState<ClipData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedClip, setSelectedClip] = useState<string>();
  const [lastClip, setLastClip] = useState<string | null>(null);

  // Edit modal state
  const [editingClip, setEditingClip] = useState<ClipData | null>(null);
  const [editContent, setEditContent] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const editInputRef = useRef<TextInput>(null);

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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchClips();
  }, [fetchClips]);

  useEffect(() => {
    if (hasShareIntent && shareIntent) {
      let exitTimer: ReturnType<typeof setTimeout> | undefined;

      const handleShare = async () => {
        const originalContent = shareIntent?.text || "";
        const cleanContent = extractTextFromShare(originalContent);
        const contentToSave = cleanContent.trim() || originalContent.trim();

        if (contentToSave) {
          if (contentToSave.length > CLIPBOARD_CONFIG.maxContentLength) {
            Toast.show({
              type: "error",
              text1: "Content Too Large",
              text2: `Shared content exceeds ${CLIPBOARD_CONFIG.maxContentLength.toLocaleString()} characters limit.`,
            });
          } else {
            setRefreshing(true);
            await enforceClipLimit();
            await sendClip(contentToSave, "text");
            await fetchClips();
            setRefreshing(false);
          }
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
  }, [hasShareIntent, shareIntent, resetShareIntent, fetchClips]);

  useFocusEffect(
    useCallback(() => {
      fetchClips();
    }, [fetchClips]),
  );

  useEffect(() => {
    Clipboard.getStringAsync().then((content) => {
      setLastClip(content);
    });
  }, []);

  const handleSend = async () => {
    const clipboard = await Clipboard.getStringAsync();

    if (clipboard && clipboard !== lastClip) {
      setRefreshing(true);
      const contentType = await detectClipboardType(clipboard);
      if (
        contentType === "text" ||
        contentType === "url" ||
        contentType === "text-formatted" ||
        contentType === "email" ||
        contentType === "color"
      ) {
        if (clipboard.length > CLIPBOARD_CONFIG.maxContentLength) {
          console.warn("Content exceeds maximum size limit, skipping sync", {
            contentLength: clipboard.length,
            maxLength: CLIPBOARD_CONFIG.maxContentLength,
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
      Toast.show({
        type: "success",
        text1: "Clip Sent",
        text2: "Available on all your devices.",
      });
    } else {
      Toast.show({
        type: "info",
        text1: "Nothing New to Send",
        text2: "Your clipboard is unchanged or empty.",
      });
    }
  };

  const handleReceive = async () => {
    setRefreshing(true);
    await fetchClips();
    setRefreshing(false);
    Toast.show({
      type: "success",
      text1: "Synced Successfully",
      text2: "Your clips are up to date.",
    });
  };

  const handleTogglePin = useCallback(
    async (clipId: string, currentPinned: boolean) => {
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

  const handleOpenEdit = useCallback((clip: ClipData) => {
    setEditingClip(clip);
    setEditContent(clip.content);
  }, []);

  const handleSaveEdit = useCallback(async () => {
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

    setIsSavingEdit(true);

    // Optimistic UI update
    const clipId = editingClip.id;
    setClipboardContent((prev) =>
      prev.map((c) => (c.id === clipId ? { ...c, content: editContent } : c)),
    );
    setEditingClip(null);

    try {
      await editClip(clipId, editContent);
      await fetchClips();
      Toast.show({
        type: "success",
        text1: "Clip Updated",
        text2: "Your changes have been saved.",
      });
    } catch {
      // Revert on error
      await fetchClips();
      Toast.show({
        type: "error",
        text1: "Failed to Update Clip",
        text2: "Please try again later.",
      });
    } finally {
      setIsSavingEdit(false);
    }
  }, [editingClip, editContent, fetchClips]);

  const renderItem = useCallback(
    ({ item, index }: { item: ClipData; index: number }) => (
      <Animated.View
        entering={FadeInDown.delay(index * 50).duration(400)}
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
        <View style={styles.clipContentRow}>
          <View style={styles.clipTextWrapper}>
            <Text
              style={[
                styles.clipContentText,
                { color: isDark ? colors.text.dark : colors.text.light },
              ]}
              numberOfLines={4}
            >
              {item.content}
            </Text>
          </View>
          <TouchableWithoutFeedback
            onPress={() => {
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
            <View
              style={[
                styles.copyButton,
                isDark ? styles.subtleIconBoxDark : styles.subtleIconBoxLight,
              ]}
            >
              {item.id === selectedClip ? (
                <Ionicons
                  name="checkmark"
                  size={20}
                  color={colors.successAlt}
                />
              ) : (
                <Ionicons
                  name="copy-outline"
                  size={20}
                  color={colors.primary}
                />
              )}
            </View>
          </TouchableWithoutFeedback>
        </View>

        <View
          style={[
            styles.clipMetaRow,
            isDark ? styles.clipMetaRowDark : styles.clipMetaRowLight,
          ]}
        >
          <View style={styles.metaLeftGroup}>
            <View
              style={[
                styles.metaBadge,
                isDark ? styles.subtleIconBoxDark : styles.subtleIconBoxLight,
              ]}
            >
              <Ionicons name="time-outline" size={14} color="#6b7280" />
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
                {new Date(item.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </View>
            <View
              style={[
                styles.metaBadge,
                isDark ? styles.subtleIconBoxDark : styles.subtleIconBoxLight,
              ]}
            >
              <Ionicons name="desktop-outline" size={14} color="#6b7280" />
              <Text
                style={[
                  styles.metaText,
                  {
                    color: isDark
                      ? colors.text.mutedDark
                      : colors.text.mutedLight,
                    maxWidth: 100,
                  },
                ]}
                numberOfLines={1}
              >
                {item.sourceDevice}
              </Text>
            </View>
          </View>
          <View style={styles.actionButtonGroup}>
            <TouchableOpacity
              onPress={() => handleOpenEdit(item)}
              style={[
                styles.actionIconBtn,
                isDark ? styles.subtleIconBoxDark : styles.subtleIconBoxLight,
              ]}
            >
              <Ionicons
                name="create-outline"
                size={16}
                color={colors.primary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleTogglePin(item.id, !!item.pinned)}
              style={[
                styles.actionIconBtn,
                isDark ? styles.subtleIconBoxDark : styles.subtleIconBoxLight,
              ]}
            >
              <Ionicons
                name={item.pinned ? "pin" : "pin-outline"}
                size={16}
                color={item.pinned ? colors.amber : "#6b7280"}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleDelete(item.id)}
              style={[
                styles.actionIconBtn,
                isDark ? styles.subtleIconBoxDark : styles.subtleIconBoxLight,
              ]}
            >
              <Ionicons name="trash-outline" size={16} color={colors.danger} />
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    ),
    [isDark, selectedClip, handleTogglePin, handleDelete, handleOpenEdit],
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
          ) : null
        }
      />

      {/* Edit Clip Modal */}
      <Modal
        visible={editingClip !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setEditingClip(null)}
      >
        <TouchableWithoutFeedback onPress={() => setEditingClip(null)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
              >
                <View
                  style={[
                    styles.modalContent,
                    {
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
                      onPress={() => setEditingClip(null)}
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
                      value={editContent}
                      onChangeText={setEditContent}
                      placeholder="Enter clip content..."
                      placeholderTextColor={isDark ? "#52525b" : "#a1a1aa"}
                      style={[
                        styles.modalTextInput,
                        {
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
                      onPress={() => setEditingClip(null)}
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
    padding: 20,
    borderRadius: 24,
    marginBottom: 16,
    borderWidth: 1,
    shadowColor: "#1e3a8a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
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
    borderWidth: 2,
    position: "relative",
  },
  clipCardPinnedDark: {
    backgroundColor: colors.amberTintDark,
    borderColor: colors.amberBorderDark,
    borderWidth: 2,
    position: "relative",
  },
  pinnedBadge: {
    position: "absolute",
    top: -12,
    right: 24,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  pinnedBadgeLight: {
    backgroundColor: "#fef3c7",
    borderColor: "#fde68a",
  },
  pinnedBadgeDark: {
    backgroundColor: "rgba(180, 83, 9, 0.6)",
    borderColor: "rgba(217, 119, 6, 0.5)",
  },
  pinnedBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  clipContentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
    marginTop: 4,
  },
  clipTextWrapper: {
    flex: 1,
    marginRight: 16,
  },
  clipContentText: {
    fontWeight: "500",
    fontSize: 18,
    lineHeight: 24,
  },
  copyButton: {
    padding: 10,
    borderRadius: 999,
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
    marginTop: 8,
    borderTopWidth: 1,
    paddingTop: 12,
  },
  clipMetaRowLight: {
    borderTopColor: colors.border.light,
  },
  clipMetaRowDark: {
    borderTopColor: "rgba(39, 39, 42, 0.5)",
  },
  metaLeftGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  metaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  metaText: {
    fontSize: 12,
    fontWeight: "500",
  },
  actionButtonGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionIconBtn: {
    padding: 6,
    borderRadius: 999,
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
    minHeight: SCREEN_HEIGHT * 0.55,
    maxHeight: SCREEN_HEIGHT * 0.85,
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
    minHeight: SCREEN_HEIGHT * 0.25,
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
