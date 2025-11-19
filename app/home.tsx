// app/home.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import React, {
  FC,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  UIManager,
  View,
} from "react-native";

import { useFocusEffect, useRouter } from "expo-router";
import ImageViewing from "react-native-image-viewing";

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

const screenWidth = Dimensions.get("window").width;

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const GRID_COLUMNS = 3;
const GRID_HORIZONTAL_PADDING = 16 * 2; // detailsScroll paddingHorizontal
const GRID_GAP = 8;
const MAX_THUMBS_TO_SHOW = 6;

const THUMB_SIZE =
  (screenWidth - GRID_HORIZONTAL_PADDING - GRID_GAP * (GRID_COLUMNS - 1)) /
  GRID_COLUMNS;

const HomeScreen: FC = () => {
  const router = useRouter();

  // MAIN DATA
  const [jobs, setJobs] = useState<Job[]>(initialJobs);
  const [trashJobs, setTrashJobs] = useState<Job[]>([]);

  // UI
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>("Newest");
  const [isSortMenuVisible, setIsSortMenuVisible] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "done">(
    "all"
  );


  // Add Job form
  const [isAddFormVisible, setIsAddFormVisible] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newClientName, setNewClientName] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [newClientNotes, setNewClientNotes] = useState("");
  const [newLaborHours, setNewLaborHours] = useState("");
  const [newHourlyRate, setNewHourlyRate] = useState("");
  const [newMaterialCost, setNewMaterialCost] = useState("");

  // Job details (modal) – still in file but not used by card tap now
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isDetailsVisible, setIsDetailsVisible] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editClientName, setEditClientName] = useState("");
  const [editClientPhone, setEditClientPhone] = useState("");
  const [editClientNotes, setEditClientNotes] = useState("");

  // Pricing in edit modal (optional – still wired for later)
  const [editLaborHours, setEditLaborHours] = useState("");
  const [editHourlyRate, setEditHourlyRate] = useState("");
  const [editMaterialCost, setEditMaterialCost] = useState("");

  // Trash
  const [isTrashVisible, setIsTrashVisible] = useState(false);

  // Hydration
  const [isHydrated, setIsHydrated] = useState(false);

  // Scroll for client notes
  const detailsScrollRef = useRef<ScrollView | null>(null);
  const clientNotesYRef = useRef(0);

  // Fullscreen image overlay (inside details)
  const [isImageOverlayVisible, setIsImageOverlayVisible] = useState(false);
  const [fullImageIndex, setFullImageIndex] = useState(0);

  // Add Photo mini menu
  const [isAddPhotoMenuVisible, setIsAddPhotoMenuVisible] = useState(false);

  // Button animation values
  const markDoneScale = useRef(new Animated.Value(1)).current;
  const saveChangesScale = useRef(new Animated.Value(1)).current;

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

  const markDoneAnim = createScaleHandlers(markDoneScale);
  const saveChangesAnim = createScaleHandlers(saveChangesScale);

  // -------- SORT + FILTER --------

  const handleSelectSort = (option: SortOption) => {
    setSortOption(option);
    setIsSortMenuVisible(false);
  };

  const visibleJobs = useMemo(() => {
    let data = [...jobs];

    // 🔍 Status filter from summary cards
    if (statusFilter === "open") {
      data = data.filter((job) => !job.isDone);
    } else if (statusFilter === "done") {
      data = data.filter((job) => job.isDone);
    }

    // 🔍 Text search
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

    // 🔽 Sort
    data.sort((a, b) => {
      if (sortOption === "Newest") {
        return (
          new Date(b.createdAt).getTime() -
          new Date(a.createdAt).getTime()
        );
      }
      if (sortOption === "Oldest") {
        return (
          new Date(a.createdAt).getTime() -
          new Date(b.createdAt).getTime()
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

  const totalRevenue = useMemo(() => {
    return jobs.reduce((sum, job) => {
      const laborTotal =
        (job.laborHours || 0) * (job.hourlyRate || 0);
      const materialTotal = job.materialCost || 0;
      return sum + laborTotal + materialTotal;
    }, 0);
  }, [jobs]);

  const formattedTotalRevenue = totalRevenue.toLocaleString("en-US", {
    minimumFractionDigits: 2,
  });

  // -------- ADD JOB --------

  const handleAddNewJobPress = () => {
    Keyboard.dismiss();
    router.push("/add-job");
  };
  

  const handleSaveNewJob = () => {
    if (!newTitle.trim()) return;

    const laborHours = parseFloat(newLaborHours) || 0;
    const hourlyRate = parseFloat(newHourlyRate) || 0;
    const materialCost = parseFloat(newMaterialCost) || 0;

    const job: Job = {
      id: Date.now().toString(),
      title: newTitle.trim(),
      address: newAddress.trim() || "N/A",
      description:
        newDescription.trim() || "No description / scope of work added.",
      createdAt: new Date().toISOString(),
      isDone: false,
      clientName: newClientName.trim() || undefined,
      clientPhone: newClientPhone.trim() || undefined,
      clientNotes: newClientNotes.trim() || undefined,
      photoUris: [],
      laborHours,
      hourlyRate,
      materialCost,
    };

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    setJobs((prev) => [...prev, job]);
    setNewTitle("");
    setNewAddress("");
    setNewDescription("");
    setNewClientName("");
    setNewClientPhone("");
    setNewClientNotes("");
    setNewLaborHours("");
    setNewHourlyRate("");
    setNewMaterialCost("");
    setIsAddFormVisible(false);
    Keyboard.dismiss();
    Alert.alert("Job saved", "New job has been added.");
  };

  // -------- JOB DETAILS (modal) – still here but not used from list tap --------

  const openJobDetails = (job: Job) => {
    setSelectedJob(job);
    setEditTitle(job.title);
    setEditAddress(job.address);
    setEditDescription(job.description);
    setEditClientName(job.clientName || "");
    setEditClientPhone(job.clientPhone || "");
    setEditClientNotes(job.clientNotes || "");
    setEditLaborHours(
      job.laborHours !== undefined ? String(job.laborHours) : ""
    );
    setEditHourlyRate(
      job.hourlyRate !== undefined ? String(job.hourlyRate) : ""
    );
    setEditMaterialCost(
      job.materialCost !== undefined ? String(job.materialCost) : ""
    );
    setIsDetailsVisible(true);
    Keyboard.dismiss();
  };

  const closeJobDetails = () => {
    setIsDetailsVisible(false);
    setSelectedJob(null);
    setIsImageOverlayVisible(false);
    setFullImageIndex(0);
    Keyboard.dismiss();
  };

  const handleSaveJobEdits = () => {
    if (!selectedJob) return;

    const updated: Job = {
      ...selectedJob,
      title: editTitle.trim() || selectedJob.title,
      address: editAddress.trim() || selectedJob.address,
      description: editDescription.trim() || selectedJob.description,
      clientName: editClientName.trim() || undefined,
      clientPhone: editClientPhone.trim() || undefined,
      clientNotes: editClientNotes.trim() || undefined,
      laborHours: parseFloat(editLaborHours) || 0,
      hourlyRate: parseFloat(editHourlyRate) || 0,
      materialCost: parseFloat(editMaterialCost) || 0,
    };

    setJobs((prev) =>
      prev.map((job) => (job.id === selectedJob.id ? updated : job))
    );
    setSelectedJob(updated);
    closeJobDetails();
    Alert.alert("Changes saved", "Job details updated successfully.");
  };

  const handleToggleDoneInDetails = () => {
    if (!selectedJob) return;

    const updated: Job = { ...selectedJob, isDone: !selectedJob.isDone };

    setJobs((prev) =>
      prev.map((job) => (job.id === selectedJob.id ? updated : job))
    );
    setSelectedJob(updated);
  };

  // -------- PHOTOS (modal) – still wired to selectedJob --------

  const handleAddPhotoToJob = (uri: string) => {
    if (!selectedJob) return;

    const updated: Job = {
      ...selectedJob,
      photoUris: [...(selectedJob.photoUris || []), uri],
    };
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    setJobs((prev) =>
      prev.map((job) => (job.id === selectedJob.id ? updated : job))
    );
    setSelectedJob(updated);
  };

  const handleAddPhotoFromGallery = async () => {
    if (!selectedJob) return;

    const { status } =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission needed",
        "We need access to your photos to attach pictures to this job."
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: false,
      quality: 0.7,
    });

    if (result.canceled) return;
    const uri = result.assets[0]?.uri;
    if (!uri) return;

    handleAddPhotoToJob(uri);
  };

  const handleAddPhotoFromCamera = async () => {
    if (!selectedJob) return;

    const { status } =
      await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission needed",
        "We need access to your camera to take photos for this job."
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });

    if (result.canceled) return;
    const uri = result.assets[0]?.uri;
    if (!uri) return;

    handleAddPhotoToJob(uri);
  };

  const handleRemovePhotoFromJob = (uriToRemove: string) => {
    if (!selectedJob) return;

    Alert.alert(
      "Remove photo",
      "Are you sure you want to remove this photo from the job?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            LayoutAnimation.configureNext(
              LayoutAnimation.Presets.easeInEaseOut
            );

            setSelectedJob((current) => {
              if (!current) return current;

              const updated: Job = {
                ...current,
                photoUris: (current.photoUris || []).filter(
                  (u) => u !== uriToRemove
                ),
              };

              setJobs((prev) =>
                prev.map((job) =>
                  job.id === current.id ? updated : job
                )
              );

              return updated;
            });
          },
        },
      ]
    );
  };

  const handleOpenFullImage = (uri: string) => {
    if (!selectedJob?.photoUris || selectedJob.photoUris.length === 0) return;

    const index = selectedJob.photoUris.indexOf(uri);
    setFullImageIndex(index === -1 ? 0 : index);
    setIsImageOverlayVisible(true);
  };

  const handleCloseFullImage = () => {
    setIsImageOverlayVisible(false);
  };

  // -------- TRASH --------

  const confirmMoveToTrash = () => {
    if (!selectedJob) return;

    Alert.alert(
      "Delete Job",
      "Are you sure you want to move this job to Trash?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Move to Trash",
          style: "destructive",
          onPress: () => {
            LayoutAnimation.configureNext(
              LayoutAnimation.Presets.easeInEaseOut
            );

            setJobs((prev) =>
              prev.filter((job) => job.id !== selectedJob.id)
            );
            setTrashJobs((prev) => [...prev, selectedJob]);
            closeJobDetails();
          },
        },
      ]
    );
  };

  const handleRestoreFromTrash = (id: string) => {
    const job = trashJobs.find((j) => j.id === id);
    if (!job) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    setTrashJobs((prev) => prev.filter((j) => j.id !== id));
    setJobs((prev) => [...prev, job]);
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
          onPress: () => {
            LayoutAnimation.configureNext(
              LayoutAnimation.Presets.easeInEaseOut
            );

            setTrashJobs((prev) => prev.filter((j) => j.id !== id));
          },
        },
      ]
    );
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
  

  // -------- ASYNC STORAGE SAVE --------

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
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 20 : 0}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>

      <View style={styles.container}>
        {/* HEADER */}
        <View style={styles.headerRow}>
          <Text style={styles.header}>TESTING HOME SCREEN 9</Text>

          <View style={styles.headerActionsRow}>
            <TouchableOpacity
              style={styles.settingsButton}
              onPress={() => router.push("/settings")}
              activeOpacity={0.8}
            >
              <Text style={styles.settingsButtonText}>Settings</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.trashButton}
              onPress={() => {
                setIsTrashVisible(true);
                Keyboard.dismiss();
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.trashButtonText}>
                Trash ({trashJobs.length})
              </Text>
            </TouchableOpacity>
          </View>
        </View>

     {/* 📊 DAY 12 – DASHBOARD SUMMARY */}
<View style={styles.summaryRow}>
  {/* Open jobs card */}
  <TouchableOpacity
    style={[
      styles.summaryCard,
      statusFilter === "open" && styles.summaryCardActive,
    ]}
    activeOpacity={0.8}
    onPress={() =>
      setStatusFilter((prev) => (prev === "open" ? "all" : "open"))
    }
  >
    <Text style={styles.summaryLabel}>Open Jobs</Text>
    <Text style={styles.summaryValue}>{openJobs}</Text>
  </TouchableOpacity>

  {/* Done jobs card */}
  <TouchableOpacity
    style={[
      styles.summaryCard,
      statusFilter === "done" && styles.summaryCardActive,
    ]}
    activeOpacity={0.8}
    onPress={() =>
      setStatusFilter((prev) => (prev === "done" ? "all" : "done"))
    }
  >
    <Text style={styles.summaryLabel}>Done</Text>
    <Text style={styles.summaryValue}>{doneJobs}</Text>
  </TouchableOpacity>

  {/* Total jobs card → always resets to ALL */}
  <TouchableOpacity
    style={[
      styles.summaryCard,
      statusFilter === "all" && styles.summaryCardActive,
    ]}
    activeOpacity={0.8}
    onPress={() => setStatusFilter("all")}
  >
    <Text style={styles.summaryLabel}>Total Jobs</Text>
    <Text style={styles.summaryValue}>{totalJobs}</Text>
  </TouchableOpacity>
</View>


        {/* SEARCH + SORT */}
        <View style={styles.controlsRow}>
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search jobs or clients..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#888"
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
            />
          </View>

          <View style={styles.sortContainer}>
            <TouchableOpacity
              style={styles.sortButton}
              onPress={() => {
                setIsSortMenuVisible((prev) => !prev);
                Keyboard.dismiss();
              }}
              activeOpacity={0.9}
            >
              <Text style={styles.sortLabel}>Sort by:</Text>
              <Text style={styles.sortValue}>{sortOption}</Text>
            </TouchableOpacity>

            {isSortMenuVisible && (
              <View style={styles.sortDropdown}>
                {sortOptions.map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={styles.sortOption}
                    onPress={() => handleSelectSort(option)}
                  >
                    <Text
                      style={[
                        styles.sortOptionText,
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
        <TouchableOpacity
  style={styles.addJobButton}
  onPress={() => {
    Keyboard.dismiss();
    router.push("/add-job");
  }}
  activeOpacity={0.9}
>
  <Text style={styles.addJobButtonText}>Add New Job</Text>
</TouchableOpacity>

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

            return (
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => {
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
                      jobTotal: String(jobTotal),
                      photoCount: String(item.photoUris?.length ?? 0),
                      // PRICE SYSTEM — Day 11D
                      laborHours: String(item.laborHours ?? 0),
                      hourlyRate: String(item.hourlyRate ?? 0),
                      materialCost: String(item.materialCost ?? 0),
                    },
                  });
                }}
              >
                <View
                  style={[
                    styles.jobCard,
                    item.isDone && styles.jobCardDone,
                  ]}
                >
                  <View style={styles.jobCardHeaderRow}>
                    <Text
                      style={[
                        styles.jobTitle,
                        item.isDone && styles.jobTitleDone,
                      ]}
                    >
                      {item.title}
                    </Text>

                    <View
                      style={[
                        styles.statusTag,
                        item.isDone
                          ? styles.statusTagDone
                          : styles.statusTagOpen,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusTagText,
                          item.isDone && styles.statusTagTextDone,
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
                        item.isDone && styles.jobTextDone,
                      ]}
                    >
                      Client: {item.clientName}
                    </Text>
                  )}

                  <Text
                    style={[
                      styles.jobAddress,
                      item.isDone && styles.jobTextDone,
                    ]}
                  >
                    {item.address}
                  </Text>

                  {/* 📷 Photo count badge */}
                  {!!(item.photoUris && item.photoUris.length > 0) && (
                    <Text
                      style={[
                        styles.jobPhotoCount,
                        item.isDone && styles.jobTextDone,
                      ]}
                    >
                      📷 {item.photoUris!.length}{" "}
                      {item.photoUris!.length === 1
                        ? "photo"
                        : "photos"}
                    </Text>
                  )}

                  {/* 💵 Total badge */}
                  {jobTotal > 0 && (
                    <Text
                      style={[
                        styles.jobAmount,
                        item.isDone && styles.jobTextDone,
                      ]}
                    >
                      💵 Total: ${jobTotal.toFixed(2)}
                    </Text>
                  )}

                  <Text
                    style={[
                      styles.jobDate,
                      item.isDone && styles.jobTextDone,
                    ]}
                  >
                    {new Date(item.createdAt).toLocaleString()}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No jobs match your search.</Text>
          }
        />

        {/* JOB DETAILS SCREEN (FULL MODAL) – still here for now, not triggered from list */}
        <Modal
          visible={isDetailsVisible}
          animationType="slide"
          transparent={false}
          onRequestClose={closeJobDetails}
        >
          <KeyboardAvoidingView
            style={{ flex: 1, backgroundColor: "#020617" }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={Platform.OS === "ios" ? 20 : 0}
          >
            <View style={styles.detailsScreen}>
              <ScrollView
                ref={detailsScrollRef}
                contentContainerStyle={styles.detailsScroll}
                keyboardShouldPersistTaps="always"
                showsVerticalScrollIndicator={false}
                onScrollBeginDrag={Keyboard.dismiss}
              >
                <TouchableWithoutFeedback
                  onPress={Keyboard.dismiss}
                  accessible={false}
                >
                  <View>
                    <Text style={styles.modalTitle}>Job Details</Text>

                    <Text style={styles.modalLabel}>Title</Text>
                    <TextInput
                      style={styles.modalInput}
                      value={editTitle}
                      onChangeText={setEditTitle}
                      placeholderTextColor="#6B7280"
                      returnKeyType="done"
                      onSubmitEditing={Keyboard.dismiss}
                    />

                    <Text style={styles.modalLabel}>Address</Text>
                    <TextInput
                      style={styles.modalInput}
                      value={editAddress}
                      onChangeText={setEditAddress}
                      placeholderTextColor="#6B7280"
                      returnKeyType="done"
                      onSubmitEditing={Keyboard.dismiss}
                    />

                    <Text style={styles.modalLabel}>
                      Description / Scope
                    </Text>
                    <TextInput
                      style={styles.modalInputMultiline}
                      value={editDescription}
                      onChangeText={setEditDescription}
                      multiline
                      placeholderTextColor="#6B7280"
                    />

                    <Text style={styles.detailsSectionTitle}>
                      Client Info
                    </Text>

                    <Text style={styles.modalLabel}>Client Name</Text>
                    <TextInput
                      style={styles.modalInput}
                      value={editClientName}
                      onChangeText={setEditClientName}
                      placeholder="Client name..."
                      placeholderTextColor="#6B7280"
                    />

                    <Text style={styles.modalLabel}>Client Phone</Text>
                    <TextInput
                      style={styles.modalInput}
                      value={editClientPhone}
                      onChangeText={setEditClientPhone}
                      placeholder="Phone number..."
                      placeholderTextColor="#6B7280"
                      keyboardType="phone-pad"
                    />

                    <Text style={styles.modalLabel}>Client Notes</Text>
                    <TextInput
                      style={styles.modalInputMultiline}
                      value={editClientNotes}
                      onChangeText={setEditClientNotes}
                      placeholder="Gate codes, timing, special info..."
                      placeholderTextColor="#6B7280"
                      multiline
                      onLayout={(e) => {
                        clientNotesYRef.current =
                          e.nativeEvent.layout.y;
                      }}
                      onFocus={() => {
                        if (detailsScrollRef.current) {
                          detailsScrollRef.current.scrollTo({
                            y: Math.max(
                              clientNotesYRef.current - 80,
                              0
                            ),
                            animated: true,
                          });
                        }
                      }}
                    />

                    {/* Pricing in details */}
                    <Text style={styles.detailsSectionTitle}>
                      Pricing
                    </Text>

                    <Text style={styles.modalLabel}>Labor Hours</Text>
                    <TextInput
                      style={styles.modalInput}
                      value={editLaborHours}
                      onChangeText={setEditLaborHours}
                      placeholder="Ex: 4.5"
                      placeholderTextColor="#6B7280"
                      keyboardType="numeric"
                    />

                    <Text style={styles.modalLabel}>
                      Hourly Rate ($/hr)
                    </Text>
                    <TextInput
                      style={styles.modalInput}
                      value={editHourlyRate}
                      onChangeText={setEditHourlyRate}
                      placeholder="Ex: 120"
                      placeholderTextColor="#6B7280"
                      keyboardType="numeric"
                    />

                    <Text style={styles.modalLabel}>
                      Material Cost ($)
                    </Text>
                    <TextInput
                      style={styles.modalInput}
                      value={editMaterialCost}
                      onChangeText={setEditMaterialCost}
                      placeholder="Ex: 350"
                      placeholderTextColor="#6B7280"
                      keyboardType="numeric"
                    />

                    {/* Photos */}
                    <Text style={styles.detailsSectionTitle}>Photos</Text>

                    <View style={styles.photosRow}>
                      <TouchableOpacity
                        style={styles.addPhotoButton}
                        onPress={() =>
                          setIsAddPhotoMenuVisible(true)
                        }
                        activeOpacity={0.9}
                      >
                        <Text style={styles.addPhotoButtonText}>
                          + Add Photo
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {selectedJob?.photoUris &&
                      selectedJob.photoUris.length > 0 && (
                        <View style={styles.photoGrid}>
                          {(() => {
                            const total =
                              selectedJob.photoUris.length;
                            const displayUris =
                              selectedJob.photoUris.slice(
                                0,
                                MAX_THUMBS_TO_SHOW
                              );

                            return displayUris.map(
                              (uri, index) => {
                                const isLastTile =
                                  index ===
                                    MAX_THUMBS_TO_SHOW - 1 &&
                                  total > MAX_THUMBS_TO_SHOW;
                                const extraCount =
                                  total - MAX_THUMBS_TO_SHOW;

                                return (
                                  <View
                                    key={uri}
                                    style={styles.photoWrapper}
                                  >
                                    <TouchableOpacity
                                      style={{ flex: 1 }}
                                      activeOpacity={0.9}
                                      onPress={() => {
                                        if (isLastTile) {
                                          setFullImageIndex(
                                            index
                                          );
                                          setIsImageOverlayVisible(
                                            true
                                          );
                                        } else {
                                          handleOpenFullImage(
                                            uri
                                          );
                                        }
                                      }}
                                    >
                                      <Image
                                        source={{ uri }}
                                        style={
                                          styles.photoThumb
                                        }
                                        resizeMode="cover"
                                      />
                                      {isLastTile &&
                                        extraCount > 0 && (
                                          <View
                                            style={
                                              styles.photoMoreOverlay
                                            }
                                          >
                                            <Text
                                              style={
                                                styles.photoMoreText
                                              }
                                            >
                                              +{" "}
                                              {
                                                extraCount
                                              }{" "}
                                              more
                                            </Text>
                                          </View>
                                        )}
                                    </TouchableOpacity>

                                    {!isLastTile && (
                                      <TouchableOpacity
                                        style={
                                          styles.photoRemoveButton
                                        }
                                        onPress={() =>
                                          handleRemovePhotoFromJob(
                                            uri
                                          )
                                        }
                                      >
                                        <Text
                                          style={
                                            styles.photoRemoveText
                                          }
                                        >
                                          X
                                        </Text>
                                      </TouchableOpacity>
                                    )}
                                  </View>
                                );
                              }
                            );
                          })()}
                        </View>
                      )}

                    {selectedJob && (
                      <>
                        <Text style={styles.modalMeta}>
                          Created:{" "}
                          {new Date(
                            selectedJob.createdAt
                          ).toLocaleString()}
                        </Text>
                        <Text style={styles.modalMeta}>
                          Status:{" "}
                          {selectedJob.isDone
                            ? "Done"
                            : "Open"}
                        </Text>
                      </>
                    )}

                    <View style={styles.modalButtonRow}>
                      <Animated.View
                        style={{
                          flex: 1,
                          transform: [{ scale: markDoneScale }],
                        }}
                      >
                        <TouchableOpacity
                          style={[
                            styles.modalButton,
                            selectedJob?.isDone
                              ? styles.modalButtonSecondary
                              : styles.modalButtonPrimary,
                          ]}
                          onPress={handleToggleDoneInDetails}
                          activeOpacity={0.9}
                          onPressIn={markDoneAnim.onPressIn}
                          onPressOut={markDoneAnim.onPressOut}
                        >
                          <Text style={styles.modalButtonText}>
                            {selectedJob?.isDone
                              ? "Mark as Not Done"
                              : "Mark as Done"}
                          </Text>
                        </TouchableOpacity>
                      </Animated.View>

                      <Animated.View
                        style={{
                          flex: 1,
                          transform: [{ scale: saveChangesScale }],
                        }}
                      >
                        <TouchableOpacity
                          style={[
                            styles.modalButton,
                            styles.modalButtonPrimary,
                          ]}
                          onPress={handleSaveJobEdits}
                          activeOpacity={0.9}
                          onPressIn={saveChangesAnim.onPressIn}
                          onPressOut={saveChangesAnim.onPressOut}
                        >
                          <Text style={styles.modalButtonText}>
                            Save Changes
                          </Text>
                        </TouchableOpacity>
                      </Animated.View>
                    </View>

                    <TouchableOpacity
                      style={styles.modalDeleteButton}
                      onPress={confirmMoveToTrash}
                    >
                      <Text style={styles.modalDeleteText}>
                        Move to Trash
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.modalCloseButton}
                      onPress={closeJobDetails}
                    >
                      <Text style={styles.modalCloseText}>Close</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableWithoutFeedback>
              </ScrollView>

              {/* Add Photo sheet */}
              {isAddPhotoMenuVisible && (
                <View style={styles.addPhotoMenuOverlay}>
                  <TouchableWithoutFeedback
                    onPress={() =>
                      setIsAddPhotoMenuVisible(false)
                    }
                  >
                    <View style={styles.addPhotoMenuBackdrop} />
                  </TouchableWithoutFeedback>

                  <View style={styles.addPhotoMenuSheet}>
                    <Text style={styles.addPhotoMenuTitle}>
                      Add Photo
                    </Text>

                    <TouchableOpacity
                      style={styles.addPhotoMenuOption}
                      onPress={() => {
                        setIsAddPhotoMenuVisible(false);
                        handleAddPhotoFromCamera();
                      }}
                      activeOpacity={0.9}
                    >
                      <Text style={styles.addPhotoMenuOptionText}>
                        📸 Take Photo
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.addPhotoMenuOption}
                      onPress={() => {
                        setIsAddPhotoMenuVisible(false);
                        handleAddPhotoFromGallery();
                      }}
                      activeOpacity={0.9}
                    >
                      <Text style={styles.addPhotoMenuOptionText}>
                        🖼️ Choose from Gallery
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.addPhotoMenuCancel}
                      onPress={() =>
                        setIsAddPhotoMenuVisible(false)
                      }
                      activeOpacity={0.8}
                    >
                      <Text style={styles.addPhotoMenuCancelText}>
                        Cancel
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Fullscreen viewer with pinch + swipe */}
              {selectedJob?.photoUris &&
                selectedJob.photoUris.length > 0 && (
                  <ImageViewing
                    images={selectedJob.photoUris.map((uri) => ({
                      uri,
                    }))}
                    imageIndex={fullImageIndex}
                    visible={isImageOverlayVisible}
                    onRequestClose={handleCloseFullImage}
                    swipeToCloseEnabled
                    doubleTapToZoomEnabled
                    backgroundColor="rgba(0,0,0,0.95)"
                  />
                )}
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* TRASH MODAL */}
        <Modal
          visible={isTrashVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setIsTrashVisible(false)}
        >
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={80}
          >
            <TouchableWithoutFeedback
              onPress={Keyboard.dismiss}
              accessible={false}
            >
              <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>Trash</Text>

                  {trashJobs.length === 0 ? (
                    <Text style={styles.emptyText}>Trash is empty.</Text>
                  ) : (
                    <FlatList
                      data={trashJobs}
                      keyExtractor={(item) => item.id}
                      contentContainerStyle={{ paddingBottom: 20 }}
                      keyboardShouldPersistTaps="handled"
                      renderItem={({ item }) => (
                        <View style={styles.trashCard}>
                          <Text style={styles.trashTitle}>
                            {item.title}
                          </Text>
                          <Text style={styles.trashAddress}>
                            {item.address}
                          </Text>
                          {item.clientName && (
                            <Text style={styles.trashClient}>
                              Client: {item.clientName}
                            </Text>
                          )}
                          <Text style={styles.trashDate}>
                            {new Date(
                              item.createdAt
                            ).toLocaleString()}
                          </Text>

                          <View style={styles.trashButtonRow}>
                            <TouchableOpacity
                              style={[
                                styles.trashActionButton,
                                styles.trashRestore,
                              ]}
                              onPress={() =>
                                handleRestoreFromTrash(item.id)
                              }
                            >
                              <Text style={styles.trashRestoreText}>
                                Restore
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={[
                                styles.trashActionButton,
                                styles.trashDeleteForever,
                              ]}
                              onPress={() =>
                                handleDeleteForever(item.id)
                              }
                            >
                              <Text style={styles.trashDeleteText}>
                                Delete Forever
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}
                    />
                  )}

                  <TouchableOpacity
                    style={styles.modalCloseButton}
                    onPress={() => setIsTrashVisible(false)}
                  >
                    <Text style={styles.modalCloseText}>Close</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </Modal>
      </View>
    </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

export default HomeScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050816",
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
    color: "#fff",
  },
  trashButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#4B5563",
  },
  trashButtonText: {
    fontSize: 11,
    color: "#E5E7EB",
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
    backgroundColor: "#111827",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: "#fff",
    fontSize: 14,
  },
  sortContainer: {
    marginLeft: 4,
  },
  sortButton: {
    backgroundColor: "#111827",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  sortLabel: {
    fontSize: 10,
    color: "#9CA3AF",
  },
  sortValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#E5E7EB",
  },
  sortDropdown: {
    marginTop: 4,
    backgroundColor: "#111827",
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
    color: "#E5E7EB",
  },
  sortOptionTextActive: {
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  addJobButton: {
    backgroundColor: "#2563EB",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 8,
  },
  addJobButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  addForm: {
    backgroundColor: "#111827",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  addFormLabel: {
    fontSize: 12,
    color: "#D1D5DB",
    marginBottom: 4,
  },
  addFormSectionTitle: {
    fontSize: 13,
    color: "#E5E7EB",
    fontWeight: "600",
    marginTop: 6,
    marginBottom: 4,
  },
  addFormInput: {
    backgroundColor: "#020617",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: "#F9FAFB",
    fontSize: 13,
    marginBottom: 10,
  },
  addFormInputMultiline: {
    backgroundColor: "#020617",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: "#F9FAFB",
    fontSize: 13,
    marginBottom: 10,
    minHeight: 70,
    textAlignVertical: "top",
  },
  saveJobButton: {
    backgroundColor: "#16A34A",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 4,
  },
  saveJobButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  listContent: {
    paddingVertical: 12,
    paddingBottom: 40,
  },
  jobCard: {
    backgroundColor: "#111827",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  jobCardDone: {
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: "#16A34A",
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
    color: "#F9FAFB",
  },
  jobTitleDone: {
    color: "#A7F3D0",
    textDecorationLine: "line-through",
  },
  jobClient: {
    fontSize: 12,
    color: "#E5E7EB",
    marginBottom: 2,
  },
  jobAddress: {
    fontSize: 13,
    color: "#9CA3AF",
    marginBottom: 2,
  },
  jobPhotoCount: {
    fontSize: 12,
    color: "#E5E7EB",
    marginBottom: 2,
  },
  jobAmount: {
    fontSize: 12,
    color: "#FCD34D",
    marginBottom: 2,
  },
  jobDate: {
    fontSize: 11,
    color: "#6B7280",
  },
  jobTextDone: {
    color: "#9CA3AF",
    textDecorationLine: "line-through",
  },
  statusTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#4B5563",
    backgroundColor: "#020617",
  },
  statusTagOpen: {
    borderColor: "#4B5563",
    backgroundColor: "#020617",
  },
  statusTagDone: {
    borderColor: "#16A34A",
    backgroundColor: "rgba(22,163,74,0.15)",
  },
  statusTagText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#E5E7EB",
  },
  statusTagTextDone: {
    color: "#BBF7D0",
  },
  doneBadge: {
    fontSize: 11,
    color: "#22C55E",
    fontWeight: "700",
  },
  emptyText: {
    marginTop: 24,
    textAlign: "center",
    color: "#9CA3AF",
  },
  // DETAILS SCREEN
  detailsScreen: {
    flex: 1,
    backgroundColor: "#020617",
    paddingTop: 56,
  },
  detailsScroll: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#F9FAFB",
    marginBottom: 12,
    textAlign: "center",
  },
  modalLabel: {
    fontSize: 12,
    color: "#D1D5DB",
    marginBottom: 4,
  },
  modalInput: {
    backgroundColor: "#111827",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: "#F9FAFB",
    fontSize: 13,
    marginBottom: 10,
  },
  modalInputMultiline: {
    backgroundColor: "#111827",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: "#F9FAFB",
    fontSize: 13,
    marginBottom: 10,
    minHeight: 90,
    textAlignVertical: "top",
  },
  detailsSectionTitle: {
    fontSize: 14,
    color: "#E5E7EB",
    fontWeight: "700",
    marginTop: 10,
    marginBottom: 4,
  },
  modalMeta: {
    fontSize: 11,
    color: "#9CA3AF",
    marginBottom: 2,
  },
  modalButtonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    gap: 8,
  },
  modalButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  modalButtonPrimary: {
    backgroundColor: "#2563EB",
  },
  modalButtonSecondary: {
    backgroundColor: "#374151",
  },
  modalButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  modalDeleteButton: {
    marginTop: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#DC2626",
    paddingVertical: 8,
    alignItems: "center",
  },
  modalDeleteText: {
    color: "#FCA5A5",
    fontSize: 13,
    fontWeight: "600",
  },
  modalCloseButton: {
    marginTop: 10,
    paddingVertical: 8,
    alignItems: "center",
  },
  modalCloseText: {
    color: "#9CA3AF",
    fontSize: 13,
  },
  // Photos
  photosRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  addPhotoButton: {
    backgroundColor: "#111827",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#4B5563",
  },
  addPhotoButtonText: {
    color: "#E5E7EB",
    fontSize: 12,
    fontWeight: "600",
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GRID_GAP,
    marginBottom: 10,
  },
  photoWrapper: {
    position: "relative",
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#020617",
  },
  photoThumb: {
    width: "100%",
    height: "100%",
  },
  photoRemoveButton: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 10,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  photoRemoveText: {
    color: "#FCA5A5",
    fontSize: 10,
    fontWeight: "700",
  },
  photoMoreOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
  },
  photoMoreText: {
    color: "#F9FAFB",
    fontSize: 14,
    fontWeight: "700",
  },
  // Trash modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#020617",
    padding: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "85%",
  },
  trashCard: {
    backgroundColor: "#111827",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  trashTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#F9FAFB",
    marginBottom: 2,
  },
  trashAddress: {
    fontSize: 13,
    color: "#9CA3AF",
    marginBottom: 2,
  },
  trashClient: {
    fontSize: 12,
    color: "#E5E7EB",
    marginBottom: 2,
  },
  trashDate: {
    fontSize: 11,
    color: "#6B7280",
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
  trashRestore: {
    borderColor: "#16A34A",
  },
  trashDeleteForever: {
    borderColor: "#DC2626",
  },
  trashRestoreText: {
    fontSize: 11,
    color: "#BBF7D0",
    fontWeight: "600",
  },
  trashDeleteText: {
    fontSize: 11,
    color: "#FCA5A5",
    fontWeight: "600",
  },
  // Fullscreen image overlay with swipe (old style – now handled by ImageViewing)
  fullImageOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 0,
  },
  fullImageInner: {
    width: "100%",
    alignItems: "center",
  },
  fullImagePage: {
    width: screenWidth,
    justifyContent: "center",
    alignItems: "center",
  },
  fullImage: {
    width: "100%",
    height: "75%",
    borderRadius: 12,
  },
  fullImageCounter: {
    marginTop: 8,
    color: "#E5E7EB",
    fontSize: 12,
  },
  fullImageCloseButton: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#4B5563",
  },
  fullImageCloseText: {
    color: "#E5E7EB",
    fontSize: 13,
    fontWeight: "600",
  },
  // Add Photo bottom sheet
  addPhotoMenuOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    justifyContent: "flex-end",
  },
  addPhotoMenuBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  addPhotoMenuSheet: {
    backgroundColor: "#020617",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  addPhotoMenuTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#E5E7EB",
    marginBottom: 8,
    textAlign: "center",
  },
  addPhotoMenuOption: {
    backgroundColor: "#111827",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#374151",
  },
  addPhotoMenuOptionText: {
    color: "#F9FAFB",
    fontSize: 14,
    textAlign: "center",
  },
  addPhotoMenuCancel: {
    marginTop: 4,
    paddingVertical: 8,
  },
  addPhotoMenuCancelText: {
    color: "#9CA3AF",
    fontSize: 13,
    textAlign: "center",
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
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#374151",
    marginRight: 4,
  },
  settingsButtonText: {
    fontSize: 11,
    color: "#E5E7EB",
    fontWeight: "500",
  },
  summaryRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: "#111827",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#1F2937",
  },
  summaryCardActive: {
    borderColor: "#2563EB",
    backgroundColor: "#020617",
  },

  summaryCardWide: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 11,
    color: "#9CA3AF",
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#F9FAFB",
  },
  summaryHint: {
    marginTop: 2,
    fontSize: 10,
    color: "#6B7280",
  },
});
