import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import ImageViewing from "react-native-image-viewing";
import { API_BASE_URL } from "../constants/api";
import {
  THEME_STORAGE_KEY,
  ThemeName,
  themes,
} from "../constants/appTheme";
import useJobChatStore, {
  ChatIntent,
  ChatMessage,
} from "../hooks/useJobChatStore";

// 👇 REAL AI SERVER URL – now using your shared API_BASE_URL
// ngrok forwards this to http://localhost:4001 on your Mac
const AI_GATE_BASE_URL = API_BASE_URL;

// helper for time display
const formatTime = (ts: number) =>
  new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

// Seed messages so brand-new chats aren’t empty
const createSeedMessages = (): ChatMessage[] => {
  const now = Date.now();
  return [
    {
      id: "seed-1",
      authorLabel: "You",
      role: "you",
      text: "Hey Vic, panel is installed and wired. Waiting on inspection.",
      createdAt: now - 1000 * 60 * 15,
      intent: "progress",
    },
    {
      id: "seed-2",
      authorLabel: "Vic",
      role: "boss",
      text: "Nice. After inspection, send me a photo of the panel with labels.",
      createdAt: now - 1000 * 60 * 10,
      intent: "other",
    },
  ];
};

const SEED_MESSAGES: ChatMessage[] = createSeedMessages();

/** ---------------- AI HELPERS ---------------- **/

// classify intent from final cleaned text
function classifyIntentFromText(text: string): ChatIntent {
  const lower = text.toLowerCase();

  if (
    lower.includes("material") ||
    lower.includes("conduit") ||
    lower.includes("bx") ||
    lower.includes("mc") ||
    lower.includes("breakers") ||
    lower.includes("wire")
  ) {
    return "materials";
  }

  if (
    lower.includes("tripping") ||
    lower.includes("not working") ||
    lower.includes("dead") ||
    lower.includes("no power") ||
    lower.includes("issue") ||
    lower.includes("sparks") ||
    lower.includes("burning")
  ) {
    return "issue";
  }

  if (
    lower.includes("finished") ||
    lower.includes("done") ||
    lower.includes("almost") ||
    lower.includes("update") ||
    lower.includes("progress")
  ) {
    return "progress";
  }

  return "other";
}

// Old local mini-AI (offline fallback)
function runAiGateLocal(raw: string): { previewText: string; intent: ChatIntent } {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!trimmed) {
    return { previewText: "", intent: "other" };
  }

  let cleaned = trimmed;

  // If user writes "hey vic" make it structured
  if (/hey\s+vic/i.test(cleaned)) {
    cleaned = cleaned.replace(/hey\s+vic[, ]*/i, "");
    cleaned = `Hey Vic,\n\n${cleaned.trim()}`;
  } else {
    cleaned = `Quick update:\n\n${cleaned.trim()}`;
  }

  if (!/[.!?]$/.test(cleaned)) {
    cleaned += ".";
  }

  const intent = classifyIntentFromText(cleaned);
  return { previewText: cleaned, intent };
}

// Real AI gate – talks to your Node server first, then falls back to local
async function runAiGate(
  raw: string,
  jobTitle: string | undefined,
  jobId: string
): Promise<{ previewText: string; intent: ChatIntent }> {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { previewText: "", intent: "other" };
  }

  try {
    const url = `${AI_GATE_BASE_URL}/ai-gate`;
    console.log("AI gate URL:", url);

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: trimmed,
        jobTitle: jobTitle || "",
        jobId,
      }),
    });

    if (!res.ok) {
      console.warn("AI gate HTTP error:", res.status, await res.text());
      throw new Error(`HTTP ${res.status}`);
    }

    const data: any = await res.json();
    if (!data || !data.ok || !data.previewText) {
      console.warn("Bad AI gate payload:", data);
      throw new Error("Bad AI payload");
    }

    const previewText: string = (data.previewText as string).trim();
    const intent = classifyIntentFromText(previewText);

    return { previewText, intent };
  } catch (err: any) {
    console.error("AI gate request failed:", err);

    // show simple error, then fallback so the button still works
    Alert.alert(
      "AI not available",
      "There was a problem talking to the AI helper. Using the local helper instead."
    );

    return runAiGateLocal(raw);
  }
}

/** -------------- SCREEN COMPONENT -------------- **/

export default function JobChatScreen() {
  const router = useRouter();
  const { id, title } =
    useLocalSearchParams<{ id?: string; title?: string }>();

  const jobId = id ?? "default";

  // THEME
  const [themeName, setThemeName] = useState<ThemeName>("dark");
  const theme = themes[themeName] ?? themes.dark;

  // PERSISTENT CHAT STORE (per job)
  const {
    messages,
    appendMessage,
    isLoaded,
  } = useJobChatStore({
    jobId,
    seedMessages: SEED_MESSAGES,
  });

  // draft + AI preview
  const [chatDraft, setChatDraft] = useState("");
  const [aiPreviewText, setAiPreviewText] = useState("");
  const [aiPreviewIntent, setAiPreviewIntent] = useState<ChatIntent | null>(
    null
  );
  const [isHelperOpen, setIsHelperOpen] = useState(false);

  const screenScale = useRef(new Animated.Value(1.04)).current;
  const scrollRef = useRef<ScrollView | null>(null);

  // fullscreen image viewer state
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [imageViewerIndex, setImageViewerIndex] = useState(0);
  const [imageViewerImages, setImageViewerImages] = useState<
    { uri: string }[]
  >([]);

  // Load theme
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (saved === "light" || saved === "dark" || saved === "midnight") {
          setThemeName(saved as ThemeName);
        }
      } catch (e) {
        console.warn("Failed to load theme for chat:", e);
      }
    };
    loadTheme();
  }, []);

  // Small entrance animation
  useEffect(() => {
    Animated.timing(screenScale, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [screenScale]);

  const scrollToBottom = () => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollToEnd({ animated: true });
  };

  // scroll when new messages come in (after store loaded)
  useEffect(() => {
    if (!isLoaded) return;
    const timeout = setTimeout(scrollToBottom, 60);
    return () => clearTimeout(timeout);
  }, [messages.length, isLoaded]);

  // 🔥 NOW ASYNC – uses real AI gate + fallback
  const handleRunAiOnDraft = async () => {
    if (!chatDraft.trim()) {
      Alert.alert("Empty message", "Type something before reviewing.");
      return;
    }

    const { previewText, intent } = await runAiGate(
      chatDraft,
      title,
      jobId
    );

    if (!previewText) return;

    setAiPreviewText(previewText);
    setAiPreviewIntent(intent);

    Keyboard.dismiss();
    scrollToBottom();
  };

  const handleSendFromAiPreview = () => {
    if (!aiPreviewText.trim()) return;

    const newMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      authorLabel: "You",
      role: "you",
      text: aiPreviewText.trim(),
      createdAt: Date.now(),
      intent: aiPreviewIntent || "other",
    };

    appendMessage(newMessage);
    setChatDraft("");
    setAiPreviewText("");
    setAiPreviewIntent(null);
  };

  const handleCancelAiPreview = () => {
    setAiPreviewText("");
    setAiPreviewIntent(null);
  };

  const handleEditFromPreview = () => {
    setChatDraft(aiPreviewText);
    setAiPreviewText("");
    setAiPreviewIntent(null);
  };

  // Take a photo and send as chat message (with optional caption from draft)
  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Camera permission needed",
          "Enable camera access to send job photos in chat."
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.6,
      });

      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset?.uri) return;

      const newMessage: ChatMessage = {
        id: `photo-${Date.now()}`,
        authorLabel: "You",
        role: "you",
        text: chatDraft.trim(), // optional caption
        createdAt: Date.now(),
        intent: "progress", // default for photos (can tweak later)
        imageUri: asset.uri,
      };

      appendMessage(newMessage);
      setChatDraft("");
      setIsHelperOpen(false);
      setTimeout(scrollToBottom, 80);
    } catch (err) {
      console.warn("Photo error:", err);
      Alert.alert("Photo error", "Could not open the camera.");
    }
  };

  // Pick an existing photo from library and send it
  const handlePickFromLibrary = async () => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Photos permission needed",
          "Enable photo library access to send saved photos."
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.6,
      });

      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset?.uri) return;

      const newMessage: ChatMessage = {
        id: `library-${Date.now()}`,
        authorLabel: "You",
        role: "you",
        text: chatDraft.trim(), // optional caption
        createdAt: Date.now(),
        intent: "progress",
        imageUri: asset.uri,
      };

      appendMessage(newMessage);
      setChatDraft("");
      setIsHelperOpen(false);
      setTimeout(scrollToBottom, 80);
    } catch (err) {
      console.warn("Library photo error:", err);
      Alert.alert("Photo error", "Could not open your photo library.");
    }
  };

  const handleSelectHelperSnippet = (kind: ChatIntent) => {
    let snippet = "";

    if (kind === "progress") {
      snippet = "Finished roughing in this room, starting to pull home runs.";
    } else if (kind === "issue") {
      snippet =
        "No power at this receptacle. Breaker is on, getting 0V at the device.";
    } else if (kind === "materials") {
      snippet =
        "Need more material: [qty] of [EMT/BX/breakers]. Let me know if I should grab it.";
    }

    if (!snippet) return;

    setChatDraft((prev) => (prev.trim() ? `${prev.trim()} ${snippet}` : snippet));
    setIsHelperOpen(false);
    setTimeout(scrollToBottom, 50);
  };

  const renderIntentLabel = (intent: ChatIntent | null) => {
    if (!intent || intent === "other") return null;
    const label =
      intent === "progress"
        ? "Progress"
        : intent === "issue"
        ? "Issue"
        : "Materials";

    return (
      <View
        style={[
          styles.intentPill,
          {
            borderColor: theme.cardBorder,
            backgroundColor: theme.cardSecondaryBackground,
          },
        ]}
      >
        <Text style={[styles.intentPillText, { color: theme.textSecondary }]}>
          {label}
        </Text>
      </View>
    );
  };

  const hasDraft = chatDraft.trim().length > 0;

  // open fullscreen viewer for tapped image
  const openImageViewerForMessage = (messageId: string) => {
    const imageMessages = messages.filter((m) => m.imageUri);
    if (!imageMessages.length) return;

    const index = imageMessages.findIndex((m) => m.id === messageId);
    const safeIndex = index < 0 ? 0 : index;

    setImageViewerImages(
      imageMessages.map((m) => ({ uri: m.imageUri as string }))
    );
    setImageViewerIndex(safeIndex);
    setImageViewerVisible(true);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.screenBackground }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 18 : 0}
    >
      {/* Fullscreen image viewer */}
      <ImageViewing
        images={imageViewerImages}
        imageIndex={imageViewerIndex}
        visible={imageViewerVisible}
        onRequestClose={() => setImageViewerVisible(false)}
        backgroundColor="black"
      />

      <Animated.View
        style={[
          styles.screen,
          {
            transform: [{ scale: screenScale }],
            backgroundColor: theme.screenBackground,
          },
        ]}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <Text style={[styles.backText, { color: theme.headerMuted }]}>
              ← Back
            </Text>
          </TouchableOpacity>

          <View style={styles.headerTitleBlock}>
            <Text style={[styles.headerTitle, { color: theme.headerText }]}>
              Team Chat
            </Text>
            <Text
              style={[styles.headerSubtitle, { color: theme.headerMuted }]}
            >
              {title
                ? String(title)
                : id
                ? `Job #${id}`
                : "Job-based internal chat"}
            </Text>
          </View>

          <View style={{ width: 60 }} />
        </View>

        {/* Chat Card */}
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View
            style={[
              styles.chatCard,
              {
                backgroundColor: theme.cardBackground,
                borderColor: theme.cardBorder,
              },
            ]}
          >
            <View style={styles.chatCardHeader}>
              <View>
                <Text
                  style={[
                    styles.chatTitle,
                    {
                      color: theme.textPrimary,
                    },
                  ]}
                >
                  Team Chat (Internal)
                </Text>
                <Text
                  style={[styles.chatSubtitle, { color: theme.textMuted }]}
                >
                  Job-only messages. No pricing, hours, or invoices here.
                </Text>
              </View>
            </View>

            {/* Messages */}
            <ScrollView
              ref={scrollRef}
              style={styles.messagesScroll}
              contentContainerStyle={styles.messagesContent}
              keyboardShouldPersistTaps="handled"
              onContentSizeChange={scrollToBottom}
            >
              {messages.map((msg) => {
                const isYou = msg.role === "you";
                return (
                  <View
                    key={msg.id}
                    style={[
                      styles.messageRow,
                      {
                        justifyContent: isYou ? "flex-end" : "flex-start",
                      },
                    ]}
                  >
                    {!isYou && (
                      <View
                        style={[
                          styles.avatarCircle,
                          { backgroundColor: theme.cardSecondaryBackground },
                        ]}
                      >
                        <Text
                          style={[
                            styles.avatarInitial,
                            { color: theme.textPrimary },
                          ]}
                        >
                          {msg.authorLabel.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}

                    <View
                      style={[
                        styles.messageBubble,
                        {
                          backgroundColor: isYou
                            ? theme.primaryButtonBackground
                            : theme.cardSecondaryBackground,
                          borderTopLeftRadius: isYou ? 18 : 6,
                          borderTopRightRadius: isYou ? 6 : 18,
                        },
                      ]}
                    >
                      <View style={styles.messageHeaderRow}>
                        <Text
                          style={[
                            styles.messageAuthor,
                            {
                              color: isYou
                                ? theme.primaryButtonText
                                : theme.textSecondary,
                            },
                          ]}
                        >
                          {msg.authorLabel}
                        </Text>
                        {renderIntentLabel(msg.intent)}
                      </View>

                      {msg.imageUri && (
                        <TouchableOpacity
                          activeOpacity={0.9}
                          onPress={() => openImageViewerForMessage(msg.id)}
                        >
                          <Image
                            source={{ uri: msg.imageUri }}
                            style={styles.messageImage}
                          />
                        </TouchableOpacity>
                      )}

                      {msg.text ? (
                        <Text
                          style={[
                            styles.messageText,
                            {
                              color: isYou
                                ? theme.primaryButtonText
                                : theme.textPrimary,
                            },
                          ]}
                        >
                          {msg.text}
                        </Text>
                      ) : null}

                      <Text
                        style={[
                          styles.messageTime,
                          {
                            color: isYou
                              ? "rgba(255,255,255,0.75)"
                              : theme.textMuted,
                          },
                        ]}
                      >
                        {formatTime(msg.createdAt)}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            {/* AI Preview */}
            {aiPreviewText ? (
              <View
                style={[
                  styles.aiPreviewCard,
                  { borderColor: theme.cardBorder },
                ]}
              >
                <View style={styles.aiPreviewHeaderRow}>
                  <Text
                    style={[
                      styles.aiPreviewLabel,
                      { color: theme.textSecondary },
                    ]}
                  >
                    AI Review
                  </Text>
                </View>
                {renderIntentLabel(aiPreviewIntent)}
                <Text
                  style={[styles.aiPreviewText, { color: theme.textPrimary }]}
                >
                  {aiPreviewText}
                </Text>

                <View style={styles.aiPreviewButtonsRow}>
                  <TouchableOpacity
                    style={[
                      styles.aiSecondaryButton,
                      {
                        borderColor: theme.cardBorder,
                      },
                    ]}
                    onPress={handleEditFromPreview}
                    activeOpacity={0.9}
                  >
                    <Text
                      style={[
                        styles.aiSecondaryButtonText,
                        { color: theme.textPrimary },
                      ]}
                    >
                      Edit text
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.aiPrimaryButton,
                      { backgroundColor: theme.primaryButtonBackground },
                    ]}
                    onPress={handleSendFromAiPreview}
                    activeOpacity={0.9}
                  >
                    <Text
                      style={[
                        styles.aiPrimaryButtonText,
                        { color: theme.primaryButtonText },
                      ]}
                    >
                      Send to chat
                    </Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.aiPreviewCancel}
                  onPress={handleCancelAiPreview}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.aiPreviewCancelText,
                      { color: theme.textMuted },
                    ]}
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {/* Helper bar (opened by +) */}
            {isHelperOpen && (
              <View
                style={[
                  styles.helperBar,
                  {
                    backgroundColor: theme.cardSecondaryBackground,
                    borderColor: theme.cardBorder,
                  },
                ]}
              >
                <View style={styles.helperHeaderRow}>
                  <Text
                    style={[
                      styles.helperLabel,
                      { color: theme.textPrimary },
                    ]}
                  >
                    Quick helpers
                  </Text>
                  <Text
                    style={[
                      styles.helperHint,
                      { color: theme.textMuted },
                    ]}
                  >
                    Tap to auto-fill or attach
                  </Text>
                </View>

                {/* Message templates */}
                <View style={styles.helperSectionRow}>
                  <Text
                    style={[
                      styles.helperSectionLabel,
                      { color: theme.textSecondary },
                    ]}
                  >
                    Message templates
                  </Text>
                  <View style={styles.helperChipsRow}>
                    <TouchableOpacity
                      style={styles.helperChip}
                      activeOpacity={0.8}
                      onPress={() => handleSelectHelperSnippet("progress")}
                    >
                      <Text
                        style={[
                          styles.helperChipText,
                          { color: theme.textPrimary },
                        ]}
                      >
                        Progress update
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.helperChip}
                      activeOpacity={0.8}
                      onPress={() => handleSelectHelperSnippet("issue")}
                    >
                      <Text
                        style={[
                          styles.helperChipText,
                          { color: theme.textPrimary },
                        ]}
                      >
                        Issue / no power
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.helperChip}
                      activeOpacity={0.8}
                      onPress={() => handleSelectHelperSnippet("materials")}
                    >
                      <Text
                        style={[
                          styles.helperChipText,
                          { color: theme.textPrimary },
                        ]}
                      >
                        Materials needed
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Photo actions */}
                <View style={[styles.helperSectionRow, { marginTop: 8 }]}>
                  <Text
                    style={[
                      styles.helperSectionLabel,
                      { color: theme.textSecondary },
                    ]}
                  >
                    Photos
                  </Text>
                  <View style={styles.helperChipsRow}>
                    <TouchableOpacity
                      style={[
                        styles.helperChip,
                        { backgroundColor: theme.primaryButtonBackground },
                      ]}
                      activeOpacity={0.8}
                      onPress={handleTakePhoto}
                    >
                      <Text
                        style={[
                          styles.helperChipText,
                          { color: theme.primaryButtonText },
                        ]}
                      >
                        📷 Take photo
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.helperChip,
                        { backgroundColor: theme.primaryButtonBackground },
                      ]}
                      activeOpacity={0.8}
                      onPress={handlePickFromLibrary}
                    >
                      <Text
                        style={[
                          styles.helperChipText,
                          { color: theme.primaryButtonText },
                        ]}
                      >
                        🖼 From library
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {/* Input – IG-style bar */}
            <View
              style={[
                styles.inputContainer,
                {
                  borderColor: theme.cardBorder,
                  backgroundColor: theme.cardSecondaryBackground,
                },
              ]}
            >
              {/* Left icon (quick helpers for new hires) */}
              <TouchableOpacity
                style={styles.inputIconButton}
                activeOpacity={0.7}
                onPress={() => setIsHelperOpen((prev) => !prev)}
              >
                <Text
                  style={[
                    styles.inputIconText,
                    {
                      color: isHelperOpen ? theme.textPrimary : theme.textMuted,
                    },
                  ]}
                >
                  ＋
                </Text>
              </TouchableOpacity>

              {/* Text field */}
              <TextInput
                style={[
                  styles.chatInput,
                  {
                    color: theme.inputText,
                  },
                ]}
                value={chatDraft}
                onChangeText={setChatDraft}
                multiline
                placeholder="Type a quick progress update, issue, or materials request..."
                placeholderTextColor={theme.textMuted}
                onFocus={scrollToBottom}
              />

              {/* Small Review (AI) button */}
              <TouchableOpacity
                style={[
                  styles.inputAiButton,
                  {
                    backgroundColor: hasDraft
                      ? theme.primaryButtonBackground
                      : theme.cardBackground,
                    borderColor: hasDraft
                      ? "transparent"
                      : theme.cardBorder,
                    opacity: hasDraft ? 1 : 0.6,
                  },
                ]}
                activeOpacity={0.9}
                onPress={handleRunAiOnDraft}
                disabled={!hasDraft}
              >
                <Text
                  style={[
                    styles.inputAiButtonText,
                    {
                      color: hasDraft
                        ? theme.primaryButtonText
                        : theme.textMuted,
                    },
                  ]}
                >
                  Review
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingTop: 48,
    paddingHorizontal: 18,
    paddingBottom: 8, // tighter so chat hugs keyboard more
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  backButton: {
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  backText: {
    fontSize: 14,
  },
  headerTitleBlock: {
    alignItems: "center",
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  headerSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },

  chatCard: {
    flex: 1,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8, // reduced
  },
  chatCardHeader: {
    marginBottom: 8,
  },
  chatTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  chatSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },

  messagesScroll: {
    flex: 1,
    marginTop: 4,
    marginBottom: 8,
  },
  messagesContent: {
    paddingVertical: 4,
    paddingBottom: 4,
  },
  messageRow: {
    flexDirection: "row",
    marginBottom: 8,
    gap: 6,
  },
  avatarCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  avatarInitial: {
    fontSize: 11,
    fontWeight: "700",
  },
  messageBubble: {
    maxWidth: "78%",
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  messageHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
    justifyContent: "space-between",
    gap: 6,
  },
  messageAuthor: {
    fontSize: 11,
    fontWeight: "600",
  },
  messageText: {
    fontSize: 13,
    lineHeight: 18,
  },
  messageTime: {
    marginTop: 4,
    fontSize: 10,
    alignSelf: "flex-end",
  },

  messageImage: {
    width: 220,
    height: 140,
    borderRadius: 12,
    marginTop: 4,
    marginBottom: 4,
  },

  intentPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  intentPillText: {
    fontSize: 10,
    fontWeight: "600",
  },

  aiPreviewCard: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  aiPreviewHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  aiPreviewLabel: {
    fontSize: 11,
    fontWeight: "600",
  },
  aiPreviewText: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  aiPreviewButtonsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  aiSecondaryButton: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 7,
    alignItems: "center",
  },
  aiSecondaryButtonText: {
    fontSize: 13,
    fontWeight: "600",
  },
  aiPrimaryButton: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 8,
    alignItems: "center",
  },
  aiPrimaryButtonText: {
    fontSize: 13,
    fontWeight: "700",
  },
  aiPreviewCancel: {
    marginTop: 6,
    alignItems: "center",
  },
  aiPreviewCancelText: {
    fontSize: 11,
  },

  // Helper bar
  helperBar: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 6,
  },
  helperHeaderRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  helperLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  helperHint: {
    fontSize: 10,
  },
  helperSectionRow: {
    marginBottom: 2,
  },
  helperSectionLabel: {
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 4,
  },
  helperChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  helperChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "rgba(148,163,184,0.18)",
  },
  helperChipText: {
    fontSize: 11,
    fontWeight: "500",
  },

  // New IG-style input bar
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 4,
  },
  inputIconButton: {
    paddingHorizontal: 4,
    paddingVertical: 4,
    marginRight: 6,
  },
  inputIconText: {
    fontSize: 18,
    fontWeight: "600",
  },
  chatInput: {
    flex: 1,
    fontSize: 13,
    paddingHorizontal: 4,
    paddingVertical: 6,
    maxHeight: 96,
  },
  inputAiButton: {
    marginLeft: 8,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  inputAiButtonText: {
    fontSize: 12,
    fontWeight: "700",
  },

  // old reviewButton styles left unused (safe to delete later if you want)
  reviewButton: {
    marginTop: 8,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: "center",
  },
  reviewButtonText: {
    fontSize: 14,
    fontWeight: "700",
  },
});
