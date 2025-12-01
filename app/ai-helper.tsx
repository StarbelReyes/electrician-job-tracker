// app/ai-helper.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Animated,
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
import {
    THEME_STORAGE_KEY,
    ThemeName,
    themes,
} from "../constants/appTheme";

// same tunnel base as Team Chat, different endpoint
const AI_ASSISTANT_BASE_URL =
  "https://milky-kaycee-overrestraint.ngrok-free.dev";

const IS_PRO_USER = true;
const QA_HISTORY_KEY = "EJT_AI_HISTORY";

type QAItem = {
  id: string;
  question: string;
  answer: string;
  createdAt: number;
};

export default function AiHelperScreen() {
  const router = useRouter();

  const [themeName, setThemeName] = useState<ThemeName>("dark");
  const theme = themes[themeName] ?? themes.dark;

  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<QAItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const screenScale = useRef(new Animated.Value(1.04)).current;
  const scrollRef = useRef<ScrollView | null>(null);

  // Load theme + saved history once
  useEffect(() => {
    const load = async () => {
      try {
        const [savedTheme, savedHistory] = await Promise.all([
          AsyncStorage.getItem(THEME_STORAGE_KEY),
          AsyncStorage.getItem(QA_HISTORY_KEY),
        ]);

        if (
          savedTheme === "light" ||
          savedTheme === "dark" ||
          savedTheme === "midnight"
        ) {
          setThemeName(savedTheme as ThemeName);
        }

        if (savedHistory) {
          const parsed: QAItem[] = JSON.parse(savedHistory);
          setHistory(parsed);
        }
      } catch (err) {
        console.warn("Failed to load Ask Traktr AI data:", err);
      }
    };
    load();
  }, []);

  // Save history whenever it changes
  useEffect(() => {
    const save = async () => {
      try {
        if (history.length === 0) {
          await AsyncStorage.removeItem(QA_HISTORY_KEY);
        } else {
          await AsyncStorage.setItem(QA_HISTORY_KEY, JSON.stringify(history));
        }
      } catch (err) {
        console.warn("Failed to save Ask Traktr history:", err);
      }
    };
    save();
  }, [history]);

  // Entrance animation
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

  // After new QA added, scroll a bit down
  useEffect(() => {
    if (!history.length) return;
    const t = setTimeout(scrollToBottom, 80);
    return () => clearTimeout(t);
  }, [history.length]);

  const handleAskAi = async () => {
    if (!IS_PRO_USER) {
      Alert.alert(
        "Ask Traktr AI disabled",
        "AI is currently disabled. Upgrade to Pro later to use Ask Traktr AI."
      );
      return;
    }

    const trimmed = question.trim();
    if (!trimmed) {
      Alert.alert("Empty question", "Type a question before asking Traktr AI.");
      return;
    }

    try {
      setIsLoading(true);

      const url = `${AI_ASSISTANT_BASE_URL}/ai-assistant`;
      console.log("Ask Traktr AI URL:", url);

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: trimmed,
          electricianType: "field-electrician",
          jobContext: "",
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.warn("Ask Traktr AI HTTP error:", res.status, text);
        Alert.alert(
          "AI not available",
          "There was a problem talking to Traktr AI. Try again in a moment."
        );
        return;
      }

      const data: any = await res.json();
      if (!data || !data.ok || !data.answerText) {
        console.warn("Bad /ai-assistant payload:", data);
        Alert.alert(
          "AI error",
          "Traktr AI gave an unexpected response. Try again."
        );
        return;
      }

      const answer = String(data.answerText).trim();
      if (!answer) {
        Alert.alert(
          "AI error",
          "Traktr AI returned an empty answer. Try again."
        );
        return;
      }

      const item: QAItem = {
        id: `qa-${Date.now()}`,
        question: trimmed,
        answer,
        createdAt: Date.now(),
      };

      setHistory((prev) => [...prev, item]);
      setQuestion(""); // clear like ChatGPT
      Keyboard.dismiss();
    } catch (err: any) {
      console.error("Ask Traktr AI request failed:", err);
      Alert.alert(
        "Network error",
        "Could not reach Traktr AI. Check your connection or tunnel."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyAnswer = async (answer: string) => {
    try {
      await Clipboard.setStringAsync(answer);
      Alert.alert(
        "Copied",
        "Answer copied. You can paste it into Team Chat or a client message."
      );
    } catch (err) {
      console.warn("Clipboard error:", err);
      Alert.alert("Copy error", "Could not copy the answer to clipboard.");
    }
  };

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const isAiDisabled = !IS_PRO_USER;
  const hasQuestion = question.trim().length > 0;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.screenBackground }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 18 : 0}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
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
                Ask Traktr AI
              </Text>
              <Text
                style={[styles.headerSubtitle, { color: theme.headerMuted }]}
              >
                Private electrician Q&A · Not posted to Team Chat
              </Text>
            </View>

            <View style={{ width: 60 }} />
          </View>

          {/* ChatGPT-style assistant pill */}
          <View
            style={[
              styles.tagRow,
              {
                backgroundColor: theme.cardSecondaryBackground,
                borderColor: theme.cardBorder,
              },
            ]}
          >
            <Text style={[styles.tagText, { color: theme.textSecondary }]}>
              Electrician assistant · Safety-first
            </Text>
          </View>

          {/* MAIN CHAT AREA */}
          <View
            style={[
              styles.chatShell,
              {
                backgroundColor: theme.cardBackground,
                borderColor: theme.cardBorder,
              },
            ]}
          >
            {/* Top helper example text */}
            <Text
              style={[
                styles.exampleText,
                { color: theme.textMuted },
              ]}
            >
              Example: “I have no power at a bedroom receptacle, breaker is on,
              and tester shows 120V at the panel. What should I check next?”
            </Text>

            {/* Conversation list */}
            <ScrollView
              ref={scrollRef}
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {history.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text
                    style={[
                      styles.emptyTitle,
                      { color: theme.textSecondary },
                    ]}
                  >
                    Start a conversation
                  </Text>
                  <Text
                    style={[
                      styles.emptySubtitle,
                      { color: theme.textMuted },
                    ]}
                  >
                    Ask about wiring, troubleshooting “no power”, materials, or
                    have Traktr AI draft a message for you.
                  </Text>
                </View>
              ) : (
                history.map((item) => {
                  const isExpanded = expanded[item.id];
                  const answerPreviewLimit = 6; // number of lines to show

                  const lines = item.answer.split("\n");
                  const showToggle = lines.length > answerPreviewLimit;
                  const displayedAnswer = isExpanded
                    ? item.answer
                    : lines.slice(0, answerPreviewLimit).join("\n");

                  return (
                    <View
                      key={item.id}
                      style={[
                        styles.qaCard,
                        {
                          backgroundColor: theme.cardSecondaryBackground,
                          borderColor: theme.cardBorder,
                        },
                      ]}
                    >
                      {/* User bubble */}
                      <View style={styles.userBlock}>
                        <Text
                          style={[
                            styles.qaLabel,
                            { color: theme.textSecondary },
                          ]}
                        >
                          You
                        </Text>
                        <View
                          style={[
                            styles.bubbleUser,
                            { backgroundColor: "#0f172a" },
                          ]}
                        >
                          <Text
                            style={[
                              styles.qaQuestion,
                              { color: theme.textPrimary },
                            ]}
                          >
                            {item.question}
                          </Text>
                        </View>
                      </View>

                      {/* AI bubble */}
                      <View style={styles.aiBlock}>
                        <Text
                          style={[
                            styles.qaLabel,
                            { color: theme.textSecondary },
                          ]}
                        >
                          Traktr AI
                        </Text>
                        <View
                          style={[
                            styles.bubbleAi,
                            { backgroundColor: theme.cardBackground },
                          ]}
                        >
                          <Text
                            style={[
                              styles.qaAnswer,
                              { color: theme.textPrimary },
                            ]}
                          >
                            {displayedAnswer}
                          </Text>

                          {showToggle && (
                            <TouchableOpacity
                              style={styles.showMoreButton}
                              onPress={() => toggleExpanded(item.id)}
                              activeOpacity={0.8}
                            >
                              <Text
                                style={[
                                  styles.showMoreText,
                                  { color: theme.textSecondary },
                                ]}
                              >
                                {isExpanded ? "Show less" : "Show more"}
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>

                      {/* Footer row */}
                      <View style={styles.qaFooterRow}>
                        <Text
                          style={[
                            styles.qaTime,
                            { color: theme.textMuted },
                          ]}
                        >
                          {new Date(item.createdAt).toLocaleTimeString([], {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </Text>

                        <TouchableOpacity
                          style={[
                            styles.copyButton,
                            { backgroundColor: theme.primaryButtonBackground },
                          ]}
                          activeOpacity={0.8}
                          onPress={() => handleCopyAnswer(item.answer)}
                        >
                          <Text
                            style={[
                              styles.copyButtonText,
                              { color: theme.primaryButtonText },
                            ]}
                          >
                            Use in message
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>

            {/* INPUT BAR – ChatGPT style */}
            <View
              style={[
                styles.inputBar,
                {
                  borderColor: theme.cardBorder,
                  backgroundColor: theme.cardSecondaryBackground,
                },
              ]}
            >
              <TextInput
                style={[
                  styles.inputField,
                  {
                    color: theme.inputText,
                  },
                ]}
                value={question}
                onChangeText={setQuestion}
                placeholder="Ask anything about wiring, troubleshooting, or drafting a message..."
                placeholderTextColor={theme.textMuted}
                multiline
                textAlignVertical="top"
                onFocus={() => {
                  setTimeout(scrollToBottom, 80);
                }}
              />
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  {
                    backgroundColor:
                      isAiDisabled || !hasQuestion
                        ? theme.cardBackground
                        : theme.primaryButtonBackground,
                    borderColor:
                      isAiDisabled || !hasQuestion
                        ? theme.cardBorder
                        : "transparent",
                    opacity:
                      isAiDisabled || !hasQuestion || isLoading ? 0.6 : 1,
                  },
                ]}
                disabled={isAiDisabled || !hasQuestion || isLoading}
                onPress={handleAskAi}
                activeOpacity={0.9}
              >
                {isLoading ? (
                  <ActivityIndicator
                    size="small"
                    color={
                      isAiDisabled || !hasQuestion
                        ? theme.textMuted
                        : theme.primaryButtonText
                    }
                  />
                ) : (
                  <Text
                    style={[
                      styles.sendButtonText,
                      {
                        color:
                          isAiDisabled || !hasQuestion
                            ? theme.textMuted
                            : theme.primaryButtonText,
                      },
                    ]}
                  >
                    Ask AI
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingTop: 48,
    paddingHorizontal: 18,
    paddingBottom: 8,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
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

  tagRow: {
    alignSelf: "center",
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 10,
  },
  tagText: {
    fontSize: 11,
    fontWeight: "500",
  },

  chatShell: {
    flex: 1,
    borderRadius: 22,
    borderWidth: 1,
    paddingTop: 10,
    paddingHorizontal: 10,
    paddingBottom: 8,
  },

  exampleText: {
    fontSize: 10,
    marginHorizontal: 4,
    marginBottom: 6,
  },

  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 12,
  },

  emptyState: {
    paddingVertical: 32,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12,
    textAlign: "center",
  },

  qaCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
  },

  qaLabel: {
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 2,
  },

  userBlock: {
    marginBottom: 6,
  },
  aiBlock: {
    marginBottom: 6,
  },

  bubbleUser: {
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: "flex-end",
    maxWidth: "80%",
  },
  bubbleAi: {
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: "flex-start",
    maxWidth: "100%",
  },

  qaQuestion: {
    fontSize: 13,
    lineHeight: 18,
  },
  qaAnswer: {
    fontSize: 13,
    lineHeight: 18,
  },

  showMoreButton: {
    marginTop: 4,
  },
  showMoreText: {
    fontSize: 11,
    fontWeight: "600",
  },

  qaFooterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  qaTime: {
    fontSize: 10,
  },
  copyButton: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  copyButtonText: {
    fontSize: 11,
    fontWeight: "600",
  },

  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 4,
  },
  inputField: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 6,
    paddingRight: 8,
    maxHeight: 90,
  },
  sendButton: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonText: {
    fontSize: 13,
    fontWeight: "700",
  },
});
