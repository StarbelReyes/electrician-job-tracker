// app/add-job.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  Image,
  Keyboard,
  KeyboardAvoidingView,
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

const JOBS_STORAGE_KEY = "EJT_JOBS";

const screenWidth = Dimensions.get("window").width;
const GRID_COLUMNS = 3;
const GRID_HORIZONTAL_PADDING = 16 * 2;
const GRID_GAP = 8;
const MAX_THUMBS_TO_SHOW = 6;

const THUMB_SIZE =
  (screenWidth - GRID_HORIZONTAL_PADDING - GRID_GAP * (GRID_COLUMNS - 1)) /
  GRID_COLUMNS;

export default function AddJobScreen() {
  const router = useRouter();

  // MAIN FIELDS
  const [title, setTitle] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");

  // CLIENT
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientNotes, setClientNotes] = useState("");

  // PRICING
  const [laborHours, setLaborHours] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [materialCost, setMaterialCost] = useState("");

  // PHOTOS
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [isAddPhotoMenuVisible, setIsAddPhotoMenuVisible] = useState(false);

  // ---- DERIVED TOTALS (for pricing card) ----
  const hoursNum = parseFloat(laborHours) || 0;
  const rateNum = parseFloat(hourlyRate) || 0;
  const materialNum = parseFloat(materialCost) || 0;

  const laborTotal = hoursNum * rateNum;
  const total = laborTotal + materialNum;

  // 🔹 Scroll + keyboard handling (same pattern as Job Detail)
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

  // 🔹 Screen zoom (same vibe as Home / Job Detail: 1.04 → 1.0)
  const screenScale = useRef(new Animated.Value(1.04)).current;

  useEffect(() => {
    Animated.timing(screenScale, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [screenScale]);

  // ---- MAPS ----
  const handleOpenInMaps = () => {
    const q = address.trim();
    if (!q) {
      Alert.alert("Address needed", "Enter the job address first.");
      return;
    }

    const encoded = encodeURIComponent(q);
    const url = Platform.select({
      ios: `http://maps.apple.com/?q=${encoded}`,
      android: `geo:0,0?q=${encoded}`,
      default: `https://www.google.com/maps/search/?api=1&query=${encoded}`,
    });

    if (url) Linking.openURL(url).catch(() => {});
  };

  // ---- PHOTOS ----
  const handleAddPhotoToState = (uri: string) => {
    setPhotoUris((prev) => [...prev, uri]);
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
      allowsMultipleSelection: true,
      quality: 0.7,
    });

    if (result.canceled || !result.assets?.length) return;

    const uris = result.assets
      .map((asset) => asset.uri)
      .filter(Boolean) as string[];

    setPhotoUris((prev) => [...prev, ...uris]);
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

    handleAddPhotoToState(uri);
  };

  const handleRemovePhoto = (uriToRemove: string) => {
    setPhotoUris((prev) => prev.filter((u) => u !== uriToRemove));
  };

  // ---- SAVE JOB ----
  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert("Missing title", "Please enter a job title.");
      return;
    }

    const newJob: Job = {
      id: Date.now().toString(),
      title: title.trim(),
      address: address.trim() || "N/A",
      description:
        description.trim() || "No description / scope of work added.",
      createdAt: new Date().toISOString(),
      isDone: false,
      clientName: clientName.trim() || undefined,
      clientPhone: clientPhone.trim() || undefined,
      clientNotes: clientNotes.trim() || undefined,
      photoUris,
      laborHours: hoursNum,
      hourlyRate: rateNum,
      materialCost: materialNum,
    };

    try {
      const existingJson = await AsyncStorage.getItem(JOBS_STORAGE_KEY);
      const existing: Job[] = existingJson ? JSON.parse(existingJson) : [];

      const updated = [...existing, newJob];
      await AsyncStorage.setItem(JOBS_STORAGE_KEY, JSON.stringify(updated));

      router.back();
    } catch (err) {
      console.warn("Failed to save new job:", err);
      Alert.alert(
        "Error",
        "Something went wrong while saving the job. Please try again."
      );
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#020617" }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 20 : 0}
    >
      <Animated.View
        style={[styles.detailsScreen, { transform: [{ scale: screenScale }] }]}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.detailsScroll}
            keyboardShouldPersistTaps="handled"
            onScrollBeginDrag={Keyboard.dismiss}
            showsVerticalScrollIndicator={false}
          >
            {/* TITLE */}
            <View
              onLayout={(e) =>
                registerSection("title", e.nativeEvent.layout.y)
              }
            >
              <Text style={styles.modalTitle}>Add New Job</Text>

              <Text style={styles.modalLabel}>Job Title</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Ex: Replace panel in basement"
                placeholderTextColor="#6B7280"
                value={title}
                onChangeText={setTitle}
                returnKeyType="next"
                onFocus={() => scrollToSection("title")}
              />
            </View>

            {/* ADDRESS + DESCRIPTION */}
            <View
              onLayout={(e) =>
                registerSection("address", e.nativeEvent.layout.y)
              }
            >
              <Text style={styles.modalLabel}>Address</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Ex: 123 Main St, Brooklyn, NY"
                placeholderTextColor="#6B7280"
                value={address}
                onChangeText={setAddress}
                returnKeyType="next"
                onFocus={() => scrollToSection("address")}
              />
            </View>

            <View
              onLayout={(e) =>
                registerSection("description", e.nativeEvent.layout.y)
              }
            >
              <Text style={styles.modalLabel}>Description / Scope</Text>
              <TextInput
                style={styles.modalInputMultiline}
                placeholder="Ex: Replace main panel, add AFCI breakers, label circuits..."
                placeholderTextColor="#6B7280"
                value={description}
                onChangeText={setDescription}
                multiline
                onFocus={() => scrollToSection("description")}
              />
            </View>

            {/* STATUS + MAPS */}
            <View
              onLayout={(e) =>
                registerSection("status", e.nativeEvent.layout.y)
              }
            >
              <Text style={styles.detailsSectionTitle}>Status</Text>
              <Text style={styles.statusValue}>Open</Text>

              <TouchableOpacity
                style={styles.mapButton}
                onPress={handleOpenInMaps}
                activeOpacity={0.9}
              >
                <Text style={styles.mapPin}>📍</Text>
                <Text style={styles.mapButtonText}>Open in Maps</Text>
              </TouchableOpacity>
            </View>

            {/* CLIENT INFO */}
            <View
              onLayout={(e) =>
                registerSection("clientName", e.nativeEvent.layout.y)
              }
            >
              <Text style={styles.detailsSectionTitle}>Client Info</Text>

              <Text style={styles.modalLabel}>Client Name</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Client name..."
                placeholderTextColor="#6B7280"
                value={clientName}
                onChangeText={setClientName}
                returnKeyType="next"
                onFocus={() => scrollToSection("clientName")}
              />
            </View>

            <View
              onLayout={(e) =>
                registerSection("clientPhone", e.nativeEvent.layout.y)
              }
            >
              <Text style={styles.modalLabel}>Client Phone</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Phone number..."
                placeholderTextColor="#6B7280"
                value={clientPhone}
                onChangeText={setClientPhone}
                keyboardType="phone-pad"
                returnKeyType="next"
                onFocus={() => scrollToSection("clientPhone")}
              />
            </View>

            <View
              onLayout={(e) =>
                registerSection("clientNotes", e.nativeEvent.layout.y)
              }
            >
              <Text style={styles.modalLabel}>Client Notes</Text>
              <TextInput
                style={styles.modalInputMultiline}
                placeholder="Gate codes, timing, special info..."
                placeholderTextColor="#6B7280"
                value={clientNotes}
                onChangeText={setClientNotes}
                multiline
                onFocus={() => scrollToSection("clientNotes")}
              />
            </View>

            {/* PRICING CARD */}
            <View
              onLayout={(e) =>
                registerSection("pricing", e.nativeEvent.layout.y)
              }
            >
              <Text style={styles.detailsSectionTitle}>Pricing</Text>

              <View style={styles.pricingCard}>
                <View style={styles.pricingHeaderRow}>
                  <Text style={styles.pricingHeaderLabel}>Total</Text>
                  <Text style={styles.pricingHeaderValue}>
                    ${total.toFixed(2)}
                  </Text>
                </View>

                <View style={styles.pricingInputsRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalLabel}>Labor hours</Text>
                    <TextInput
                      style={styles.modalInput}
                      placeholder="0"
                      placeholderTextColor="#6B7280"
                      value={laborHours}
                      onChangeText={setLaborHours}
                      keyboardType="numeric"
                      returnKeyType="next"
                      onFocus={() => scrollToSection("pricing")}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalLabel}>Hourly rate</Text>
                    <TextInput
                      style={styles.modalInput}
                      placeholder="0"
                      placeholderTextColor="#6B7280"
                      value={hourlyRate}
                      onChangeText={setHourlyRate}
                      keyboardType="numeric"
                      returnKeyType="next"
                      onFocus={() => scrollToSection("pricing")}
                    />
                  </View>
                </View>

                <Text style={styles.modalLabel}>Material cost</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="0"
                  placeholderTextColor="#6B7280"
                  value={materialCost}
                  onChangeText={setMaterialCost}
                  keyboardType="numeric"
                  returnKeyType="done"
                  onFocus={() => scrollToSection("pricing")}
                />

                <View style={styles.pricingBreakdownRow}>
                  <Text style={styles.pricingBreakdownLabel}>Labor</Text>
                  <Text style={styles.pricingBreakdownValue}>
                    {hoursNum} h × ${rateNum.toFixed(2)}
                  </Text>
                </View>

                <View style={styles.pricingBreakdownRow}>
                  <Text style={styles.pricingBreakdownLabel}>Material</Text>
                  <Text style={styles.pricingBreakdownValue}>
                    ${materialNum.toFixed(2)}
                  </Text>
                </View>

                <View style={styles.pricingDivider} />

                <View style={styles.pricingBreakdownRow}>
                  <Text
                    style={[
                      styles.pricingBreakdownLabel,
                      styles.pricingTotalLabel,
                    ]}
                  >
                    Total
                  </Text>
                  <Text
                    style={[
                      styles.pricingBreakdownValue,
                      styles.pricingTotalValue,
                    ]}
                  >
                    ${total.toFixed(2)}
                  </Text>
                </View>
              </View>
            </View>

            {/* PHOTOS */}
            <View
              onLayout={(e) =>
                registerSection("photos", e.nativeEvent.layout.y)
              }
            >
              <Text style={styles.detailsSectionTitle}>Photos</Text>

              <View style={styles.photosRow}>
                <TouchableOpacity
                  style={styles.addPhotoButton}
                  onPress={() => {
                    scrollToSection("photos");
                    setIsAddPhotoMenuVisible(true);
                  }}
                  activeOpacity={0.9}
                >
                  <Text style={styles.addPhotoButtonText}>+ Add Photo</Text>
                </TouchableOpacity>
              </View>

              {photoUris.length > 0 && (
                <View style={styles.photoGrid}>
                  {photoUris.slice(0, MAX_THUMBS_TO_SHOW).map((uri, index) => {
                    const isLastTile =
                      index === MAX_THUMBS_TO_SHOW - 1 &&
                      photoUris.length > MAX_THUMBS_TO_SHOW;
                    const extraCount = photoUris.length - MAX_THUMBS_TO_SHOW;

                    return (
                      <View key={uri} style={styles.photoWrapper}>
                        <TouchableOpacity
                          style={{ flex: 1 }}
                          activeOpacity={0.9}
                        >
                          <View style={styles.photoThumb}>
                            <Image
                              source={{ uri }}
                              style={styles.photoThumbImage}
                              resizeMode="cover"
                            />
                          </View>

                          {isLastTile && extraCount > 0 && (
                            <View style={styles.photoMoreOverlay}>
                              <Text style={styles.photoMoreText}>
                                + {extraCount} more
                              </Text>
                            </View>
                          )}
                        </TouchableOpacity>

                        {!isLastTile && (
                          <TouchableOpacity
                            style={styles.photoRemoveButton}
                            onPress={() => handleRemovePhoto(uri)}
                          >
                            <Text style={styles.photoRemoveText}>X</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            {/* BUTTONS (bottom) */}
            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => router.back()}
                activeOpacity={0.9}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleSave}
                activeOpacity={0.9}
              >
                <Text style={styles.modalButtonText}>Save Job</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>

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
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  detailsScreen: {
    flex: 1,
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
    marginTop: 16,
    marginBottom: 6,
  },
  statusValue: {
    fontSize: 14,
    color: "#F9FAFB",
    marginBottom: 6,
  },
  mapButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#1F2937",
    backgroundColor: "#020617",
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  mapPin: {
    marginRight: 6,
    fontSize: 14,
  },
  mapButtonText: {
    color: "#E5E7EB",
    fontSize: 13,
    fontWeight: "600",
  },
  // Pricing card
  pricingCard: {
    backgroundColor: "#020617",
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: "#1F2937",
    marginBottom: 12,
    marginTop: 4,
  },
  pricingHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  pricingHeaderLabel: {
    fontSize: 13,
    color: "#E5E7EB",
    fontWeight: "600",
  },
  pricingHeaderValue: {
    fontSize: 18,
    color: "#FACC15",
    fontWeight: "700",
  },
  pricingInputsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 4,
  },
  pricingBreakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 2,
  },
  pricingBreakdownLabel: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  pricingBreakdownValue: {
    fontSize: 12,
    color: "#E5E7EB",
  },
  pricingDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#1F2937",
    marginVertical: 8,
  },
  pricingTotalLabel: {
    fontWeight: "700",
    color: "#E5E7EB",
  },
  pricingTotalValue: {
    fontWeight: "700",
    color: "#FACC15",
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
    justifyContent: "center",
    alignItems: "center",
  },
  photoThumbImage: {
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
  // Bottom sheet for Add Photo
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
  // Buttons row
  modalButtonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
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
});
