// app/home.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";

type Job = {
  id: string;
  title: string;
  address: string;
  description: string;
  createdAt: string; // ISO string
  isDone: boolean;
};

const initialJobs: Job[] = [
  {
    id: "1",
    title: "Panel Upgrade - 100A to 200A",
    address: "123 Main St, Brooklyn, NY",
    description: "Replace existing 100A panel with 200A, label circuits.",
    createdAt: "2025-11-10T10:00:00Z",
    isDone: false,
  },
  {
    id: "2",
    title: "Troubleshoot Lights Flickering",
    address: "456 5th Ave, Manhattan, NY",
    description: "Check loose neutrals, dimmers, shared circuits.",
    createdAt: "2025-11-12T14:30:00Z",
    isDone: false,
  },
  {
    id: "3",
    title: "Install Tesla Wall Charger",
    address: "789 Ocean Pkwy, Brooklyn, NY",
    description: "Run dedicated circuit, mount charger, test load.",
    createdAt: "2025-11-13T09:15:00Z",
    isDone: false,
  },
];

const sortOptions = ["Newest", "Oldest", "A-Z", "Z-A"] as const;
type SortOption = (typeof sortOptions)[number];

const STORAGE_KEYS = {
  JOBS: "EJT_JOBS",
  TRASH: "EJT_TRASH",
  SORT: "EJT_SORT_OPTION",
};

const HomeScreen: React.FC = () => {
  // MAIN JOB DATA
  const [jobs, setJobs] = useState<Job[]>(initialJobs);
  const [trashJobs, setTrashJobs] = useState<Job[]>([]);

  // UI state
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>("Newest");
  const [isSortMenuVisible, setIsSortMenuVisible] = useState(false);

  // Add Job form
  const [isAddFormVisible, setIsAddFormVisible] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newDescription, setNewDescription] = useState("");

  // Job Details screen
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isDetailsVisible, setIsDetailsVisible] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editDescription, setEditDescription] = useState("");

  // Trash modal
  const [isTrashVisible, setIsTrashVisible] = useState(false);

  // Hydration flag (so we don't save before loading from storage)
  const [isHydrated, setIsHydrated] = useState(false);

  // ---------- SORT + FILTER ----------

  const handleSelectSort = (option: SortOption) => {
    setSortOption(option);
    setIsSortMenuVisible(false);
  };

  const visibleJobs = useMemo(() => {
    let data = [...jobs];

    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase();
      data = data.filter(
        (job) =>
          job.title.toLowerCase().includes(q) ||
          job.address.toLowerCase().includes(q) ||
          job.description.toLowerCase().includes(q)
      );
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
  }, [jobs, searchQuery, sortOption]);

  // ---------- ADD JOB ----------

  const handleAddNewJobPress = () => {
    setIsAddFormVisible((prev) => !prev);
    Keyboard.dismiss();
  };

  const handleSaveNewJob = () => {
    if (!newTitle.trim()) return;

    const job: Job = {
      id: Date.now().toString(),
      title: newTitle.trim(),
      address: newAddress.trim() || "N/A",
      description:
        newDescription.trim() || "No description / scope of work added.",
      createdAt: new Date().toISOString(),
      isDone: false,
    };

    setJobs((prev) => [...prev, job]);
    setNewTitle("");
    setNewAddress("");
    setNewDescription("");
    setIsAddFormVisible(false);
    Keyboard.dismiss();
    Alert.alert("Job saved", "New job has been added.");
  };

  // ---------- JOB DETAILS ----------

  const openJobDetails = (job: Job) => {
    setSelectedJob(job);
    setEditTitle(job.title);
    setEditAddress(job.address);
    setEditDescription(job.description);
    setIsDetailsVisible(true);
    Keyboard.dismiss();
  };

  const closeJobDetails = () => {
    setIsDetailsVisible(false);
    setSelectedJob(null);
    Keyboard.dismiss();
  };

  const handleSaveJobEdits = () => {
    if (!selectedJob) return;

    const updated: Job = {
      ...selectedJob,
      title: editTitle.trim() || selectedJob.title,
      address: editAddress.trim() || selectedJob.address,
      description: editDescription.trim() || selectedJob.description,
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

  // ---------- TRASH / DELETE ----------

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
            setTrashJobs((prev) => prev.filter((j) => j.id !== id));
          },
        },
      ]
    );
  };

  // ---------- ASYNC STORAGE: LOAD ----------

  useEffect(() => {
    const loadData = async () => {
      try {
        const [[, jobsJson], [, trashJson], [, sortJson]] =
          await AsyncStorage.multiGet([
            STORAGE_KEYS.JOBS,
            STORAGE_KEYS.TRASH,
            STORAGE_KEYS.SORT,
          ]);

        if (jobsJson) {
          setJobs(JSON.parse(jobsJson));
        }

        if (trashJson) {
          setTrashJobs(JSON.parse(trashJson));
        }

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
  }, []);

  // ---------- ASYNC STORAGE: SAVE ----------

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

  // ---------- RENDER ----------

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.container}>
        {/* Header row with title + Trash button */}
        <View style={styles.headerRow}>
          <Text style={styles.header}>TESTING HOME SCREEN 999</Text>
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

        {/* Search + Sort Row */}
        <View style={styles.controlsRow}>
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search jobs..."
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

        {/* Add New Job button */}
        <TouchableOpacity
          style={styles.addJobButton}
          onPress={handleAddNewJobPress}
          activeOpacity={0.9}
        >
          <Text style={styles.addJobButtonText}>
            {isAddFormVisible ? "Cancel" : "Add New Job"}
          </Text>
        </TouchableOpacity>

        {/* Add Job form */}
        {isAddFormVisible && (
          <View style={styles.addForm}>
            <Text style={styles.addFormLabel}>Job Title</Text>
            <TextInput
              style={styles.addFormInput}
              placeholder="Ex: Replace panel in basement"
              placeholderTextColor="#6B7280"
              value={newTitle}
              onChangeText={setNewTitle}
              returnKeyType="next"
            />

            <Text style={styles.addFormLabel}>Address</Text>
            <TextInput
              style={styles.addFormInput}
              placeholder="Ex: 123 Main St, Brooklyn, NY"
              placeholderTextColor="#6B7280"
              value={newAddress}
              onChangeText={setNewAddress}
              returnKeyType="next"
            />

            <Text style={styles.addFormLabel}>Description / Scope of Work</Text>
            <TextInput
              style={styles.addFormInputMultiline}
              placeholder="Ex: Replace main panel, add AFCI breakers, label circuits..."
              placeholderTextColor="#6B7280"
              value={newDescription}
              onChangeText={setNewDescription}
              multiline
            />

            <TouchableOpacity
              style={styles.saveJobButton}
              onPress={handleSaveNewJob}
              activeOpacity={0.9}
            >
              <Text style={styles.saveJobButtonText}>Save Job</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Job list */}
        <FlatList
          data={visibleJobs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => openJobDetails(item)}
              activeOpacity={0.9}
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
                  {item.isDone && <Text style={styles.doneBadge}>Done</Text>}
                </View>

                <Text
                  style={[
                    styles.jobAddress,
                    item.isDone && styles.jobTextDone,
                  ]}
                >
                  {item.address}
                </Text>
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
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No jobs match your search.</Text>
          }
        />

        {/* FULL-SCREEN Job Details */}
        <Modal
          visible={isDetailsVisible}
          animationType="slide"
          transparent={false}
          onRequestClose={closeJobDetails}
        >
          <KeyboardAvoidingView
            style={{ flex: 1, backgroundColor: "#020617" }} // 🔥 no white gap
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={32}
          >
            <TouchableWithoutFeedback
              onPress={Keyboard.dismiss}
              accessible={false}
            >
              <View style={styles.detailsScreen}>
                <ScrollView
                  contentContainerStyle={styles.detailsScroll}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
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

                  <Text style={styles.modalLabel}>Description / Scope</Text>
                  <TextInput
                    style={styles.modalInputMultiline}
                    value={editDescription}
                    onChangeText={setEditDescription}
                    multiline
                    placeholderTextColor="#6B7280"
                  />

                  {selectedJob && (
                    <>
                      <Text style={styles.modalMeta}>
                        Created:{" "}
                        {new Date(selectedJob.createdAt).toLocaleString()}
                      </Text>
                      <Text style={styles.modalMeta}>
                        Status: {selectedJob.isDone ? "Done" : "Open"}
                      </Text>
                    </>
                  )}

                  <View style={styles.modalButtonRow}>
                    <TouchableOpacity
                      style={[
                        styles.modalButton,
                        selectedJob?.isDone
                          ? styles.modalButtonSecondary
                          : styles.modalButtonPrimary,
                      ]}
                      onPress={handleToggleDoneInDetails}
                    >
                      <Text style={styles.modalButtonText}>
                        {selectedJob?.isDone
                          ? "Mark as Not Done"
                          : "Mark as Done"}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.modalButton, styles.modalButtonPrimary]}
                      onPress={handleSaveJobEdits}
                    >
                      <Text style={styles.modalButtonText}>Save Changes</Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={styles.modalDeleteButton}
                    onPress={confirmMoveToTrash}
                  >
                    <Text style={styles.modalDeleteText}>Move to Trash</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.modalCloseButton}
                    onPress={closeJobDetails}
                  >
                    <Text style={styles.modalCloseText}>Close</Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </Modal>

        {/* Trash Modal (bottom sheet) */}
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
                          <Text style={styles.trashTitle}>{item.title}</Text>
                          <Text style={styles.trashAddress}>
                            {item.address}
                          </Text>
                          <Text style={styles.trashDate}>
                            {new Date(item.createdAt).toLocaleString()}
                          </Text>

                          <View style={styles.trashButtonRow}>
                            <TouchableOpacity
                              style={[
                                styles.trashActionButton,
                                styles.trashRestore,
                              ]}
                              onPress={() => handleRestoreFromTrash(item.id)}
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
                              onPress={() => handleDeleteForever(item.id)}
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
  jobAddress: {
    fontSize: 13,
    color: "#9CA3AF",
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
  // FULL-SCREEN DETAILS
  detailsScreen: {
    flex: 1,
    backgroundColor: "#020617",
    paddingTop: 56, // 🔥 push content below status bar
  },
  detailsScroll: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  // Bottom-sheet modal (Trash)
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
  // Trash cards
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
});
