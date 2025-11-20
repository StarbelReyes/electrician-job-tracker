// app/home.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import React, {
  FC,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { THEME_STORAGE_KEY, ThemeName, themes } from "./theme";

type Job = {
  id: string;
  title: string;
  address: string;
  description: string;
  createdAt: string; // ISO string
  isDone: boolean;
  clientName?: string;
  clientPhone?: string;
  clientNotes?: string;
  photoUris?: string[];
  laborHours?: number;
  hourlyRate?: number;
  materialCost?: number;
};

const initialJobs: Job[] = [
  {
    id: "1",
  title: "Panel Upgrade - 100A to 200A",
    address: "123 Main St, Brooklyn, NY",
    description: "Replace existing 100A panel with 200A, label circuits.",
    createdAt: "2025-11-10T10:00:00Z",
    isDone: false,
    clientName: "John Doe",
    clientPhone: "555-123-4567",
    clientNotes: "Owner works nights, schedule after 3 PM.",
    photoUris: [],
    laborHours: 0,
    hourlyRate: 0,
    materialCost: 0,
  },
  {
    id: "2",
    title: "Troubleshoot Lights Flickering",
    address: "456 5th Ave, Manhattan, NY",
    description: "Check loose neutrals, dimmers, shared circuits.",
    createdAt: "2025-11-12T14:30:00Z",
    isDone: false,
    clientName: "Restaurant Manager",
    clientPhone: "555-987-6543",
    clientNotes: "Busy during lunch, go before 11 AM.",
    photoUris: [],
    laborHours: 0,
    hourlyRate: 0,
    materialCost: 0,
  },
  {
    id: "3",
    title: "Install Tesla Wall Charger",
    address: "789 Ocean Pkwy, Brooklyn, NY",
    description: "Run dedicated circuit, mount charger, test load.",
    createdAt: "2025-11-13T09:15:00Z",
    isDone: false,
    clientName: "Maria Lopez",
    clientPhone: "555-222-3333",
    clientNotes: "Garage access via side gate.",
    photoUris: [],
    laborHours: 0,
    hourlyRate: 0,
    materialCost: 0,
  },
];

const sortOptions = ["Newest", "Oldest", "A-Z", "Z-A"] as const;
type SortOption = (typeof sortOptions)[number];

const STORAGE_KEYS = {
  JOBS: "EJT_JOBS",
  TRASH: "EJT_TRASH",
  SORT: "EJT_SORT_OPTION",
};

const HomeScreen: FC = () => {
  const router = useRouter();

  // THEME
  const [theme, setTheme] = useState(themes.dark);

  // Load theme whenever this screen is focused
  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const loadTheme = async () => {
        try {
          const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
          if (
            isActive &&
            (saved === "light" || saved === "dark" || saved === "midnight")
          ) {
            setTheme(themes[saved as ThemeName]);
          }
        } catch (err) {
          console.warn("Failed to load theme in Home:", err);
        }
      };

      loadTheme();

      return () => {
        isActive = false;
      };
    }, [])
  );

  // MAIN DATA (read from storage)
  const [jobs, setJobs] = useState<Job[]>(initialJobs);
  const [trashJobs, setTrashJobs] = useState<Job[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  // UI
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>("Newest");
  const [isSortMenuVisible, setIsSortMenuVisible] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "done">(
    "all"
  );

  // Small zoom-in animation for the screen
  const screenScale = useRef(new Animated.Value(1.04)).current;
  useEffect(() => {
    Animated.timing(screenScale, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [screenScale]);

  // Add job button animation
  const addJobScale = useRef(new Animated.Value(1)).current;
  const createScaleHandlers = (scale: Animated.Value) => ({
    onPressIn: () => {
      Animated.spring(scale, {
        toValue: 0.96,
        useNativeDriver: true,
        friction: 5,
        tension: 180,
      }).start();
    },
    onPressOut: () => {
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        friction: 5,
        tension: 180,
      }).start();
    },
  });
  const addJobAnim = createScaleHandlers(addJobScale);

  // -------- SORT + FILTER --------

  const handleSelectSort = (option: SortOption) => {
    setSortOption(option);
    setIsSortMenuVisible(false);
  };

  const visibleJobs = useMemo(() => {
    let data = [...jobs];

    if (statusFilter === "open") {
      data = data.filter((job) => !job.isDone);
    } else if (statusFilter === "done") {
      data = data.filter((job) => job.isDone);
    }

    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase();
      data = data.filter((job) => {
        const inText =
          job.title.toLowerCase().includes(q) ||
          job.address.toLowerCase().includes(q) ||
          job.description.toLowerCase().includes(q);
        const inClient =
          (job.clientName && job.clientName.toLowerCase().includes(q)) ||
          (job.clientPhone && job.clientPhone.toLowerCase().includes(q)) ||
          (job.clientNotes && job.clientNotes.toLowerCase().includes(q));
        return inText || inClient;
      });
    }

    data.sort((a, b) => {
      if (sortOption === "Newest") {
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      }
      if (sortOption === "Oldest") {
        return (
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      }
      if (sortOption === "A-Z") {
        return a.title.localeCompare(b.title);
      }
      if (sortOption === "Z-A") {
        return b.title.localeCompare(a.title);
      }
      return 0;
    });

    return data;
  }, [jobs, searchQuery, sortOption, statusFilter]);

  const totalJobs = jobs.length;
  const openJobs = jobs.filter((job) => !job.isDone).length;
  const doneJobs = totalJobs - openJobs;

  // -------- NAVIGATION --------

  const handleAddNewJobPress = () => {
    Keyboard.dismiss();
    router.push("/add-job");
  };

  // -------- ASYNC STORAGE LOAD --------

  useFocusEffect(
    useCallback(() => {
      const loadData = async () => {
        try {
          const [[, jobsJson], [, trashJson], [, sortJson]] =
            await AsyncStorage.multiGet([
              STORAGE_KEYS.JOBS,
              STORAGE_KEYS.TRASH,
              STORAGE_KEYS.SORT,
            ]);

          if (jobsJson) setJobs(JSON.parse(jobsJson));
          if (trashJson) setTrashJobs(JSON.parse(trashJson));
          if (sortJson && sortOptions.includes(sortJson as SortOption)) {
            setSortOption(sortJson as SortOption);
          }
        } catch (err) {
          console.warn("Failed to load saved jobs:", err);
        } finally {
          setIsHydrated(true);
        }
      };

      loadData();
    }, [])
  );

  // -------- ASYNC STORAGE SAVE (mainly for initial seed + sort) --------

  useEffect(() => {
    if (!isHydrated) return;

    const saveData = async () => {
      try {
        await AsyncStorage.multiSet([
          [STORAGE_KEYS.JOBS, JSON.stringify(jobs)],
          [STORAGE_KEYS.TRASH, JSON.stringify(trashJobs)],
          [STORAGE_KEYS.SORT, sortOption],
        ]);
      } catch (err) {
        console.warn("Failed to save jobs:", err);
      }
    };

    saveData();
  }, [jobs, trashJobs, sortOption, isHydrated]);

  // -------- RENDER --------

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.screenBackground }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 20 : 0}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <Animated.View
          style={[
            styles.container,
            {
              transform: [{ scale: screenScale }],
              backgroundColor: theme.screenBackground,
            },
          ]}
        >
          {/* HEADER */}
          <View style={styles.headerRow}>
            <Text
              style={[styles.header, { color: theme.headerText }]}
            >
              TRAKTR APP
            </Text>

            <View style={styles.headerActionsRow}>
              {/* Settings icon pill */}
              <TouchableOpacity
                style={[
                  styles.settingsButton,
                  {
                    backgroundColor: theme.cardBackground,
                    borderColor: theme.cardBorder,
                  },
                ]}
                onPress={() => router.push("/settings")}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="settings-outline"
                  size={18}
                  color={theme.textSecondary}
                />
              </TouchableOpacity>

              {/* Trash icon pill with badge – now navigates to /trash */}
              <TouchableOpacity
                style={[
                  styles.trashButton,
                  {
                    backgroundColor: theme.cardBackground,
                    borderColor: theme.cardBorder,
                  },
                ]}
                onPress={() => {
                  Keyboard.dismiss();
                  router.push("/trash");
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="trash-outline" size={18} color="#FCA5A5" />

                {trashJobs.length > 0 && (
                  <View
                    style={[
                      styles.trashBadge,
                      { backgroundColor: theme.badgeBackground },
                    ]}
                  >
                    <Text
                      style={[
                        styles.trashBadgeText,
                        { color: theme.badgeText },
                      ]}
                    >
                      {trashJobs.length}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* 📊 DASHBOARD SUMMARY */}
          <View style={styles.summaryRow}>
            {/* Open jobs card */}
            <TouchableOpacity
              style={[
                styles.summaryCard,
                {
                  backgroundColor: theme.summaryCardBackground,
                  borderColor: theme.summaryCardBorder,
                },
                statusFilter === "open" && styles.summaryCardActive,
              ]}
              activeOpacity={0.8}
              onPress={() =>
                setStatusFilter((prev) => (prev === "open" ? "all" : "open"))
              }
            >
              <Text
                style={[
                  styles.summaryLabel,
                  { color: theme.textMuted },
                ]}
              >
                Open Jobs
              </Text>
              <Text
                style={[
                  styles.summaryValue,
                  { color: theme.textPrimary },
                ]}
              >
                {openJobs}
              </Text>
            </TouchableOpacity>

            {/* Done jobs card */}
            <TouchableOpacity
              style={[
                styles.summaryCard,
                {
                  backgroundColor: theme.summaryCardBackground,
                  borderColor: theme.summaryCardBorder,
                },
                statusFilter === "done" && styles.summaryCardActive,
              ]}
              activeOpacity={0.8}
              onPress={() =>
                setStatusFilter((prev) => (prev === "done" ? "all" : "done"))
              }
            >
              <Text
                style={[
                  styles.summaryLabel,
                  { color: theme.textMuted },
                ]}
              >
                Done
              </Text>
              <Text
                style={[
                  styles.summaryValue,
                  { color: theme.textPrimary },
                ]}
              >
                {doneJobs}
              </Text>
            </TouchableOpacity>

            {/* Total jobs card */}
            <TouchableOpacity
              style={[
                styles.summaryCard,
                {
                  backgroundColor: theme.summaryCardBackground,
                  borderColor: theme.summaryCardBorder,
                },
                statusFilter === "all" && styles.summaryCardActive,
              ]}
              activeOpacity={0.8}
              onPress={() => setStatusFilter("all")}
            >
              <Text
                style={[
                  styles.summaryLabel,
                  { color: theme.textMuted },
                ]}
              >
                Total Jobs
              </Text>
              <Text
                style={[
                  styles.summaryValue,
                  { color: theme.textPrimary },
                ]}
              >
                {totalJobs}
              </Text>
            </TouchableOpacity>
          </View>

          {/* SEARCH + SORT */}
          <View style={styles.controlsRow}>
            <View style={styles.searchContainer}>
              <TextInput
                style={[
                  styles.searchInput,
                  {
                    backgroundColor: theme.inputBackground,
                    color: theme.inputText,
                    borderColor: theme.inputBorder,
                    borderWidth: 1,
                  },
                ]}
                placeholder="Search jobs or clients..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholderTextColor={theme.textMuted}
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
              />
            </View>

            <View style={styles.sortContainer}>
              <TouchableOpacity
                style={[
                  styles.sortButton,
                  {
                    backgroundColor: theme.cardBackground,
                    borderColor: theme.cardBorder,
                    borderWidth: 1,
                  },
                ]}
                onPress={() => {
                  setIsSortMenuVisible((prev) => !prev);
                  Keyboard.dismiss();
                }}
                activeOpacity={0.9}
              >
                <Text
                  style={[
                    styles.sortLabel,
                    { color: theme.textMuted },
                  ]}
                >
                  Sort by:
                </Text>
                <Text
                  style={[
                    styles.sortValue,
                    { color: theme.textPrimary },
                  ]}
                >
                  {sortOption}
                </Text>
              </TouchableOpacity>

              {isSortMenuVisible && (
                <View
                  style={[
                    styles.sortDropdown,
                    {
                      backgroundColor: theme.cardBackground,
                      borderColor: theme.cardBorder,
                      borderWidth: 1,
                    },
                  ]}
                >
                  {sortOptions.map((option) => (
                    <TouchableOpacity
                      key={option}
                      style={styles.sortOption}
                      onPress={() => handleSelectSort(option)}
                    >
                      <Text
                        style={[
                          styles.sortOptionText,
                          { color: theme.textPrimary },
                          option === sortOption && styles.sortOptionTextActive,
                        ]}
                      >
                        {option}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </View>

          {/* ADD NEW JOB BUTTON */}
          <Animated.View style={{ transform: [{ scale: addJobScale }] }}>
            <TouchableOpacity
              style={[
                styles.addJobButton,
                { backgroundColor: theme.primaryButtonBackground },
              ]}
              onPress={handleAddNewJobPress}
              activeOpacity={0.9}
              onPressIn={addJobAnim.onPressIn}
              onPressOut={addJobAnim.onPressOut}
            >
              <Text
                style={[
                  styles.addJobButtonText,
                  { color: theme.primaryButtonText },
                ]}
              >
                Add New Job
              </Text>
            </TouchableOpacity>
          </Animated.View>

          {/* JOB LIST */}
          <FlatList
            data={visibleJobs}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const laborTotal =
                (item.laborHours || 0) * (item.hourlyRate || 0);
              const jobTotal = laborTotal + (item.materialCost || 0);

              const statusStyles = item.isDone
                ? {
                    tagBg: theme.tagDoneBg,
                    tagBorder: theme.tagDoneBorder,
                    tagText: theme.tagDoneText,
                    titleColor: theme.tagDoneText,
                    textColor: theme.textMuted,
                  }
                : {
                    tagBg: theme.tagOpenBg,
                    tagBorder: theme.tagOpenBorder,
                    tagText: theme.tagOpenText,
                    titleColor: theme.textPrimary,
                    textColor: theme.textSecondary,
                  };

              return (
                <Pressable
                  onPress={() => {
                    const totalForJob = jobTotal;
                    router.push({
                      pathname: "/job-detail",
                      params: {
                        id: item.id,
                        title: item.title,
                        address: item.address,
                        description: item.description,
                        clientName: item.clientName ?? "",
                        clientPhone: item.clientPhone ?? "",
                        clientNotes: item.clientNotes ?? "",
                        createdAt: item.createdAt,
                        isDone: String(item.isDone),
                        jobTotal: String(totalForJob),
                        photoCount: String(item.photoUris?.length ?? 0),
                        laborHours: String(item.laborHours ?? 0),
                        hourlyRate: String(item.hourlyRate ?? 0),
                        materialCost: String(item.materialCost ?? 0),
                      },
                    });
                  }}
                  style={({ pressed }) => [
                    styles.jobCard,
                    {
                      backgroundColor: theme.cardBackground,
                    },
                    item.isDone && {
                      borderWidth: 1,
                      borderColor: theme.tagDoneBorder,
                    },
                    { transform: [{ scale: pressed ? 0.97 : 1 }] },
                  ]}
                >
                  <View style={styles.jobCardHeaderRow}>
                    <Text
                      style={[
                        styles.jobTitle,
                        { color: statusStyles.titleColor },
                        item.isDone && styles.jobTitleDone,
                      ]}
                    >
                      {item.title}
                    </Text>

                    <View
                      style={[
                        styles.statusTag,
                        {
                          backgroundColor: statusStyles.tagBg,
                          borderColor: statusStyles.tagBorder,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusTagText,
                          { color: statusStyles.tagText },
                        ]}
                      >
                        {item.isDone ? "Done" : "Open"}
                      </Text>
                    </View>
                  </View>

                  {item.clientName && (
                    <Text
                      style={[
                        styles.jobClient,
                        { color: statusStyles.textColor },
                        item.isDone && styles.jobTextDone,
                      ]}
                    >
                      Client: {item.clientName}
                    </Text>
                  )}

                  <Text
                    style={[
                      styles.jobAddress,
                      { color: statusStyles.textColor },
                      item.isDone && styles.jobTextDone,
                    ]}
                  >
                    {item.address}
                  </Text>

                  {!!(item.photoUris && item.photoUris.length > 0) && (
                    <Text
                      style={[
                        styles.jobPhotoCount,
                        { color: statusStyles.textColor },
                        item.isDone && styles.jobTextDone,
                      ]}
                    >
                      📷 {item.photoUris!.length}{" "}
                      {item.photoUris!.length === 1 ? "photo" : "photos"}
                    </Text>
                  )}

                  {jobTotal > 0 && (
                    <Text
                      style={[
                        styles.jobAmount,
                        { color: "#FCD34D" },
                        item.isDone && styles.jobTextDone,
                      ]}
                    >
                      💵 Total: ${jobTotal.toFixed(2)}
                    </Text>
                  )}

                  <Text
                    style={[
                      styles.jobDate,
                      { color: theme.textMuted },
                      item.isDone && styles.jobTextDone,
                    ]}
                  >
                    {new Date(item.createdAt).toLocaleString()}
                  </Text>
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <Text
                style={[
                  styles.emptyText,
                  { color: theme.textMuted },
                ]}
              >
                No jobs match your search.
              </Text>
            }
          />
        </Animated.View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

export default HomeScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 48,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  header: {
    fontSize: 18,
    fontWeight: "700",
  },
  headerActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  settingsButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginRight: 4,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  trashButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  trashBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    borderRadius: 999,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: "#020617",
  },
  trashBadgeText: {
    fontSize: 9,
    fontWeight: "700",
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  searchContainer: {
    flex: 1,
  },
  searchInput: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  sortContainer: {
    marginLeft: 4,
  },
  sortButton: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  sortLabel: {
    fontSize: 10,
  },
  sortValue: {
    fontSize: 13,
    fontWeight: "600",
  },
  sortDropdown: {
    marginTop: 4,
    borderRadius: 8,
    paddingVertical: 4,
    minWidth: 110,
  },
  sortOption: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sortOptionText: {
    fontSize: 13,
  },
  sortOptionTextActive: {
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  addJobButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 8,
  },
  addJobButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  listContent: {
    paddingVertical: 12,
    paddingBottom: 40,
  },
  jobCard: {
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  jobCardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  jobTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  jobTitleDone: {
    textDecorationLine: "line-through",
  },
  jobClient: {
    fontSize: 12,
    marginBottom: 2,
  },
  jobAddress: {
    fontSize: 13,
    marginBottom: 2,
  },
  jobPhotoCount: {
    fontSize: 12,
    marginBottom: 2,
  },
  jobAmount: {
    fontSize: 12,
    marginBottom: 2,
  },
  jobDate: {
    fontSize: 11,
  },
  jobTextDone: {
    textDecorationLine: "line-through",
  },
  statusTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusTagText: {
    fontSize: 11,
    fontWeight: "600",
  },
  emptyText: {
    marginTop: 24,
    textAlign: "center",
  },
  summaryRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
  },
  summaryCardActive: {
    borderColor: "#2563EB",
  },
  summaryLabel: {
    fontSize: 11,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: "700",
  },
});
