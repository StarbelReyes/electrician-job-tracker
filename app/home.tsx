// app/home.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";

import React, { FC, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  NativeScrollEvent,
  NativeSyntheticEvent,
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
import { themes } from "../constants/appTheme";
import { usePreferences } from "../context/PreferencesContext";
import { db } from "../firebaseConfig";

const USER_STORAGE_KEY = "EJT_USER_SESSION";

type Role = "owner" | "employee" | "independent";

type Session = {
  uid?: string;
  email?: string | null;
  name?: string;
  role?: Role;
  companyId?: string | null;
};

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

  // ✅ assignment model (ARRAY ONLY)
assignedToUids?: string[];

// ✅ legacy support (older jobs)
assignedToUid?: string | null;


  // ✅ required for owner reads under your rules
  ownerUid?: string;
  createdByUid?: string;
};

type Theme = (typeof themes)["dark"];

const sortOptions = ["Newest", "Oldest", "A-Z", "Z-A"] as const;
type SortOption = (typeof sortOptions)[number];

const STORAGE_KEYS = {
  JOBS: "EJT_JOBS",
  TRASH: "EJT_TRASH",
  SORT: "EJT_SORT_OPTION",
};

// Focused carousel sizing
const CARD_HEIGHT = 210;
const CARD_SPACING = 18;
const CARD_OUTER_HEIGHT = CARD_HEIGHT + CARD_SPACING;

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

const getStatusStyles = (job: Job, theme: Theme, brand: string): StatusStyles =>
  job.isDone
    ? {
        tagBg: theme.tagDoneBg,
        tagBorder: theme.tagDoneBorder,
        tagText: theme.tagDoneText,
        titleColor: theme.textPrimary,
        textColor: theme.textSecondary,
      }
    : {
        tagBg: brand + "1A",
        tagBorder: brand,
        tagText: brand,
        titleColor: theme.textPrimary,
        textColor: theme.textSecondary,
      };

// Best-effort createdAt normalization (string or Firestore Timestamp-like)
const normalizeCreatedAt = (value: any): string => {
  if (!value) return new Date().toISOString();
  if (typeof value === "string") return value;

  if (typeof value?.toDate === "function") {
    try {
      return value.toDate().toISOString();
    } catch {
      return new Date().toISOString();
    }
  }

  if (typeof value === "number") {
    try {
      return new Date(value).toISOString();
    } catch {
      return new Date().toISOString();
    }
  }

  return new Date().toISOString();
};

// ------------- MEDIA HEADER COMPONENT -------------

type JobCardMediaHeaderProps = {
  job: Job;
  theme: Theme;
  brand: string;
};

const JobCardMediaHeader: FC<JobCardMediaHeaderProps> = ({ job, theme, brand }) => {
  const hasPhoto = !!(job.photoUris && job.photoUris.length > 0);
  const firstPhotoUri = job.photoUris?.[0];

  const statusColor = job.isDone ? theme.textMuted : brand;

  return (
    <View style={styles.mediaHeaderWrapper}>
      {hasPhoto && firstPhotoUri ? (
        <View style={[styles.mediaHeader, { backgroundColor: theme.cardSecondaryBackground }]}>
          <Image source={{ uri: firstPhotoUri }} style={styles.mediaHeaderImage} resizeMode="cover" />
          <View style={[styles.mediaHeaderOverlay, { backgroundColor: theme.screenBackground + "66" }]} />
        </View>
      ) : (
        <LinearGradient
          style={[
            styles.mediaHeader,
            {
              borderWidth: 1,
              borderColor: brand + "40",
              backgroundColor: "transparent",
            },
          ]}
          colors={[brand + "30", brand + "12", theme.cardBackground]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      )}

      <View style={[styles.mediaStatusBar, { backgroundColor: statusColor }]} />
    </View>
  );
};

// ---------------- FOCUSED JOB CARD ----------------

type FocusJobCardProps = {
  job: Job;
  theme: Theme;
  brand: string;
  index: number;
  animatedIndex: Animated.AnimatedDivision<number>;
  onOpen: (job: Job) => void;
};

const FocusJobCard: FC<FocusJobCardProps> = ({
  job,
  theme,
  brand,
  index,
  animatedIndex,
  onOpen,
}) => {
  const statusStyles = getStatusStyles(job, theme, brand);
  const jobTotal = getJobTotal(job);
  const hasPhotos = !!(job.photoUris && job.photoUris.length > 0);
  const hasTotal = jobTotal > 0;

  const scale = animatedIndex.interpolate({
    inputRange: [index - 1, index, index + 1],
    outputRange: [0.94, 1, 0.94],
    extrapolate: "clamp",
  });

  const translateY = animatedIndex.interpolate({
    inputRange: [index - 1, index, index + 1],
    outputRange: [12, 0, 12],
    extrapolate: "clamp",
  });

  const shadowOpacity = animatedIndex.interpolate({
    inputRange: [index - 1, index, index + 1],
    outputRange: [0.03, 0.1, 0.03],
    extrapolate: "clamp",
  });

  const totalString =
    hasTotal
      ? jobTotal.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : null;

  return (
    <Animated.View
      style={[
        styles.focusCardOuter,
        {
          shadowOpacity,
          transform: [{ scale }, { translateY }],
        },
      ]}
    >
      <Pressable
        onPress={() => onOpen(job)}
        style={({ pressed }) => [
          styles.focusCardInner,
          {
            backgroundColor: theme.cardBackground,
            borderColor: theme.cardBorder + "55",
            transform: [{ scale: pressed ? 0.97 : 1 }],
          },
        ]}
      >
        <View style={styles.focusCardContent}>
          <JobCardMediaHeader job={job} theme={theme} brand={brand} />

          <Text
            style={[
              styles.focusTitle,
              { color: statusStyles.titleColor },
              job.isDone && styles.focusTextDone,
            ]}
            numberOfLines={2}
          >
            {job.title}
          </Text>

          {job.clientName ? (
            <>
              <Text
                style={[
                  styles.focusClient,
                  { color: statusStyles.textColor },
                  job.isDone && styles.focusTextDone,
                ]}
                numberOfLines={1}
              >
                {job.clientName}
              </Text>
              <Text
                style={[
                  styles.focusAddress,
                  { color: statusStyles.textColor },
                  job.isDone && styles.focusTextDone,
                ]}
                numberOfLines={1}
              >
                {job.address}
              </Text>
            </>
          ) : (
            <Text
              style={[
                styles.focusAddress,
                { color: statusStyles.textColor },
                job.isDone && styles.focusTextDone,
              ]}
              numberOfLines={2}
            >
              {job.address}
            </Text>
          )}

          <View style={styles.focusMetaRow}>
            <View
              style={[
                styles.focusStatusPill,
                {
                  backgroundColor: statusStyles.tagBg,
                  borderColor: statusStyles.tagBorder,
                },
              ]}
            >
              <Text style={[styles.focusStatusText, { color: statusStyles.tagText }]}>
                {job.isDone ? "Done" : "Open"}
              </Text>
            </View>

            {hasPhotos && (
              <View
                style={[
                  styles.focusPhotoChip,
                  { backgroundColor: theme.cardSecondaryBackground + "AA" },
                ]}
              >
                <Ionicons name="camera-outline" size={14} color={theme.textMuted} />
                <Text style={[styles.focusPhotoChipText, { color: theme.textMuted }]}>
                  {job.photoUris!.length}
                </Text>
              </View>
            )}

            {hasTotal && totalString && (
              <Text style={[styles.focusAmountClean, { color: brand }]}>${totalString}</Text>
            )}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
};

// ---------------- HOME SCREEN ----------------

const HomeScreen: FC = () => {
  const router = useRouter();

  const { isReady, theme, accentColor } = usePreferences();
  const brand = accentColor;

  const [session, setSession] = useState<Session | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);

  const isEmployee = session?.role === "employee";
  const isOwner = session?.role === "owner";
  const isCloudMode = isEmployee || isOwner;
  const isIndependent = session?.role === "independent" || !session?.role;

  const goToWorkTicketsInbox = useCallback(() => {
    router.push("/work-tickets");
  }, [router]);

  const [isEditing, setIsEditing] = useState(false);

  const [jobs, setJobs] = useState<Job[]>([]);
  const [trashJobs, setTrashJobs] = useState<Job[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  const screenScale = useRef(new Animated.Value(1.04)).current;
  useEffect(() => {
    Animated.timing(screenScale, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [screenScale]);

  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>("Newest");
  const [isSortMenuVisible, setIsSortMenuVisible] = useState(false);

  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "done">("open");

  useFocusEffect(
    useCallback(() => {
      setStatusFilter("open");
    }, [])
  );

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
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortOption === "Oldest") {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      if (sortOption === "A-Z") return a.title.localeCompare(b.title);
      if (sortOption === "Z-A") return b.title.localeCompare(a.title);
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
          setIsHydrated(false);

          const storedSession = await AsyncStorage.getItem(USER_STORAGE_KEY);
          let parsed: Session | null = null;
          if (storedSession) {
            try {
              parsed = JSON.parse(storedSession);
            } catch {
              parsed = null;
            }
          }
          setSession(parsed);
          setSessionChecked(true);

          console.warn("SESSION CHECK:", {
            uid: parsed?.uid,
            role: parsed?.role,
            companyId: parsed?.companyId,
          });

          // --- EMPLOYEE MODE ---
          if (parsed?.role === "employee") {
            if (!parsed.companyId) {
              setJobs([]);
              setTrashJobs([]);
              setIsHydrated(true);
              router.replace("/join-company" as any);
              return;
            }
            if (!parsed.uid) {
              setJobs([]);
              setTrashJobs([]);
              setIsHydrated(true);
              router.replace("/login" as any);
              return;
            }

            // Keep your existing user-doc guard (fine)
            let liveCompanyId = parsed.companyId ?? null;
            try {
              const uref = doc(db, "users", parsed.uid);
              const usnap = await getDoc(uref);
              const ud: any = usnap.exists() ? usnap.data() : null;

              const hasName = !!String(ud?.name ?? "").trim();
              const hasPhoto = !!String(ud?.photoUrl ?? "").trim();

              if (ud?.companyId) liveCompanyId = String(ud.companyId);

              if (!liveCompanyId) {
                setJobs([]);
                setTrashJobs([]);
                setIsHydrated(true);
                router.replace("/join-company" as any);
                return;
              }

              if (liveCompanyId !== parsed.companyId) {
                const nextSession = { ...parsed, companyId: liveCompanyId };
                await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(nextSession));
                setSession(nextSession);
              }

              if (!hasName || !hasPhoto) {
                setJobs([]);
                setTrashJobs([]);
                setIsHydrated(true);
                router.replace("/profile-setup" as any);
                return;
              }
            } catch (err) {
              console.warn("Profile guard/rehydrate failed:", err);
              setJobs([]);
              setTrashJobs([]);
              setIsHydrated(true);
              return;
            }

            const jobsRef = collection(db, "companies", liveCompanyId, "jobs");
            const employeeUid = parsed.uid;
            
            // ✅ NEW schema
            const qNew = query(jobsRef, where("assignedToUids", "array-contains", employeeUid));
            
            // ✅ LEGACY schema
            const qLegacy = query(jobsRef, where("assignedToUid", "==", employeeUid));
            
            try {
              const [snapNew, snapLegacy] = await Promise.all([
                getDocs(qNew).catch((e) => {
                  console.warn("❌ qNew FAILED:", e);
                  return null as any;
                }),
                getDocs(qLegacy).catch((e) => {
                  console.warn("❌ qLegacy FAILED:", e);
                  return null as any;
                }),
              ]);
            
              const byId = new Map<string, Job>();
            
              const addSnap = (snap: any) => {
                if (!snap?.docs?.length) return;
                snap.docs.forEach((d: any) => {
                  const data: any = d.data() ?? {};
                  byId.set(d.id, {
                    id: d.id,
                    title: String(data.title ?? ""),
                    address: String(data.address ?? ""),
                    description: String(data.description ?? ""),
                    createdAt: normalizeCreatedAt(data.createdAt),
                    isDone: Boolean(data.isDone ?? false),
                    clientName: data.clientName ? String(data.clientName) : undefined,
                    clientPhone: data.clientPhone ? String(data.clientPhone) : undefined,
                    clientNotes: data.clientNotes ? String(data.clientNotes) : undefined,
                    photoUris: Array.isArray(data.photoUris) ? data.photoUris : [],
                    laborHours: typeof data.laborHours === "number" ? data.laborHours : 0,
                    hourlyRate: typeof data.hourlyRate === "number" ? data.hourlyRate : 0,
                    materialCost: typeof data.materialCost === "number" ? data.materialCost : 0,
            
                    assignedToUids: Array.isArray(data.assignedToUids) ? data.assignedToUids : [],
                    assignedToUid: data.assignedToUid ? String(data.assignedToUid) : null,
            
                    ownerUid: data.ownerUid ? String(data.ownerUid) : undefined,
                    createdByUid: data.createdByUid ? String(data.createdByUid) : undefined,
                  });
                });
              };
            
              addSnap(snapNew);
              addSnap(snapLegacy);
            
              const merged = Array.from(byId.values());
            
              console.warn("EMP JOBS MERGED:", {
                newSize: snapNew?.size ?? 0,
                legacySize: snapLegacy?.size ?? 0,
                merged: merged.length,
                uid: employeeUid,
                companyId: liveCompanyId,
              });
            
              setJobs(merged);
              setTrashJobs([]);
              setIsHydrated(true);
              return;
            } catch (e) {
              console.warn("❌ EMP JOBS MERGE FAILED:", e);
              setJobs([]);
              setTrashJobs([]);
              setIsHydrated(true);
              return;
            }
            
          }

// --- OWNER MODE ---
if (parsed?.role === "owner") {
  if (!parsed.companyId) {
    setJobs([]);
    setTrashJobs([]);
    setIsHydrated(true);
    router.replace("/create-company" as any);
    return;
  }
  if (!parsed.uid) {
    setJobs([]);
    setTrashJobs([]);
    setIsHydrated(true);
    router.replace("/login" as any);
    return;
  }

  const jobsRef = collection(db, "companies", parsed.companyId, "jobs");

  try {
    const snap = await getDocs(jobsRef); // ✅ load all jobs in company

    console.warn("OWNER JOBS SNAP:", {
      size: snap.size,
      empty: snap.empty,
      uid: parsed.uid,
      companyId: parsed.companyId,
    });

    const fetched: Job[] = snap.docs.map((d) => {
      const data: any = d.data() ?? {};
      return {
        id: d.id,
        title: String(data.title ?? ""),
        address: String(data.address ?? ""),
        description: String(data.description ?? ""),
        createdAt: normalizeCreatedAt(data.createdAt),
        isDone: Boolean(data.isDone ?? false),
        clientName: data.clientName ? String(data.clientName) : undefined,
        clientPhone: data.clientPhone ? String(data.clientPhone) : undefined,
        clientNotes: data.clientNotes ? String(data.clientNotes) : undefined,
        photoUris: Array.isArray(data.photoUris) ? data.photoUris : [],
        laborHours: typeof data.laborHours === "number" ? data.laborHours : 0,
        hourlyRate: typeof data.hourlyRate === "number" ? data.hourlyRate : 0,
        materialCost: typeof data.materialCost === "number" ? data.materialCost : 0,
        assignedToUids: Array.isArray(data.assignedToUids) ? data.assignedToUids : [],
        ownerUid: data.ownerUid ? String(data.ownerUid) : undefined,
        createdByUid: data.createdByUid ? String(data.createdByUid) : undefined,
      };
    });

    setJobs(fetched);
    setTrashJobs([]);
    setIsHydrated(true);
    return;
  } catch (e) {
    console.warn("❌ OWNER JOBS QUERY FAILED:", e);
    setJobs([]);
    setTrashJobs([]);
    setIsHydrated(true);
    return;
  }
}


          // --- INDEPENDENT MODE ---
          const [[, jobsJson], [, trashJson], [, sortJson]] = await AsyncStorage.multiGet([
            STORAGE_KEYS.JOBS,
            STORAGE_KEYS.TRASH,
            STORAGE_KEYS.SORT,
          ]);

          if (!jobsJson) {
            const seed: Job[] = [
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
            ];
            setJobs(seed);
          } else {
            setJobs(JSON.parse(jobsJson));
          }

          if (trashJson) setTrashJobs(JSON.parse(trashJson));
          if (sortJson && sortOptions.includes(sortJson as SortOption)) {
            setSortOption(sortJson as SortOption);
          }

          setIsHydrated(true);
        } catch (err) {
          console.warn("Failed to load jobs:", err);
          setIsHydrated(true);
        }
      };

      loadData();
    }, [router])
  );

  useEffect(() => {
    if (!isHydrated) return;
    if (isCloudMode) return;
    if (!isIndependent) return;

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
  }, [jobs, trashJobs, sortOption, isHydrated, isCloudMode, isIndependent]);

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
      job.photoUris && job.photoUris.length > 0 ? `Photos: ${job.photoUris.length}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const firstPhoto = job.photoUris?.[0];

    try {
      if (firstPhoto) await Share.share({ message, url: firstPhoto });
      else await Share.share({ message });
    } catch (err) {
      console.warn("Failed to share job:", err);
    }
  }, []);

  const handleDeleteJob = useCallback(
    (id: string) => {
      if (isCloudMode) return;

      setJobs((prev) => {
        const jobToTrash = prev.find((j) => j.id === id);
        if (!jobToTrash) return prev;

        setTrashJobs((t) => [jobToTrash, ...t]);
        return prev.filter((j) => j.id !== id);
      });
    },
    [isCloudMode]
  );

  const scrollY = useRef(new Animated.Value(0)).current;
  const [activeIndex, setActiveIndex] = useState(0);

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = e.nativeEvent.contentOffset.y;
    const rawIndex = offsetY / CARD_OUTER_HEIGHT;
    let index = Math.round(rawIndex);
    if (index < 0) index = 0;
    if (index > visibleJobs.length - 1) index = visibleJobs.length - 1;
    setActiveIndex(index);
  };

  const animatedIndex = Animated.divide(scrollY, new Animated.Value(CARD_OUTER_HEIGHT));

  const renderFocusedItem = useCallback(
    ({ item, index }: { item: Job; index: number }) => (
      <FocusJobCard
        job={item}
        theme={theme}
        brand={brand}
        index={index}
        animatedIndex={animatedIndex}
        onOpen={handleOpenJob}
      />
    ),
    [theme, brand, animatedIndex, handleOpenJob]
  );

  const dismissKeyboardAndEditing = () => {
    Keyboard.dismiss();
    setIsEditing(false);
  };

  if (!isReady || !sessionChecked) {
    return <View style={{ flex: 1, backgroundColor: themes.graphite.screenBackground }} />;
  }

  if (session?.role === "employee" && !session.companyId) {
    router.replace("/join-company" as any);
    return <View style={{ flex: 1, backgroundColor: theme.screenBackground }} />;
  }

  if (session?.role === "owner" && !session.companyId) {
    router.replace("/create-company" as any);
    return <View style={{ flex: 1, backgroundColor: theme.screenBackground }} />;
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.screenBackground }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <TouchableWithoutFeedback onPress={dismissKeyboardAndEditing} accessible={false}>
        <View style={{ flex: 1 }}>
          <Animated.View
            style={[
              styles.container,
              {
                transform: [{ scale: screenScale }],
                backgroundColor: theme.screenBackground,
                paddingBottom: 20,
              },
            ]}
          >
            <View style={styles.headerRow}>
              <Text style={[styles.header, { color: theme.headerText }]}>THE TRAKTR APP</Text>

              {isOwner && (
                <TouchableOpacity
                  activeOpacity={0.9}
                  style={[
                    styles.workTicketsBtn,
                    { backgroundColor: theme.cardBackground + "F2", borderColor: theme.cardBorder },
                  ]}
                  onPress={goToWorkTicketsInbox}
                >
                  <Ionicons name="clipboard-outline" size={16} color={theme.textPrimary} />
                  <Text style={[styles.workTicketsBtnText, { color: theme.textPrimary }]}>
                    Work Tickets
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.aiHelperRow}>
              <TouchableOpacity
                activeOpacity={0.9}
                style={styles.aiHelperButton}
                onPress={() => router.push("/ai-helper")}
              >
                <LinearGradient
                  colors={[brand, brand + "CC", brand + "88"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.aiHelperGradient}
                >
                  <Ionicons name="sparkles-outline" size={16} color={theme.textPrimary} />
                  <Text style={[styles.aiHelperText, { color: theme.textPrimary }]}>
                    Ask Traktr AI
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            <View style={styles.summaryRow}>
              <TouchableOpacity
                style={[
                  styles.summaryCard,
                  {
                    backgroundColor: theme.summaryCardBackground + "F2",
                    borderColor: theme.summaryCardBorder,
                  },
                  statusFilter === "open" && { borderColor: brand },
                ]}
                onPress={() => setStatusFilter((prev) => (prev === "open" ? "all" : "open"))}
              >
                <Text style={[styles.summaryLabel, { color: theme.textMuted }]}>Open</Text>
                <Text style={[styles.summaryValue, { color: theme.textPrimary }]}>{openJobs}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.summaryCard,
                  {
                    backgroundColor: theme.summaryCardBackground + "F2",
                    borderColor: theme.summaryCardBorder,
                  },
                  statusFilter === "done" && { borderColor: brand },
                ]}
                onPress={() => setStatusFilter((prev) => (prev === "done" ? "all" : "done"))}
              >
                <Text style={[styles.summaryLabel, { color: theme.textMuted }]}>Done</Text>
                <Text style={[styles.summaryValue, { color: theme.textPrimary }]}>{doneJobs}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.summaryCard,
                  {
                    backgroundColor: theme.summaryCardBackground + "F2",
                    borderColor: theme.summaryCardBorder,
                  },
                  statusFilter === "all" && { borderColor: brand },
                ]}
                onPress={() => setStatusFilter("all")}
              >
                <Text style={[styles.summaryLabel, { color: theme.textMuted }]}>Total</Text>
                <Text style={[styles.summaryValue, { color: theme.textPrimary }]}>{totalJobs}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.controlsRow}>
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

              <View style={styles.sortContainer}>
                <TouchableOpacity
                  style={[
                    styles.sortButton,
                    { backgroundColor: theme.cardBackground + "F2", borderColor: theme.cardBorder },
                    isSortMenuVisible && { borderColor: brand },
                  ]}
                  onPress={() => setIsSortMenuVisible((prev) => !prev)}
                >
                  <Text style={[styles.sortLabel, { color: theme.textMuted }]}>Sort</Text>
                  <Text style={[styles.sortValue, { color: theme.textPrimary }]}>{sortOption}</Text>
                </TouchableOpacity>

                {isSortMenuVisible && (
                  <View
                    style={[
                      styles.sortDropdown,
                      { backgroundColor: theme.cardBackground + "F2", borderColor: theme.cardBorder },
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
                            option === sortOption && { color: brand },
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

            <View style={styles.focusHeaderRow}>
              <Text style={[styles.focusHeaderTitle, { color: theme.textPrimary }]}>
                Focused jobs
              </Text>
              <Text style={[styles.focusHeaderCount, { color: theme.textMuted }]}>
                {visibleJobs.length === 0
                  ? "0 / 0"
                  : `${Math.min(activeIndex + 1, visibleJobs.length)} / ${visibleJobs.length}`}
              </Text>
            </View>

            {!isHydrated ? (
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>Loading…</Text>
            ) : visibleJobs.length === 0 ? (
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                {isEmployee ? "No assigned jobs yet." : "No jobs found."}
              </Text>
            ) : (
              <Animated.FlatList
                data={visibleJobs}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.focusListContent}
                renderItem={renderFocusedItem}
                showsVerticalScrollIndicator={false}
                snapToInterval={CARD_OUTER_HEIGHT}
                decelerationRate="fast"
                onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
                  useNativeDriver: true,
                })}
                onMomentumScrollEnd={onMomentumEnd}
              />
            )}
          </Animated.View>
        </View>
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

  headerRow: {
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  header: {
    fontSize: 22,
    fontFamily: "Athiti-Bold",
    letterSpacing: 0.2,
  },

  workTicketsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  workTicketsBtnText: {
    fontSize: 12,
    fontFamily: "Athiti-SemiBold",
    letterSpacing: 0.2,
  },

  aiHelperRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
    marginBottom: 10,
  },
  aiHelperButton: {
    borderRadius: 999,
    overflow: "hidden",
  },
  aiHelperGradient: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 6,
    shadowColor: "#000",
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  aiHelperText: {
    fontSize: 12,
    fontFamily: "Athiti-SemiBold",
    letterSpacing: 0.2,
  },

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
  summaryLabel: {
    fontSize: 12,
    fontFamily: "Athiti-Medium",
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  summaryValue: {
    fontSize: 20,
    fontFamily: "Athiti-Bold",
    letterSpacing: 0.2,
  },

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
    fontFamily: "Athiti-Regular",
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
    fontFamily: "Athiti-Medium",
    letterSpacing: 0.2,
  },
  sortValue: {
    fontSize: 13,
    fontFamily: "Athiti-SemiBold",
    letterSpacing: 0.2,
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
    fontFamily: "Athiti-Medium",
  },
  sortOptionTextActive: {
    fontFamily: "Athiti-Bold",
  },

  focusHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 4,
  },
  focusHeaderTitle: {
    fontSize: 18,
    fontFamily: "Athiti-Bold",
    letterSpacing: 0.2,
  },
  focusHeaderCount: {
    fontSize: 13,
    fontFamily: "Athiti-Medium",
  },

  focusListContent: {
    paddingTop: 8,
    paddingBottom: 16,
  },
  focusCardOuter: {
    height: CARD_OUTER_HEIGHT,
    justifyContent: "center",
    shadowColor: "#000",
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  focusCardInner: {
    height: CARD_HEIGHT,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderWidth: 1,
  },
  focusCardContent: {
    flex: 1,
  },

  mediaHeaderWrapper: {
    marginBottom: 10,
  },
  mediaHeader: {
    height: 52,
    borderRadius: 16,
    overflow: "hidden",
  },
  mediaHeaderImage: {
    width: "100%",
    height: "100%",
  },
  mediaHeaderOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  mediaStatusBar: {
    marginTop: 6,
    height: 5,
    borderRadius: 999,
  },

  focusTitle: {
    fontSize: 17,
    fontFamily: "Athiti-Bold",
    letterSpacing: 0.15,
  },
  focusClient: {
    fontSize: 13,
    fontFamily: "Athiti-Medium",
    marginTop: 3,
  },
  focusAddress: {
    fontSize: 13,
    fontFamily: "Athiti-Regular",
    marginTop: 1,
    marginBottom: 8,
  },

  focusMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: "auto",
    gap: 10,
  },
  focusStatusPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  focusStatusText: {
    fontSize: 11,
    fontFamily: "Athiti-SemiBold",
    letterSpacing: 0.2,
  },

  focusPhotoChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  focusPhotoChipText: {
    fontSize: 12,
    fontFamily: "Athiti-Medium",
  },

  focusAmountClean: {
    marginLeft: "auto",
    fontSize: 13,
    fontFamily: "Athiti-Bold",
    letterSpacing: 0.2,
  },

  focusTextDone: {
    textDecorationLine: "line-through",
    opacity: 0.6,
  },

  emptyText: {
    textAlign: "center",
    fontSize: 14,
    fontFamily: "Athiti-Medium",
    marginTop: 16,
  },
});
