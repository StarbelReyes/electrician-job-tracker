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
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import BottomNavBar from "../components/BottomNavBar";
import {
  // 🔽 added these three
  ACCENT_STORAGE_KEY,
  AccentName,
  getAccentColor,
  THEME_STORAGE_KEY,
  ThemeName,
  themes,
} from "../constants/appTheme";

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

type Theme = (typeof themes)["dark"];

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

// Keep in sync with BottomNavBar height-ish
const NAV_HEIGHT = 72;

// ---------------- HELPERS ----------------

const getJobTotal = (job: Job) => {
  const laborTotal = (job.laborHours || 0) * (job.hourlyRate || 0);
  return laborTotal + (job.materialCost || 0);
};

type StatusStyles = {
  tagBg: string;
  tagBorder: string;
  tagText: string;
  titleColor: string;
  textColor: string;
};

const getStatusStyles = (job: Job, theme: Theme): StatusStyles =>
  job.isDone
    ? {
        tagBg: theme.tagDoneBg,
        tagBorder: theme.tagDoneBorder,
        tagText: theme.tagDoneText,
        titleColor: theme.textPrimary,
        textColor: theme.textSecondary,
      }
    : {
        tagBg: theme.tagOpenBg,
        tagBorder: theme.tagOpenBorder,
        tagText: theme.tagOpenText,
        titleColor: theme.textPrimary,
        textColor: theme.textSecondary,
      };

// ---------------- JOB ROW ----------------

type JobRowProps = {
  job: Job;
  theme: Theme;
  onOpen: (job: Job) => void;
  onShare: (job: Job) => void;
  onDelete: (id: string) => void;
};

const JobRow: FC<JobRowProps> = React.memo(
  ({ job, theme, onOpen, onShare, onDelete }) => {
    const jobTotal = getJobTotal(job);
    const statusStyles = getStatusStyles(job, theme);

    const totalString =
      jobTotal > 0
        ? jobTotal.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        : null;

    const renderRightActions = () => (
      <View style={styles.swipeActionsContainer}>
        <TouchableOpacity
          style={[styles.swipeActionButton, styles.swipeShareButton]}
          onPress={() => onShare(job)}
        >
          <Ionicons name="share-outline" size={18} color="#E5E7EB" />
          <Text style={styles.swipeActionText}>Share</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.swipeActionButton, styles.swipeDeleteButton]}
          onPress={() => onDelete(job.id)}
        >
          <Ionicons name="trash-outline" size={18} color="#FEE2E2" />
          <Text style={styles.swipeActionText}>Delete</Text>
        </TouchableOpacity>
      </View>
    );

    return (
      <Swipeable renderRightActions={renderRightActions}>
        <Pressable
          onPress={() => onOpen(job)}
          style={({ pressed }) => [
            styles.jobCard,
            {
              backgroundColor: theme.cardBackground + "F2", // soft glass layer
              transform: [{ scale: pressed ? 0.97 : 1 }],
              borderColor: theme.cardBorder + "55",
            },
            job.isDone && {
              borderColor: theme.tagDoneBorder,
              borderWidth: 1,
              opacity: 0.9,
            },
          ]}
        >
          {/* Header */}
          <View style={styles.jobCardHeaderRow}>
            <Text
              style={[
                styles.jobTitle,
                { color: statusStyles.titleColor },
              ]}
            >
              {job.title}
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
                {job.isDone ? "Done" : "Open"}
              </Text>
            </View>
          </View>

          {/* Client */}
          {job.clientName && (
            <Text
              style={[
                styles.jobClient,
                { color: statusStyles.textColor },
                job.isDone && styles.jobTextDone,
              ]}
            >
              Client: {job.clientName}
            </Text>
          )}

          {/* Address */}
          <Text
            style={[
              styles.jobAddress,
              { color: statusStyles.textColor },
              job.isDone && styles.jobTextDone,
            ]}
          >
            {job.address}
          </Text>

          {/* Photos */}
          {!!(job.photoUris && job.photoUris.length > 0) && (
            <Text
              style={[
                styles.jobPhotoCount,
                { color: statusStyles.textColor },
                job.isDone && styles.jobTextDone,
              ]}
            >
              📷 {job.photoUris.length}{" "}
              {job.photoUris.length === 1 ? "photo" : "photos"}
            </Text>
          )}

          {/* Total */}
          {totalString && (
            <Text
              style={[
                styles.jobAmount,
                { color: "#FCD34D" },
                job.isDone && styles.jobTextDone,
              ]}
            >
              💵 Total: ${totalString}
            </Text>
          )}

          {/* Created At */}
          <Text
            style={[
              styles.jobDate,
              { color: theme.textMuted },
              job.isDone && styles.jobTextDone,
            ]}
          >
            {new Date(job.createdAt).toLocaleString()}
          </Text>
        </Pressable>
      </Swipeable>
    );
  }
);

// ---------------- HOME SCREEN ----------------

const HomeScreen: FC = () => {
  const router = useRouter();

  const [theme, setTheme] = useState<Theme>(themes.dark);

  // Accent shared with settings
  const [accentName, setAccentName] = useState<AccentName>("jobsiteAmber");
  const accentColor = getAccentColor(accentName);

  // Track when we're editing (typing) so we can hide nav like settings
  const [isEditing, setIsEditing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      const loadThemeAndAccent = async () => {
        try {
          const [savedTheme, savedAccent] = await Promise.all([
            AsyncStorage.getItem(THEME_STORAGE_KEY),
            AsyncStorage.getItem(ACCENT_STORAGE_KEY),
          ]);

          if (
            isActive &&
            (savedTheme === "light" ||
              savedTheme === "dark" ||
              savedTheme === "midnight")
          ) {
            setTheme(themes[savedTheme as ThemeName]);
          }

        // ✅ Accept ANY valid AccentName ("jobsiteAmber", "electricBlue", "safetyGreen")
if (
  isActive &&
  savedAccent &&
  (savedAccent === "jobsiteAmber" ||
    savedAccent === "electricBlue" ||
    savedAccent === "safetyGreen")
) {
  setAccentName(savedAccent as AccentName);
}

        } catch (err) {
          console.warn("Failed to load theme/accent in Home:", err);
        }
      };
      loadThemeAndAccent();
      return () => {
        isActive = false;
      };
    }, [])
  );

  const [jobs, setJobs] = useState<Job[]>(initialJobs);
  const [trashJobs, setTrashJobs] = useState<Job[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>("Newest");
  const [isSortMenuVisible, setIsSortMenuVisible] = useState(false);

  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "done">(
    "open"
  );

  useFocusEffect(
    useCallback(() => {
      setStatusFilter("open");
    }, [])
  );

  const screenScale = useRef(new Animated.Value(1.04)).current;
  useEffect(() => {
    Animated.timing(screenScale, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleSelectSort = useCallback((option: SortOption) => {
    setSortOption(option);
    setIsSortMenuVisible(false);
  }, []);

  const visibleJobs = useMemo(() => {
    let data = [...jobs];

    if (statusFilter === "open") data = data.filter((j) => !j.isDone);
    if (statusFilter === "done") data = data.filter((j) => j.isDone);

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

  const { totalJobs, openJobs, doneJobs } = useMemo(() => {
    const total = jobs.length;
    const open = jobs.filter((j) => !j.isDone).length;
    return { totalJobs: total, openJobs: open, doneJobs: total - open };
  }, [jobs]);

  const handleOpenJob = useCallback(
    (job: Job) => {
      const jobTotal = getJobTotal(job);
      router.push({
        pathname: "/job-detail",
        params: {
          id: job.id,
          title: job.title,
          address: job.address,
          description: job.description,
          clientName: job.clientName ?? "",
          clientPhone: job.clientPhone ?? "",
          clientNotes: job.clientNotes ?? "",
          createdAt: job.createdAt,
          isDone: String(job.isDone),
          jobTotal: String(jobTotal),
          photoCount: String(job.photoUris?.length ?? 0),
          laborHours: String(job.laborHours ?? 0),
          hourlyRate: String(job.hourlyRate ?? 0),
          materialCost: String(job.materialCost ?? 0),
        },
      });
    },
    [router]
  );

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

  const handleShareJob = useCallback(async (job: Job) => {
    const jobTotal = getJobTotal(job);
    const totalString =
      jobTotal > 0
        ? `$${jobTotal.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`
        : "Not set";

    const message = [
      `Job: ${job.title}`,
      job.clientName ? `Client: ${job.clientName}` : "",
      `Address: ${job.address}`,
      "",
      "Scope:",
      job.description,
      "",
      `Total (estimate): ${totalString}`,
      job.photoUris && job.photoUris.length > 0
        ? `Photos: ${job.photoUris.length}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    const firstPhoto = job.photoUris?.[0];

    try {
      if (firstPhoto) {
        await Share.share({ message, url: firstPhoto });
      } else {
        await Share.share({ message });
      }
    } catch (err) {
      console.warn("Failed to share job:", err);
    }
  }, []);

  const handleDeleteJob = useCallback((id: string) => {
    setJobs((prev) => {
      const jobToTrash = prev.find((j) => j.id === id);
      if (!jobToTrash) return prev;

      setTrashJobs((t) => [jobToTrash, ...t]);
      return prev.filter((j) => j.id !== id);
    });
  }, []);

  const renderJobItem = useCallback(
    ({ item }: { item: Job }) => (
      <JobRow
        job={item}
        theme={theme}
        onOpen={handleOpenJob}
        onShare={handleShareJob}
        onDelete={handleDeleteJob}
      />
    ),
    [theme, handleOpenJob, handleShareJob, handleDeleteJob]
  );

  const dismissKeyboardAndEditing = () => {
    Keyboard.dismiss();
    setIsEditing(false);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.screenBackground }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <TouchableWithoutFeedback
        onPress={dismissKeyboardAndEditing}
        accessible={false}
      >
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
            <Text style={[styles.header, { color: theme.headerText }]}>
              THE TRAKTR APP
            </Text>
          </View>

          {/* Ask Traktr AI CTA */}
          <View style={styles.aiHelperRow}>
            <TouchableOpacity
              activeOpacity={0.9}
              style={[
                styles.aiHelperButton,
                {
                  backgroundColor: accentColor,
                },
              ]}
              onPress={() => router.push("/ai-helper")}
            >
              <Ionicons name="sparkles-outline" size={16} color="#F9FAFB" />
              <Text style={styles.aiHelperText}>Ask Traktr AI</Text>
            </TouchableOpacity>
          </View>

          {/* SUMMARY */}
          <View style={styles.summaryRow}>
            {/* OPEN */}
            <TouchableOpacity
              style={[
                styles.summaryCard,
                {
                  backgroundColor: theme.summaryCardBackground + "F2",
                  borderColor: theme.summaryCardBorder,
                },
                statusFilter === "open" && styles.summaryCardActive,
                statusFilter === "open" && { borderColor: accentColor },
              ]}
              onPress={() =>
                setStatusFilter((prev) => (prev === "open" ? "all" : "open"))
              }
            >
              <Text style={[styles.summaryLabel, { color: theme.textMuted }]}>
                Open
              </Text>
              <Text
                style={[styles.summaryValue, { color: theme.textPrimary }]}
              >
                {openJobs}
              </Text>
            </TouchableOpacity>

            {/* DONE */}
            <TouchableOpacity
              style={[
                styles.summaryCard,
                {
                  backgroundColor: theme.summaryCardBackground + "F2",
                  borderColor: theme.summaryCardBorder,
                },
                statusFilter === "done" && styles.summaryCardActive,
                statusFilter === "done" && { borderColor: accentColor },
              ]}
              onPress={() =>
                setStatusFilter((prev) => (prev === "done" ? "all" : "done"))
              }
            >
              <Text style={[styles.summaryLabel, { color: theme.textMuted }]}>
                Done
              </Text>
              <Text
                style={[styles.summaryValue, { color: theme.textPrimary }]}
              >
                {doneJobs}
              </Text>
            </TouchableOpacity>

            {/* TOTAL */}
            <TouchableOpacity
              style={[
                styles.summaryCard,
                {
                  backgroundColor: theme.summaryCardBackground + "F2",
                  borderColor: theme.summaryCardBorder,
                },
                statusFilter === "all" && styles.summaryCardActive,
                statusFilter === "all" && { borderColor: accentColor },
              ]}
              onPress={() => setStatusFilter("all")}
            >
              <Text style={[styles.summaryLabel, { color: theme.textMuted }]}>
                Total
              </Text>
              <Text
                style={[styles.summaryValue, { color: theme.textPrimary }]}
              >
                {totalJobs}
              </Text>
            </TouchableOpacity>
          </View>

          {/* SEARCH + SORT */}
          <View style={styles.controlsRow}>
            {/* SEARCH */}
            <View style={styles.searchContainer}>
              <TextInput
                style={[
                  styles.searchInput,
                  {
                    backgroundColor: theme.inputBackground + "F2",
                    color: theme.inputText,
                    borderColor: theme.inputBorder,
                  },
                ]}
                placeholder="Search jobs or clients..."
                placeholderTextColor={theme.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="done"
                onFocus={() => setIsEditing(true)}
                onBlur={() => setIsEditing(false)}
              />
            </View>

            {/* SORT */}
            <View style={styles.sortContainer}>
              <TouchableOpacity
                style={[
                  styles.sortButton,
                  {
                    backgroundColor: theme.cardBackground + "F2",
                    borderColor: theme.cardBorder,
                  },
                  isSortMenuVisible && { borderColor: accentColor },
                ]}
                onPress={() =>
                  setIsSortMenuVisible((prev) => !prev)
                }
              >
                <Text style={[styles.sortLabel, { color: theme.textMuted }]}>
                  Sort
                </Text>
                <Text style={[styles.sortValue, { color: theme.textPrimary }]}>
                  {sortOption}
                </Text>
              </TouchableOpacity>

              {isSortMenuVisible && (
                <View
                  style={[
                    styles.sortDropdown,
                    {
                      backgroundColor: theme.cardBackground + "F2",
                      borderColor: theme.cardBorder,
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
                          option === sortOption && { color: accentColor },
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

          {/* JOB LIST */}
          <FlatList
            data={visibleJobs}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[
              styles.listContent,
              {
                paddingBottom: isEditing ? 8 : NAV_HEIGHT + 24,
              },
            ]}
            renderItem={renderJobItem}
            keyboardShouldPersistTaps="always"
            ListEmptyComponent={
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                No jobs found.
              </Text>
            }
          />

          {/* NAV – hide while typing like settings */}
          {!isEditing && <BottomNavBar active="home" theme={theme} />}
        </Animated.View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

export default HomeScreen;

// ---------------- STYLES ----------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 48,
  },

  // HEADER
  headerRow: {
    marginBottom: 8,
  },
  header: {
    fontSize: 22,
    fontWeight: "700",
  },

  // Ask Traktr AI CTA
  aiHelperRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
    marginBottom: 10,
  },
  aiHelperButton: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 6,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  aiHelperText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#F9FAFB",
  },

  // SUMMARY
  summaryRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  summaryCardActive: {
    borderColor: "#2563EB", // overridden by accentColor in inline style
  },
  summaryLabel: {
    fontSize: 12,
    marginBottom: 6,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: "700",
  },

  // CONTROLS
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  searchContainer: {
    flex: 1,
  },
  searchInput: {
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    borderWidth: 1,
  },

  sortContainer: {
    justifyContent: "center",
  },
  sortButton: {
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  sortLabel: {
    fontSize: 11,
  },
  sortValue: {
    fontSize: 13,
    fontWeight: "600",
  },
  sortDropdown: {
    marginTop: 6,
    borderRadius: 14,
    paddingVertical: 6,
    minWidth: 120,
    borderWidth: 1,
  },
  sortOption: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  sortOptionText: {
    fontSize: 14,
  },
  sortOptionTextActive: {
    fontWeight: "700",
  },

  // LIST
  listContent: {
    paddingBottom: 110,
  },

  // JOB CARD
  jobCard: {
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  jobCardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  jobTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  jobClient: {
    fontSize: 13,
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
    marginTop: 4,
  },
  jobTextDone: {
    textDecorationLine: "line-through",
    opacity: 0.6,
  },

  statusTag: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusTagText: {
    fontSize: 11,
    fontWeight: "600",
  },

  emptyText: {
    textAlign: "center",
    fontSize: 14,
    marginTop: 24,
  },

  // SWIPE
  swipeActionsContainer: {
    flexDirection: "row",
    marginBottom: 14,
  },
  swipeActionButton: {
    width: 72,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 10,
  },
  swipeShareButton: {
    backgroundColor: "#4B5563",
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
  },
  swipeDeleteButton: {
    backgroundColor: "#DC2626",
    borderTopRightRadius: 14,
    borderBottomRightRadius: 14,
  },
  swipeActionText: {
    fontSize: 11,
    marginTop: 4,
    color: "#F9FAFB",
    fontWeight: "600",
  },
});
