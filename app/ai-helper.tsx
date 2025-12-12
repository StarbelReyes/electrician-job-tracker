// app/ai-helper.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { API_BASE_URL } from "../constants/api";
import {
  THEME_STORAGE_KEY,
  ThemeName,
  themes,
} from "../constants/appTheme";

const IS_PRO_USER = true;
const QA_HISTORY_KEY = "EJT_AI_HISTORY";

type QAItem = {
  id: string;
  question: string;
  answer: string;
  createdAt: number;
};

type Session = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  items: QAItem[];
};

export default function AiHelperScreen() {
  const router = useRouter();

  const [themeName, setThemeName] = useState<ThemeName>("dark");
  const theme = themes[themeName] ?? themes.dark;

  const [question, setQuestion] = useState("");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // which session is the “current chat” in the big card
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // modal for past pills (whole session)
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);

  const activeSession = activeSessionId
    ? sessions.find((s) => s.id === activeSessionId) ?? null
    : null;

  const pillsScrollRef = useRef<ScrollView | null>(null);

  // Load theme + saved history once (support old format -> new format)
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
          const parsed = JSON.parse(savedHistory);

          if (Array.isArray(parsed) && parsed.length > 0) {
            // New format: Session[]
            if (parsed[0].items) {
              const asSessions = parsed as Session[];
              setSessions(asSessions);
              setActiveSessionId(asSessions[asSessions.length - 1].id);
            }
            // Old format: QAItem[]
            else if (parsed[0].question && parsed[0].answer) {
              const oldItems = parsed as QAItem[];
              const converted: Session[] = oldItems.map((qa) => {
                const created =
                  typeof qa.createdAt === "number" ? qa.createdAt : Date.now();
                return {
                  id: `session-${qa.id}`,
                  title: qa.question,
                  createdAt: created,
                  updatedAt: created,
                  items: [qa],
                };
              });
              setSessions(converted);
              if (converted.length > 0) {
                setActiveSessionId(converted[converted.length - 1].id);
              }
            }
          }
        }
      } catch (err) {
        console.warn("Failed to load Ask Traktr AI data:", err);
      }
    };
    load();
  }, []);

  // Save sessions whenever they change
  useEffect(() => {
    const save = async () => {
      try {
        if (sessions.length === 0) {
          await AsyncStorage.removeItem(QA_HISTORY_KEY);
        } else {
          await AsyncStorage.setItem(QA_HISTORY_KEY, JSON.stringify(sessions));
        }
      } catch (err) {
        console.warn("Failed to save Ask Traktr sessions:", err);
      }
    };
    save();
  }, [sessions]);

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

      const url = `${API_BASE_URL}/ai-assistant`;
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

      const now = Date.now();
      const qaItem: QAItem = {
        id: `qa-${now}`,
        question: trimmed,
        answer,
        createdAt: now,
      };

      setSessions((prev) => {
        // If we already have an active session, append to that session
        if (activeSessionId) {
          return prev.map((session) => {
            if (session.id !== activeSessionId) return session;
            return {
              ...session,
              items: [...session.items, qaItem],
              updatedAt: now,
            };
          });
        }

        // No active session -> create a brand new session
        const newSessionId = `session-${now}`;
        const newSession: Session = {
          id: newSessionId,
          title: trimmed,
          createdAt: now,
          updatedAt: now,
          items: [qaItem],
        };

        setActiveSessionId(newSessionId);
        return [...prev, newSession];
      });

      setQuestion("");
      Keyboard.dismiss();

      setTimeout(() => {
        if (pillsScrollRef.current) {
          pillsScrollRef.current.scrollToEnd({ animated: true });
        }
      }, 80);
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

  // Delete a whole session (chat)
  const handleDeleteSession = (sessionId: string) => {
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== sessionId);
      if (activeSessionId === sessionId) {
        if (next.length > 0) {
          setActiveSessionId(next[next.length - 1].id);
        } else {
          setActiveSessionId(null);
        }
      }
      if (selectedSession && selectedSession.id === sessionId) {
        setSelectedSession(null);
      }
      return next;
    });
  };

  // Clear all sessions
  const handleClearAllHistory = () => {
    if (sessions.length === 0) return;

    Alert.alert(
      "Clear all history?",
      "This will remove all saved Ask Traktr AI chats.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear all",
          style: "destructive",
          onPress: () => {
            setSessions([]);
            setActiveSessionId(null);
            setSelectedSession(null);
          },
        },
      ]
    );
  };

  // “New chat” – keep sessions, just reset current chat area
  const handleNewChat = () => {
    setActiveSessionId(null);
    setSelectedSession(null);
    setQuestion("");
  };

  const isAiDisabled = !IS_PRO_USER;
  const hasQuestion = question.trim().length > 0;

  const pillsData = sessions.slice();

  return (
    <View style={{ flex: 1, backgroundColor: theme.screenBackground }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 18 : 0}
      >
        <View style={styles.screen}>
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
                style={[
                  styles.headerSubtitle,
                  { color: theme.headerMuted },
                ]}
              >
                {/* CHANGED: more general */}
                Private AI workspace · Not posted to Team Chat
              </Text>
            </View>

            <View style={{ width: 60 }} />
          </View>

          {/* Assistant pill */}
          <View
            style={[
              styles.tagRow,
              styles.shadowSoft,
              {
                backgroundColor: theme.cardSecondaryBackground,
                borderColor: theme.cardBorder,
              },
            ]}
          >
            <Text style={[styles.tagText, { color: theme.textSecondary }]}>
              {/* CHANGED: more general */}
              AI assistant · For your jobs & ideas
            </Text>
          </View>

          {/* CHAT AREA */}
          <View
            style={[
              styles.chatShell,
              styles.shadowSoft,
              {
                backgroundColor: theme.cardBackground,
                borderColor: theme.cardBorder,
              },
            ]}
          >
            {/* Helper example text */}
            <Text
              style={[
                styles.exampleText,
                { color: theme.textMuted },
              ]}
            >
              {/* CHANGED: shorter + not strictly electrical */}
              Example: “Help me break down this job, materials, and next steps.”
            </Text>

            {/* 🔹 Scrollable content above the input */}
            <ScrollView
              style={styles.chatScroll}
              contentContainerStyle={styles.chatScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Current session card OR empty state */}
              {activeSession && activeSession.items.length > 0 ? (
                <View
                  style={[
                    styles.qaCard,
                    styles.cardGlass,
                    {
                      backgroundColor: theme.cardSecondaryBackground,
                      borderColor: theme.cardBorder,
                    },
                  ]}
                >
                  {activeSession.items.map((item) => (
                    <View key={item.id} style={{ marginBottom: 10 }}>
                      {/* You bubble */}
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
                            styles.bubbleShadow,
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
                            styles.bubbleShadow,
                            { backgroundColor: theme.cardBackground },
                          ]}
                        >
                          <Text
                            style={[
                              styles.qaAnswer,
                              { color: theme.textPrimary },
                            ]}
                          >
                            {item.answer}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ))}

                  {/* Footer row uses last item for time + copy */}
                  {(() => {
                    const last =
                      activeSession.items[activeSession.items.length - 1];
                    return (
                      <View style={styles.qaFooterRow}>
                        <Text
                          style={[
                            styles.qaTime,
                            { color: theme.textMuted },
                          ]}
                        >
                          {new Date(last.createdAt).toLocaleTimeString([], {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </Text>

                        <View style={styles.qaFooterButtons}>
                          <TouchableOpacity
                            style={[
                              styles.deleteButton,
                              {
                                borderColor: theme.cardBorder,
                                backgroundColor: theme.cardBackground,
                              },
                            ]}
                            activeOpacity={0.8}
                            onPress={() => handleDeleteSession(activeSession.id)}
                          >
                            <Text
                              style={[
                                styles.deleteButtonText,
                                { color: theme.textMuted },
                              ]}
                            >
                              Delete chat
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[
                              styles.copyButton,
                              { backgroundColor: theme.primaryButtonBackground },
                            ]}
                            activeOpacity={0.8}
                            onPress={() => handleCopyAnswer(last.answer)}
                          >
                            <Text
                              style={[
                                styles.copyButtonText,
                                { color: theme.primaryButtonText },
                              ]}
                            >
                              Use last answer
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })()}
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <Text
                    style={[
                      styles.emptyTitle,
                      { color: theme.textSecondary },
                    ]}
                  >
                    Start a new chat
                  </Text>
                  <Text
                    style={[
                      styles.emptySubtitle,
                      { color: theme.textMuted },
                    ]}
                  >
                    Ask about jobs, planning, troubleshooting, or have Traktr AI
                    clean up a message for you.
                  </Text>
                </View>
              )}

              {/* subtle divider */}
              <View
                style={[
                  styles.sectionDivider,
                  { borderBottomColor: theme.cardBorder },
                ]}
              />

              {/* History header row: New chat + Clear all */}
              <View style={styles.historyHeaderRow}>
                <Text
                  style={[
                    styles.historyTitle,
                    { color: theme.textSecondary },
                  ]}
                >
                  Past chats
                </Text>

                <View style={styles.historyActionsRow}>
                  <TouchableOpacity
                    onPress={handleNewChat}
                    activeOpacity={0.8}
                    style={[
                      styles.newChatPill,
                      styles.pillShadow,
                      {
                        borderColor: theme.cardBorder,
                        backgroundColor: theme.cardSecondaryBackground,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.newChatText,
                        { color: theme.textSecondary },
                      ]}
                    >
                      + New chat
                    </Text>
                  </TouchableOpacity>

                  {sessions.length > 0 && (
                    <TouchableOpacity
                      onPress={handleClearAllHistory}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.clearAllText,
                          { color: theme.textMuted },
                        ]}
                      >
                        Clear all
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* History pills */}
              {sessions.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.pillsContainer}
                  ref={pillsScrollRef}
                >
                  {pillsData.map((session, index) => {
                    const labelIndex = index + 1;
                    const isActive = session.id === activeSessionId;
                    return (
                      <TouchableOpacity
                        key={session.id}
                        style={[
                          styles.historyPill,
                          styles.pillShadow,
                          {
                            borderColor: isActive
                              ? theme.primaryButtonBackground
                              : theme.cardBorder,
                            backgroundColor: theme.cardSecondaryBackground,
                            opacity: isActive ? 1 : 0.9,
                          },
                        ]}
                        activeOpacity={0.9}
                        onPress={() => {
                          setActiveSessionId(session.id);
                          setSelectedSession(session);
                        }}
                      >
                        <Text
                          style={[
                            styles.historyPillLabel,
                            {
                              color: isActive
                                ? theme.primaryButtonBackground
                                : theme.textSecondary,
                            },
                          ]}
                          numberOfLines={1}
                        >
                          #{labelIndex}
                        </Text>
                        <Text
                          style={[
                            styles.historyPillText,
                            { color: theme.textPrimary },
                          ]}
                          numberOfLines={1}
                        >
                          {session.title}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              ) : (
                <Text
                  style={[
                    styles.noHistoryText,
                    { color: theme.textMuted },
                  ]}
                >
                  No saved chats yet.
                </Text>
              )}
            </ScrollView>

            {/* INPUT BAR – pinned at bottom, above keyboard */}
            <View
              style={[
                styles.inputBar,
                styles.shadowSoft,
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
                // CHANGED: shorter, more modern placeholder
                placeholder="Ask anything or paste a rough note..."
                placeholderTextColor={theme.textMuted}
                multiline
                textAlignVertical="top"
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
        </View>
      </KeyboardAvoidingView>

      {/* Modal for full session from history pill */}
      <Modal
        visible={!!selectedSession}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedSession(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCardWrapper}>
            <View style={styles.modalHandle} />
            <View style={styles.modalCardInner}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Saved chat</Text>
                <TouchableOpacity
                  onPress={() => setSelectedSession(null)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.modalCloseText}>Close</Text>
                </TouchableOpacity>
              </View>

              {selectedSession && (
                <>
                  <ScrollView
                    style={styles.modalScroll}
                    contentContainerStyle={{ paddingBottom: 12 }}
                    showsVerticalScrollIndicator={true}
                  >
                    {selectedSession.items.map((item) => (
                      <View key={item.id} style={{ marginBottom: 10 }}>
                        <Text style={styles.modalLabel}>You</Text>
                        <Text style={styles.modalQuestion}>
                          {item.question}
                        </Text>

                        <Text style={styles.modalLabel}>Traktr AI</Text>
                        <Text style={styles.modalAnswer}>
                          {item.answer}
                        </Text>
                      </View>
                    ))}
                  </ScrollView>

                  <View style={styles.modalFooterRow}>
                    <TouchableOpacity
                      style={styles.modalDeleteButton}
                      activeOpacity={0.8}
                      onPress={() => {
                        handleDeleteSession(selectedSession.id);
                      }}
                    >
                      <Text style={styles.modalDeleteText}>Delete chat</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.modalCopyButton}
                      activeOpacity={0.8}
                      onPress={() => {
                        const last =
                          selectedSession.items[
                            selectedSession.items.length - 1
                          ];
                        handleCopyAnswer(last.answer);
                      }}
                    >
                      <Text style={styles.modalCopyText}>Use last answer</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
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
    paddingHorizontal: 16,
    paddingVertical: 6,
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
    borderRadius: 24,
    borderWidth: 1,
    paddingTop: 10,
    paddingHorizontal: 10,
    paddingBottom: 10,
  },

  exampleText: {
    fontSize: 10,
    marginHorizontal: 4,
    marginBottom: 6,
  },

  chatScroll: {
    flex: 1,
  },
  chatScrollContent: {
    paddingBottom: 8,
  },

  qaCard: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginBottom: 10,
  },

  cardGlass: {
    borderWidth: 1,
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
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: "flex-end",
    maxWidth: "80%",
    backgroundColor: "#0f172a",
  },
  bubbleAi: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: "flex-start",
    maxWidth: "100%",
  },
  bubbleShadow: {
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  qaQuestion: {
    fontSize: 13,
    lineHeight: 18,
  },
  qaAnswer: {
    fontSize: 13,
    lineHeight: 18,
  },
  qaFooterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
  },
  qaTime: {
    fontSize: 10,
  },
  qaFooterButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  deleteButton: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  deleteButtonText: {
    fontSize: 11,
    fontWeight: "500",
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

  emptyState: {
    paddingVertical: 24,
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

  sectionDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginTop: 6,
    marginBottom: 6,
    opacity: 0.7,
  },

  historyHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginHorizontal: 4,
    marginTop: 4,
    marginBottom: 4,
  },
  historyTitle: {
    fontSize: 11,
    fontWeight: "600",
  },
  historyActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  newChatPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  newChatText: {
    fontSize: 11,
    fontWeight: "600",
  },

  clearAllText: {
    fontSize: 11,
    textDecorationLine: "underline",
  },

  pillsContainer: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  historyPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8,
    maxWidth: 220,
  },
  historyPillLabel: {
    fontSize: 10,
    fontWeight: "600",
    marginBottom: 2,
  },
  historyPillText: {
    fontSize: 11,
  },
  noHistoryText: {
    fontSize: 11,
    marginHorizontal: 6,
    marginBottom: 6,
  },

  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 8,
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

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.85)",
    justifyContent: "flex-end",
  },
  modalCardWrapper: {
    width: "100%",
    paddingHorizontal: 10,
    paddingBottom: 22,
  },
  modalHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: "rgba(148, 163, 184, 0.8)",
    marginBottom: 10,
  },
  modalCardInner: {
    width: "100%",
    maxHeight: "80%",
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: "#020617",
    borderColor: "rgba(148,163,184,0.6)",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -4 },
    elevation: 16,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#e5e7eb",
  },
  modalCloseText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#f59e0b",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#f59e0b",
  },
  modalScroll: {
    marginTop: 4,
    marginBottom: 8,
  },
  modalLabel: {
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 2,
    color: "#9ca3af",
  },
  modalQuestion: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
    color: "#e5e7eb",
  },
  modalAnswer: {
    fontSize: 13,
    lineHeight: 18,
    color: "#e5e7eb",
  },
  modalFooterRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
  },
  modalDeleteButton: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderColor: "rgba(148,163,184,0.6)",
  },
  modalDeleteText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#9ca3af",
  },
  modalCopyButton: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: "#f59e0b",
  },
  modalCopyText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#111827",
  },

  // shared shadows
  shadowSoft: {
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  pillShadow: {
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
});
