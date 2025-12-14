// app/trash.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { THEME_STORAGE_KEY, ThemeName, themes } from "../constants/appTheme";

type Job = {
  id: string;
  title: string;
  address: string;
  description: string;
  createdAt: string;
  isDone: boolean;
  clientName?: string;
  clientPhone?: string;
  clientNotes?: string;
  photoUris?: string[];
  laborHours?: number;
  hourlyRate?: number;
  materialCost?: number;
};

const STORAGE_KEYS = {
  JOBS: "EJT_JOBS",
  TRASH: "EJT_TRASH",
};

export default function TrashScreen() {
  // THEME
  const [themeName, setThemeName] = useState<ThemeName>("dark");
  const theme = themes[themeName] ?? themes.dark;

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (saved === "light" || saved === "dark" || saved === "midnight") {
          setThemeName(saved as ThemeName);
        }
      } catch (err) {
        console.warn("Failed to load theme in Trash:", err);
      }
    };

    loadTheme();
  }, []);

  const [jobs, setJobs] = useState<Job[]>([]);
  const [trashJobs, setTrashJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Small zoom-in animation (same style as other screens)
  const screenScale = useRef(new Animated.Value(1.04)).current;
  useEffect(() => {
    Animated.timing(screenScale, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [screenScale]);

  // Load jobs + trash whenever screen is focused
  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const loadData = async () => {
        try {
          const [jobsJson, trashJson] = await Promise.all([
            AsyncStorage.getItem(STORAGE_KEYS.JOBS),
            AsyncStorage.getItem(STORAGE_KEYS.TRASH),
          ]);

          if (!isActive) return;

          setJobs(jobsJson ? JSON.parse(jobsJson) : []);
          setTrashJobs(trashJson ? JSON.parse(trashJson) : []);
        } catch (err) {
          console.warn("Failed to load trash:", err);
        } finally {
          if (isActive) setIsLoading(false);
        }
      };

      loadData();

      return () => {
        isActive = false;
      };
    }, [])
  );

  const persist = async (nextJobs: Job[], nextTrash: Job[]) => {
    try {
      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEYS.JOBS, JSON.stringify(nextJobs)),
        AsyncStorage.setItem(STORAGE_KEYS.TRASH, JSON.stringify(nextTrash)),
      ]);
    } catch (err) {
      console.warn("Failed to persist jobs/trash:", err);
      throw err;
    }
  };

  const handleRestoreFromTrash = async (id: string) => {
    const job = trashJobs.find((j) => j.id === id);
    if (!job) return;

    const nextTrash = trashJobs.filter((j) => j.id !== id);
    const nextJobs = [...jobs, job];

    setJobs(nextJobs);
    setTrashJobs(nextTrash);
    try {
      await persist(nextJobs, nextTrash);
    } catch (e) {
      console.warn("Failed to restore job:", e);
    }
  };

  const handleDeleteForever = (id: string) => {
    const job = trashJobs.find((j) => j.id === id);
    if (!job) return;

    Alert.alert(
      "Delete permanently?",
      "This job will be permanently deleted and cannot be recovered.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const nextTrash = trashJobs.filter((j) => j.id !== id);
            setTrashJobs(nextTrash);
            try {
              await persist(jobs, nextTrash);
            } catch (e) {
              console.warn("Failed to delete forever:", e);
            }
          },
        },
      ]
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.screenBackground }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 20 : 0}
    >
      <Animated.View
        style={[
          styles.container,
          {
            backgroundColor: theme.screenBackground,
            transform: [{ scale: screenScale }],
            paddingBottom: 0,
          },
        ]}
      >
        {/* Main content + list */}
        <View style={{ flex: 1 }}>
          {/* Header (no Back button, just title) */}
          <View style={styles.headerRow}>
            <Text style={[styles.headerTitle, { color: theme.headerText }]}>
              Trash
            </Text>
            <View style={{ width: 60 }} />
          </View>

          {isLoading ? (
            <View style={styles.centerContent}>
              <Text style={[styles.loadingText, { color: theme.textPrimary }]}>
                Loading…
              </Text>
            </View>
          ) : trashJobs.length === 0 ? (
            <View style={styles.centerContent}>
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                Trash is empty.
              </Text>
            </View>
          ) : (
            <FlatList
              data={trashJobs}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[
                styles.listContent,
                { paddingBottom: 16 }, // ✅ FIX: runtime value must be inline
              ]}
              renderItem={({ item }) => (
                <View
                  style={[
                    styles.trashCard,
                    {
                      backgroundColor: theme.cardBackground,
                      borderColor: theme.cardBorder,
                    },
                  ]}
                >
                  <Text style={[styles.trashTitle, { color: theme.textPrimary }]}>
                    {item.title}
                  </Text>

                  <Text
                    style={[styles.trashAddress, { color: theme.textSecondary }]}
                  >
                    {item.address}
                  </Text>

                  {item.clientName && (
                    <Text
                      style={[styles.trashClient, { color: theme.textPrimary }]}
                    >
                      Client: {item.clientName}
                    </Text>
                  )}

                  <Text style={[styles.trashDate, { color: theme.textMuted }]}>
                    {new Date(item.createdAt).toLocaleString()}
                  </Text>

                  <View style={styles.statusAndButtonsRow}>
                    <View
                      style={[
                        styles.statusPill,
                        {
                          borderColor: item.isDone
                            ? theme.primaryButtonBackground
                            : theme.cardBorder,
                          backgroundColor: item.isDone
                            ? "rgba(34,197,94,0.09)"
                            : "transparent",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusPillText,
                          {
                            color: item.isDone
                              ? theme.primaryButtonBackground
                              : theme.textSecondary,
                          },
                        ]}
                      >
                        {item.isDone ? "Done" : "Open"}
                      </Text>
                    </View>

                    <View style={styles.trashButtonRow}>
                      <TouchableOpacity
                        style={[
                          styles.trashActionButton,
                          { borderColor: theme.primaryButtonBackground },
                        ]}
                        activeOpacity={0.9}
                        onPress={() => handleRestoreFromTrash(item.id)}
                      >
                        <Text
                          style={[
                            styles.trashRestoreText,
                            { color: theme.primaryButtonBackground },
                          ]}
                        >
                          Restore
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.trashActionButton,
                          { borderColor: theme.dangerBorder },
                        ]}
                        activeOpacity={0.9}
                        onPress={() => handleDeleteForever(item.id)}
                      >
                        <Text
                          style={[
                            styles.trashDeleteText,
                            { color: theme.dangerText },
                          ]}
                        >
                          Delete Forever
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}
            />
          )}
        </View>

        {/* PINNED NAV */}
       
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 48,
    paddingHorizontal: 18,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  backButton: {
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  backText: {
    fontSize: 14,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
  },
  centerContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    fontSize: 16,
  },
  emptyText: {
    fontSize: 14,
  },
  listContent: {
    // ✅ keep static styles only; safe-area padding is applied inline
  },
  trashCard: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  trashTitle: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 2,
  },
  trashAddress: {
    fontSize: 13,
    marginBottom: 2,
  },
  trashClient: {
    fontSize: 12,
    marginBottom: 2,
  },
  trashDate: {
    fontSize: 11,
    marginBottom: 8,
  },
  statusAndButtonsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: "600",
  },
  trashButtonRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  trashActionButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  trashRestoreText: {
    fontSize: 11,
    fontWeight: "600",
  },
  trashDeleteText: {
    fontSize: 11,
    fontWeight: "600",
  },
  navWrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
});
