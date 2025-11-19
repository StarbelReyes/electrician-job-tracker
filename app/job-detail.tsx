// app/job-detail.tsx
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
  LayoutAnimation,
  Linking,
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

// 👇 Job shape must match home.tsx / add-job.tsx
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

  // pricing
  laborHours?: number;
  hourlyRate?: number;
  materialCost?: number;
};

const STORAGE_KEYS = {
  JOBS: "EJT_JOBS",
  TRASH: "EJT_TRASH",
};

const GRID_COLUMNS = 3;
const GRID_HORIZONTAL_PADDING = 16 * 2;
const GRID_GAP = 8;
const THUMB_SIZE =
  (360 - GRID_HORIZONTAL_PADDING - GRID_GAP * (GRID_COLUMNS - 1)) /
  GRID_COLUMNS; // 360 ≈ phone width; works fine visually

export default function JobDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [job, setJob] = useState<Job | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Editable fields
  const [editTitle, setEditTitle] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editClientName, setEditClientName] = useState("");
  const [editClientPhone, setEditClientPhone] = useState("");
  const [editClientNotes, setEditClientNotes] = useState("");
  const [isDone, setIsDone] = useState(false);

  const [laborHours, setLaborHours] = useState<string>("");
  const [hourlyRate, setHourlyRate] = useState<string>("");
  const [materialCost, setMaterialCost] = useState<string>("");

  const [photoUris, setPhotoUris] = useState<string[]>([]);

  // 🔹 Scroll + keyboard handling (unified like add-job)
  const scrollRef = useRef<ScrollView | null>(null);
  const sectionPositions = useRef<Record<string, number>>({});

  const registerSection = (key: string, y: number) => {
    sectionPositions.current[key] = y;
  };

  const scrollToSection = (key: string) => {
    const y = sectionPositions.current[key];
    if (scrollRef.current != null && y !== undefined) {
      scrollRef.current.scrollTo({
        y: Math.max(y - 80, 0),
        animated: true,
      });
    }
  };

  // Photos: full-screen + bottom sheet
  const [isImageOverlayVisible, setIsImageOverlayVisible] = useState(false);
  const [fullImageIndex, setFullImageIndex] = useState(0);
  const [isAddPhotoMenuVisible, setIsAddPhotoMenuVisible] = useState(false);

  // Button animations
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

  // 🔹 Screen zoom (same vibe as Home: 1.04 → 1.0)
  const screenScale = useRef(new Animated.Value(1.04)).current;

  useEffect(() => {
    Animated.timing(screenScale, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [screenScale]);

  // ---------- Load job from storage ----------
  useEffect(() => {
    if (!id) {
      setIsLoading(false);
      return;
    }

    const loadJob = async () => {
      try {
        const jobsJson = await AsyncStorage.getItem(STORAGE_KEYS.JOBS);
        if (!jobsJson) {
          setIsLoading(false);
          return;
        }
        const jobs: Job[] = JSON.parse(jobsJson);
        const found = jobs.find((j) => j.id === id);
        if (found) {
          setJob(found);
          // prime edit fields
          setEditTitle(found.title);
          setEditAddress(found.address);
          setEditDescription(found.description);
          setEditClientName(found.clientName || "");
          setEditClientPhone(found.clientPhone || "");
          setEditClientNotes(found.clientNotes || "");
          setIsDone(found.isDone);

          setLaborHours(
            found.laborHours !== undefined ? String(found.laborHours) : ""
          );
          setHourlyRate(
            found.hourlyRate !== undefined ? String(found.hourlyRate) : ""
          );
          setMaterialCost(
            found.materialCost !== undefined ? String(found.materialCost) : ""
          );
          setPhotoUris(found.photoUris || []);
        }
      } catch (e) {
        console.warn("Failed to load job:", e);
      } finally {
        setIsLoading(false);
      }
    };

    loadJob();
  }, [id]);

  // ---------- Helpers ----------
  const parseNumber = (value: string) => {
    const n = Number(value.replace(/[^0-9.]/g, ""));
    return Number.isNaN(n) ? 0 : n;
  };

  const totalAmount =
    parseNumber(laborHours) * parseNumber(hourlyRate) +
    parseNumber(materialCost);

  const persistJobs = async (updatedJobs: Job[]) => {
    await AsyncStorage.setItem(STORAGE_KEYS.JOBS, JSON.stringify(updatedJobs));
  };

  // ---------- Actions ----------
  const handleSaveJobEdits = async () => {
    if (!job) return;

    const updated: Job = {
      ...job,
      title: editTitle.trim() || job.title,
      address: editAddress.trim() || job.address,
      description: editDescription.trim() || job.description,
      clientName: editClientName.trim() || undefined,
      clientPhone: editClientPhone.trim() || undefined,
      clientNotes: editClientNotes.trim() || undefined,
      isDone,
      laborHours: parseNumber(laborHours),
      hourlyRate: parseNumber(hourlyRate),
      materialCost: parseNumber(materialCost),
      photoUris,
    };

    try {
      const jobsJson = await AsyncStorage.getItem(STORAGE_KEYS.JOBS);
      const jobs: Job[] = jobsJson ? JSON.parse(jobsJson) : [];
      const next = jobs.map((j) => (j.id === job.id ? updated : j));

      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      await persistJobs(next);
      setJob(updated);

      Alert.alert("Saved", "Job details updated.", [
        {
          text: "OK",
          onPress: () => router.back(),
        },
      ]);
    } catch (e) {
      console.warn("Failed to save job:", e);
      Alert.alert("Error", "Could not save changes. Try again.");
    }
  };

  const handleToggleDone = async () => {
    if (!job) return;
    const nextDone = !isDone;
    setIsDone(nextDone);

    try {
      const jobsJson = await AsyncStorage.getItem(STORAGE_KEYS.JOBS);
      const jobs: Job[] = jobsJson ? JSON.parse(jobsJson) : [];
      const next = jobs.map((j) =>
        j.id === job.id ? { ...j, isDone: nextDone } : j
      );

      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      await persistJobs(next);
      setJob((prev) => (prev ? { ...prev, isDone: nextDone } : prev));
    } catch (e) {
      console.warn("Failed to toggle done:", e);
    }
  };

  const handleCallClient = () => {
    const raw = editClientPhone.trim();
    if (!raw) {
      Alert.alert("No phone number", "Add a client phone number first.");
      return;
    }

    const phone = raw.replace(/[^\d+]/g, "");
    if (!phone) {
      Alert.alert("Invalid phone", "The client phone number looks invalid.");
      return;
    }

    Linking.openURL(`tel:${phone}`).catch(() => {
      Alert.alert("Error", "Could not open the phone app.");
    });
  };

  const handleOpenInMaps = () => {
    const rawAddress = editAddress.trim();
    if (!rawAddress) {
      Alert.alert("No address", "Add a job address first.");
      return;
    }

    const encoded = encodeURIComponent(rawAddress);
    const url = `https://www.google.com/maps/search/?api=1&query=${encoded}`;

    Linking.openURL(url).catch(() => {
      Alert.alert("Error", "Could not open the Maps app.");
    });
  };

  const confirmMoveToTrash = () => {
    if (!job) return;

    Alert.alert(
      "Move to Trash",
      "Are you sure you want to move this job to Trash?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Move",
          style: "destructive",
          onPress: async () => {
            try {
              const [jobsJson, trashJson] = await Promise.all([
                AsyncStorage.getItem(STORAGE_KEYS.JOBS),
                AsyncStorage.getItem(STORAGE_KEYS.TRASH),
              ]);

              const jobs: Job[] = jobsJson ? JSON.parse(jobsJson) : [];
              const trash: Job[] = trashJson ? JSON.parse(trashJson) : [];

              const remaining = jobs.filter((j) => j.id !== job.id);
              const newTrash = [...trash, job];

              LayoutAnimation.configureNext(
                LayoutAnimation.Presets.easeInEaseOut
              );
              await Promise.all([
                AsyncStorage.setItem(
                  STORAGE_KEYS.JOBS,
                  JSON.stringify(remaining)
                ),
                AsyncStorage.setItem(
                  STORAGE_KEYS.TRASH,
                  JSON.stringify(newTrash)
                ),
              ]);

              router.back();
            } catch (e) {
              console.warn("Failed to move to trash:", e);
              Alert.alert("Error", "Could not move job to Trash.");
            }
          },
        },
      ]
    );
  };

  // ---------- Photos ----------
  const handleAddPhotoToLocal = (uri: string) => {
    setPhotoUris((prev) => {
      const next = [...prev, uri];
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      return next;
    });
  };

  const handleAddPhotoFromGallery = async () => {
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
      allowsMultipleSelection: true, // allow multi like Add Job
      quality: 0.7,
    });

    if (result.canceled || !result.assets?.length) return;

    const uris = result.assets
      .map((asset) => asset.uri)
      .filter(Boolean) as string[];

    setPhotoUris((prev) => {
      const next = [...prev, ...uris];
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      return next;
    });
  };

  const handleAddPhotoFromCamera = async () => {
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

    handleAddPhotoToLocal(uri);
  };

  const handleRemovePhoto = (uriToRemove: string) => {
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
            setPhotoUris((prev) => prev.filter((u) => u !== uriToRemove));
          },
        },
      ]
    );
  };

  const handleOpenFullImage = (index: number) => {
    setFullImageIndex(index);
    setIsImageOverlayVisible(true);
  };

  // ---------- Render states ----------
  if (isLoading) {
    return (
      <View style={styles.loadingScreen}>
        <Text style={styles.loadingText}>Loading job…</Text>
      </View>
    );
  }

  if (!job) {
    return (
      <View style={styles.loadingScreen}>
        <Text style={styles.loadingText}>Job not found.</Text>
        <TouchableOpacity
          style={styles.simpleButton}
          onPress={() => router.back()}
        >
          <Text style={styles.simpleButtonText}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#020617" }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 20 : 0}
    >
      <Animated.View
        style={[
          styles.detailsScreen,
          { transform: [{ scale: screenScale }] },
        ]}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            activeOpacity={0.8}
          >
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Job Detail</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView
          ref={scrollRef}
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
              {/* Job ID */}
              <View
                onLayout={(e) =>
                  registerSection("jobId", e.nativeEvent.layout.y)
                }
              >
                <Text style={styles.sectionTitle}>Job ID</Text>
                <Text style={styles.infoText}>{job.id}</Text>
              </View>

              {/* Title */}
              <View
                onLayout={(e) =>
                  registerSection("title", e.nativeEvent.layout.y)
                }
              >
                <Text style={styles.modalLabel}>Title</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editTitle}
                  onChangeText={setEditTitle}
                  placeholderTextColor="#6B7280"
                  onFocus={() => scrollToSection("title")}
                />
              </View>

              {/* Address */}
              <View
                onLayout={(e) =>
                  registerSection("address", e.nativeEvent.layout.y)
                }
              >
                <Text style={styles.modalLabel}>Address</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editAddress}
                  onChangeText={setEditAddress}
                  placeholderTextColor="#6B7280"
                  onFocus={() => scrollToSection("address")}
                />
              </View>

              {/* Description */}
              <View
                onLayout={(e) =>
                  registerSection("description", e.nativeEvent.layout.y)
                }
              >
                <Text style={styles.modalLabel}>Description / Scope</Text>
                <TextInput
                  style={styles.modalInputMultiline}
                  value={editDescription}
                  onChangeText={setEditDescription}
                  multiline
                  placeholderTextColor="#6B7280"
                  onFocus={() => scrollToSection("description")}
                />
              </View>

              {/* Status */}
              <View
                onLayout={(e) =>
                  registerSection("status", e.nativeEvent.layout.y)
                }
              >
                <Text style={styles.sectionTitle}>Status</Text>
                <Text style={styles.infoText}>
                  {isDone ? "Done" : "Open"}
                </Text>

                {/* Quick Actions */}
                <View style={styles.quickActionsRow}>
                  {!!editClientPhone.trim() && (
                    <TouchableOpacity
                      style={styles.quickActionButton}
                      onPress={handleCallClient}
                      activeOpacity={0.9}
                    >
                      <Text style={styles.quickActionText}>📞 Call Client</Text>
                    </TouchableOpacity>
                  )}

                  {!!editAddress.trim() && (
                    <TouchableOpacity
                      style={styles.quickActionButton}
                      onPress={handleOpenInMaps}
                      activeOpacity={0.9}
                    >
                      <Text style={styles.quickActionText}>
                        📍 Open in Maps
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Client Info */}
              <View
                onLayout={(e) =>
                  registerSection("client", e.nativeEvent.layout.y)
                }
              >
                <Text style={styles.sectionTitle}>Client Info</Text>

                <Text style={styles.modalLabel}>Client Name</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editClientName}
                  onChangeText={setEditClientName}
                  placeholder="Client name..."
                  placeholderTextColor="#6B7280"
                  onFocus={() => scrollToSection("client")}
                />

                <Text style={styles.modalLabel}>Client Phone</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editClientPhone}
                  onChangeText={setEditClientPhone}
                  placeholder="Phone number..."
                  placeholderTextColor="#6B7280"
                  keyboardType="phone-pad"
                  onFocus={() => scrollToSection("client")}
                />

                <Text style={styles.modalLabel}>Client Notes</Text>
                <TextInput
                  style={styles.modalInputMultiline}
                  value={editClientNotes}
                  onChangeText={setEditClientNotes}
                  placeholder="Gate codes, timing, special info..."
                  placeholderTextColor="#6B7280"
                  multiline
                  onFocus={() => scrollToSection("client")}
                />
              </View>

              {/* Pricing */}
              <View
                onLayout={(e) =>
                  registerSection("pricing", e.nativeEvent.layout.y)
                }
              >
                <Text style={styles.sectionTitle}>Pricing</Text>

                <View style={styles.pricingCard}>
                  {/* BIG TOTAL at the top */}
                  <View style={styles.pricingTotalHeader}>
                    <Text style={styles.pricingTotalHeaderLabel}>Total</Text>
                    <Text style={styles.pricingTotalHeaderValue}>
                      $
                      {totalAmount.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                      })}
                    </Text>
                  </View>

                  {/* Inputs in a grid */}
                  <View style={styles.pricingInputsRow}>
                    <View style={styles.pricingColumn}>
                      <Text style={styles.modalLabel}>Labor hours</Text>
                      <TextInput
                        style={[styles.modalInput, styles.pricingInput]}
                        value={laborHours}
                        onChangeText={setLaborHours}
                        keyboardType="numeric"
                        placeholder="e.g. 4"
                        placeholderTextColor="#6B7280"
                        onFocus={() => scrollToSection("pricing")}
                      />
                    </View>

                    <View style={styles.pricingColumn}>
                      <Text style={styles.modalLabel}>Hourly rate</Text>
                      <TextInput
                        style={[styles.modalInput, styles.pricingInput]}
                        value={hourlyRate}
                        onChangeText={setHourlyRate}
                        keyboardType="numeric"
                        placeholder="e.g. 125"
                        placeholderTextColor="#6B7280"
                        onFocus={() => scrollToSection("pricing")}
                      />
                    </View>
                  </View>

                  <View style={styles.pricingSingleRow}>
                    <Text style={styles.modalLabel}>Material cost</Text>
                    <TextInput
                      style={[styles.modalInput, styles.pricingInput]}
                      value={materialCost}
                      onChangeText={setMaterialCost}
                      keyboardType="numeric"
                      placeholder="e.g. 300"
                      placeholderTextColor="#6B7280"
                      onFocus={() => scrollToSection("pricing")}
                    />
                  </View>

                  {/* Read-style breakdown */}
                  <View style={styles.pricingSummaryBox}>
                    <View style={styles.pricingSummaryRow}>
                      <Text style={styles.pricingSummaryLabel}>Labor</Text>
                      <Text style={styles.pricingSummaryValue}>
                        {`${parseNumber(
                          laborHours
                        )} h × $${parseNumber(hourlyRate).toLocaleString(
                          "en-US",
                          { minimumFractionDigits: 2 }
                        )}`}
                      </Text>
                    </View>

                    <View style={styles.pricingSummaryRow}>
                      <Text style={styles.pricingSummaryLabel}>Material</Text>
                      <Text style={styles.pricingSummaryValue}>
                        $
                        {parseNumber(materialCost).toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                        })}
                      </Text>
                    </View>

                    <View style={styles.pricingTotalRow}>
                      <Text style={styles.pricingTotalLabel}>Total</Text>
                      <Text style={styles.pricingTotalValue}>
                        $
                        {totalAmount.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                        })}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Photos */}
              <View
                onLayout={(e) =>
                  registerSection("photos", e.nativeEvent.layout.y)
                }
              >
                <Text style={styles.sectionTitle}>Photos</Text>

                <View style={styles.photosRow}>
                  <TouchableOpacity
                    style={styles.addPhotoButton}
                    onPress={() => setIsAddPhotoMenuVisible(true)}
                    activeOpacity={0.9}
                  >
                    <Text style={styles.addPhotoButtonText}>+ Add Photo</Text>
                  </TouchableOpacity>
                </View>

                {photoUris.length > 0 && (
                  <View style={styles.photoGrid}>
                    {photoUris.map((uri, index) => (
                      <View key={uri} style={styles.photoWrapper}>
                        <TouchableOpacity
                          style={{ flex: 1 }}
                          activeOpacity={0.9}
                          onPress={() => handleOpenFullImage(index)}
                        >
                          <Image
                            source={{ uri }}
                            style={styles.photoThumb}
                            resizeMode="cover"
                          />
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.photoRemoveButton}
                          onPress={() => handleRemovePhoto(uri)}
                        >
                          <Text style={styles.photoRemoveText}>X</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              <Text style={styles.modalMeta}>
                Created: {new Date(job.createdAt).toLocaleString()}
              </Text>

              {/* Buttons */}
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
                      isDone
                        ? styles.modalButtonSecondary
                        : styles.modalButtonPrimary,
                    ]}
                    onPress={handleToggleDone}
                    activeOpacity={0.9}
                    onPressIn={markDoneAnim.onPressIn}
                    onPressOut={markDoneAnim.onPressOut}
                  >
                    <Text style={styles.modalButtonText}>
                      {isDone ? "Mark as Not Done" : "Mark as Done"}
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
                    style={[styles.modalButton, styles.modalButtonPrimary]}
                    onPress={handleSaveJobEdits}
                    activeOpacity={0.9}
                    onPressIn={saveChangesAnim.onPressIn}
                    onPressOut={saveChangesAnim.onPressOut}
                  >
                    <Text style={styles.modalButtonText}>Save Changes</Text>
                  </TouchableOpacity>
                </Animated.View>
              </View>

              <TouchableOpacity
                style={styles.modalDeleteButton}
                onPress={confirmMoveToTrash}
              >
                <Text style={styles.modalDeleteText}>Move to Trash</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => router.back()}
              >
                <Text style={styles.modalCloseText}>Close</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </ScrollView>

        {/* Add Photo bottom sheet */}
        {isAddPhotoMenuVisible && (
          <View style={styles.addPhotoMenuOverlay}>
            <TouchableWithoutFeedback
              onPress={() => setIsAddPhotoMenuVisible(false)}
            >
              <View style={styles.addPhotoMenuBackdrop} />
            </TouchableWithoutFeedback>

            <View style={styles.addPhotoMenuSheet}>
              <Text style={styles.addPhotoMenuTitle}>Add Photo</Text>

              <TouchableOpacity
                style={styles.addPhotoMenuOption}
                onPress={() => {
                  setIsAddPhotoMenuVisible(false);
                  handleAddPhotoFromCamera();
                }}
                activeOpacity={0.9}
              >
                <Text style={styles.addPhotoMenuOptionText}>📸 Take Photo</Text>
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
                onPress={() => setIsAddPhotoMenuVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.addPhotoMenuCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Fullscreen viewer */}
        {photoUris.length > 0 && (
          <ImageViewing
            images={photoUris.map((uri) => ({ uri }))}
            imageIndex={fullImageIndex}
            visible={isImageOverlayVisible}
            onRequestClose={() => setIsImageOverlayVisible(false)}
            swipeToCloseEnabled
            doubleTapToZoomEnabled
            backgroundColor="rgba(0,0,0,0.95)"
          />
        )}
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    backgroundColor: "#020617",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: "#E5E7EB",
    fontSize: 16,
  },
  simpleButton: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#2563EB",
  },
  simpleButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },

  detailsScreen: {
    flex: 1,
    backgroundColor: "#020617",
    paddingTop: 56,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  backButton: {
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  backText: {
    color: "#9CA3AF",
    fontSize: 14,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#F9FAFB",
  },
  detailsScroll: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    color: "#E5E7EB",
    fontWeight: "700",
    marginTop: 10,
    marginBottom: 4,
  },
  infoText: {
    fontSize: 13,
    color: "#E5E7EB",
    marginBottom: 8,
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
    marginBottom: 6,
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

  // Pricing card
  pricingCard: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  pricingTotalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 4,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  pricingTotalHeaderLabel: {
    fontSize: 13,
    color: "#9CA3AF",
    fontWeight: "600",
  },
  pricingTotalHeaderValue: {
    fontSize: 18,
    color: "#FCD34D",
    fontWeight: "800",
  },
  pricingInputsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  pricingColumn: {
    flex: 1,
  },
  pricingInput: {
    marginBottom: 8,
  },
  pricingSingleRow: {
    marginTop: 4,
    marginBottom: 6,
  },
  pricingSummaryBox: {
    marginTop: 6,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
  },
  pricingSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  pricingSummaryLabel: {
    fontSize: 12,
    color: "#9CA3AF",
    fontWeight: "500",
  },
  pricingSummaryValue: {
    fontSize: 12,
    color: "#F3F4F6",
    fontWeight: "600",
  },
  pricingTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.12)",
  },
  pricingTotalLabel: {
    fontSize: 13,
    color: "#F9FAFB",
    fontWeight: "700",
  },
  pricingTotalValue: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FCD34D",
  },

  quickActionsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
    marginBottom: 8,
  },
  quickActionButton: {
    flex: 1,
    backgroundColor: "#111827",
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#374151",
    alignItems: "center",
    justifyContent: "center",
  },
  quickActionText: {
    fontSize: 12,
    color: "#E5E7EB",
    fontWeight: "600",
  },
});
