// app/trash.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { THEME_STORAGE_KEY, ThemeName, themes } from "./theme";

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
  const router = useRouter();

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
    await Promise.all([
      AsyncStorage.setItem(STORAGE_KEYS.JOBS, JSON.stringify(nextJobs)),
      AsyncStorage.setItem(STORAGE_KEYS.TRASH, JSON.stringify(nextTrash)),
    ]);
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
      "Delete Permanently",
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
      <View
        style={[
          styles.container,
          { backgroundColor: theme.screenBackground },
        ]}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            activeOpacity={0.8}
          >
            <Text
              style={[styles.backText, { color: theme.headerMuted }]}
            >
              ← Back
            </Text>
          </TouchableOpacity>
          <Text
            style={[
              styles.headerTitle,
              { color: theme.headerText },
            ]}
          >
            Trash
          </Text>
          <View style={{ width: 60 }} />
        </View>

        {isLoading ? (
          <View style={styles.centerContent}>
            <Text
              style={[styles.loadingText, { color: theme.textPrimary }]}
            >
              Loading…
            </Text>
          </View>
        ) : trashJobs.length === 0 ? (
          <View style={styles.centerContent}>
            <Text
              style={[styles.emptyText, { color: theme.textMuted }]}
            >
              Trash is empty.
            </Text>
          </View>
        ) : (
          <FlatList
            data={trashJobs}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: 20 }}
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
                <Text
                  style={[
                    styles.trashTitle,
                    { color: theme.textPrimary },
                  ]}
                >
                  {item.title}
                </Text>
                <Text
                  style={[
                    styles.trashAddress,
                    { color: theme.textSecondary },
                  ]}
                >
                  {item.address}
                </Text>
                {item.clientName && (
                  <Text
                    style={[
                      styles.trashClient,
                      { color: theme.textPrimary },
                    ]}
                  >
                    Client: {item.clientName}
                  </Text>
                )}
                <Text
                  style={[
                    styles.trashDate,
                    { color: theme.textMuted },
                  ]}
                >
                  {new Date(item.createdAt).toLocaleString()}
                </Text>

                <View style={styles.trashButtonRow}>
                  <TouchableOpacity
                    style={[
                      styles.trashActionButton,
                      {
                        borderColor: theme.primaryButtonBackground,
                      },
                    ]}
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
            )}
          />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 56,
    paddingHorizontal: 16,
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
  headerTitle: {
    fontSize: 18,
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
  trashCard: {
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
  },
  trashTitle: {
    fontSize: 14,
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
    marginBottom: 6,
  },
  trashButtonRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  trashActionButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
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
});
