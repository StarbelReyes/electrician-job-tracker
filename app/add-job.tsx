// app/add-job.tsx

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { addDoc, collection } from "firebase/firestore";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
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
  photoBase64s?: string[];

  laborHours?: number;
  hourlyRate?: number;
  materialCost?: number;

  // ✅ NEW assignment model (ARRAY)
  assignedToUids?: string[];

  // ✅ required for owner reads/writes in your rules
  ownerUid?: string;
  createdByUid?: string;
};

const STORAGE_KEYS = {
  JOBS: "EJT_JOBS",
};

const GRID_COLUMNS = 3;
const GRID_HORIZONTAL_PADDING = 16 * 2;
const GRID_GAP = 8;

const screenWidth = Dimensions.get("window").width;
const THUMB_SIZE =
  (screenWidth - GRID_HORIZONTAL_PADDING - GRID_GAP * (GRID_COLUMNS - 1)) /
  GRID_COLUMNS;

/**
 * Reusable Photos section (same polish as job-detail)
 * Handles:
 * - Add from camera / gallery
 * - Remove photo
 * - Fullscreen viewer
 * - Bottom sheet menu
 */
function JobPhotos({
  theme,
  accentColor,
  photoUris,
  setPhotoUris,
  photoBase64s,
  setPhotoBase64s,
}: {
  theme: any;
  accentColor: string;
  photoUris: string[];
  setPhotoUris: React.Dispatch<React.SetStateAction<string[]>>;
  photoBase64s: string[];
  setPhotoBase64s: React.Dispatch<React.SetStateAction<string[]>>;
}) {
  const [isImageOverlayVisible, setIsImageOverlayVisible] = useState(false);
  const [fullImageIndex, setFullImageIndex] = useState(0);
  const [isAddPhotoMenuVisible, setIsAddPhotoMenuVisible] = useState(false);

  const handleAddPhotoFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
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
      base64: true,
    });

    if (result.canceled || !result.assets?.length) return;

    const newUris: string[] = [];
    const newBase64s: string[] = [];

    for (const asset of result.assets) {
      if (!asset.uri || !asset.base64) continue;
      newUris.push(asset.uri);
      newBase64s.push(asset.base64);
    }

    if (!newUris.length) return;

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setPhotoUris((prev) => [...prev, ...newUris]);
    setPhotoBase64s((prev) => [...prev, ...newBase64s]);
  };

  const handleAddPhotoFromCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
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
      base64: true,
    });

    if (result.canceled) return;

    const asset = result.assets[0];
    if (!asset?.uri || !asset.base64) return;

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setPhotoUris((prev) => [...prev, asset.uri]);
    setPhotoBase64s((prev) => [...prev, asset.base64 as string]);
  };

  const handleRemovePhoto = (uriToRemove: string) => {
    const index = photoUris.indexOf(uriToRemove);
    Alert.alert("Remove photo", "Are you sure you want to remove this photo?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setPhotoUris((prev) => prev.filter((u) => u !== uriToRemove));
          setPhotoBase64s((prev) =>
            index >= 0 ? prev.filter((_, i) => i !== index) : prev
          );
        },
      },
    ]);
  };

  const handleOpenFullImage = (index: number) => {
    setFullImageIndex(index);
    setIsImageOverlayVisible(true);
  };

  return (
    <>
      <View style={styles.photosRow}>
        <TouchableOpacity
          style={[
            styles.addPhotoButton,
            {
              backgroundColor: theme.cardBackground,
              borderColor: accentColor,
            },
          ]}
          onPress={() => setIsAddPhotoMenuVisible(true)}
          activeOpacity={0.9}
        >
          <Text style={[styles.addPhotoButtonText, { color: theme.textPrimary }]}>
            + Add Photo
          </Text>
        </TouchableOpacity>
      </View>

      {photoUris.length > 0 && (
        <View style={styles.photoGrid}>
          {photoUris.map((uri: string, index: number) => (
            <View key={uri} style={styles.photoWrapper}>
              <TouchableOpacity
                style={{ flex: 1 }}
                activeOpacity={0.9}
                onPress={() => handleOpenFullImage(index)}
              >
                <Image source={{ uri }} style={styles.photoThumb} resizeMode="cover" />
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

      {isAddPhotoMenuVisible && (
        <View style={styles.addPhotoMenuOverlay}>
          <TouchableWithoutFeedback onPress={() => setIsAddPhotoMenuVisible(false)}>
            <View style={styles.addPhotoMenuBackdrop} />
          </TouchableWithoutFeedback>

          <View
            style={[
              styles.addPhotoMenuSheet,
              { backgroundColor: theme.cardBackground },
            ]}
          >
            <Text style={[styles.addPhotoMenuTitle, { color: theme.textPrimary }]}>
              Add Photo
            </Text>

            <TouchableOpacity
              style={[
                styles.addPhotoMenuOption,
                {
                  backgroundColor: theme.cardBackground,
                  borderColor: accentColor,
                },
              ]}
              onPress={() => {
                setIsAddPhotoMenuVisible(false);
                handleAddPhotoFromCamera();
              }}
              activeOpacity={0.9}
            >
              <Text style={[styles.addPhotoMenuOptionText, { color: theme.textPrimary }]}>
                📸 Take Photo
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.addPhotoMenuOption,
                {
                  backgroundColor: theme.cardBackground,
                  borderColor: accentColor,
                },
              ]}
              onPress={() => {
                setIsAddPhotoMenuVisible(false);
                handleAddPhotoFromGallery();
              }}
              activeOpacity={0.9}
            >
              <Text style={[styles.addPhotoMenuOptionText, { color: theme.textPrimary }]}>
                🖼️ Choose from Gallery
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.addPhotoMenuCancel}
              onPress={() => setIsAddPhotoMenuVisible(false)}
              activeOpacity={0.8}
            >
              <Text style={[styles.addPhotoMenuCancelText, { color: theme.textMuted }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {photoUris.length > 0 && (
        <ImageViewing
          images={photoUris.map((uri: string) => ({ uri }))}
          imageIndex={fullImageIndex}
          visible={isImageOverlayVisible}
          onRequestClose={() => setIsImageOverlayVisible(false)}
          swipeToCloseEnabled
          doubleTapToZoomEnabled
          backgroundColor="rgba(0,0,0,0.95)"
        />
      )}
    </>
  );
}

export default function AddJobScreen() {
  const router = useRouter();

  const { isReady, theme, accentColor } = usePreferences();

  const [session, setSession] = useState<Session | null>(null);
  const isOwner = session?.role === "owner";
  const isEmployee = session?.role === "employee";
  const isIndependent = session?.role === "independent" || !session?.role;

  useEffect(() => {
    const loadSession = async () => {
      try {
        const stored = await AsyncStorage.getItem(USER_STORAGE_KEY);
        if (!stored) {
          setSession(null);
          return;
        }
        setSession(JSON.parse(stored));
      } catch {
        setSession(null);
      }
    };
    loadSession();
  }, []);

  const goBackSafe = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/home" as any);
  };

  const [title, setTitle] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientNotes, setClientNotes] = useState("");

  const [laborHours, setLaborHours] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [materialCost, setMaterialCost] = useState("");

  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [photoBase64s, setPhotoBase64s] = useState<string[]>([]);

  const [isEditing, setIsEditing] = useState(false);

  const scrollRef = useRef<ScrollView | null>(null);
  const sectionPositions = useRef<Record<string, number>>({});

  const registerSection = (key: string, y: number) => {
    sectionPositions.current[key] = y;
  };

  const scrollToSection = (key: string) => {
    const y = sectionPositions.current[key];
    if (scrollRef.current && y !== undefined) {
      scrollRef.current.scrollTo({
        y: Math.max(y - 80, 0),
        animated: true,
      });
    }
  };

  const saveScale = useRef(new Animated.Value(1)).current;

  const saveAnim = {
    onPressIn: () => {
      Animated.spring(saveScale, {
        toValue: 0.96,
        useNativeDriver: true,
        friction: 5,
        tension: 180,
      }).start();
    },
    onPressOut: () => {
      Animated.spring(saveScale, {
        toValue: 1,
        useNativeDriver: true,
        friction: 5,
        tension: 180,
      }).start();
    },
  };

  const screenScale = useRef(new Animated.Value(1.04)).current;
  useEffect(() => {
    Animated.timing(screenScale, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [screenScale]);

  const parseNumber = (value: string) => {
    const n = Number(value.replace(/[^0-9.]/g, ""));
    return Number.isNaN(n) ? 0 : n;
  };

  const totalAmount =
    parseNumber(laborHours) * parseNumber(hourlyRate) + parseNumber(materialCost);

  const createJobId = () =>
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  const persistJobs = async (jobs: Job[]) => {
    await AsyncStorage.setItem(STORAGE_KEYS.JOBS, JSON.stringify(jobs));
  };

  const handleSaveJob = async () => {
    if (isEmployee) {
      Alert.alert("Not allowed", "Employees can’t create jobs.");
      return;
    }

    const trimmedTitle = title.trim();
    const trimmedAddress = address.trim();
    const trimmedDescription = description.trim();

    if (!trimmedTitle || !trimmedAddress || !trimmedDescription) {
      Alert.alert("Missing info", "Please fill in Title, Address, and Description.");
      return;
    }

    // ---------------- OWNER MODE: Firestore ----------------
    if (isOwner) {
      if (!session?.companyId) {
        Alert.alert("Company required", "Owner must have a company before creating jobs.", [
          { text: "OK", onPress: () => router.replace("/create-company" as any) },
        ]);
        return;
      }
      if (!session?.uid) {
        Alert.alert("Session error", "Please log in again.");
        router.replace("/login" as any);
        return;
      }

      // ✅ NEW MODEL + REQUIRED OWNER MARKERS
      const fireJob = {
        title: trimmedTitle,
        address: trimmedAddress,
        description: trimmedDescription,
        createdAt: new Date().toISOString(),
        isDone: false,

        clientName: clientName.trim() || null,
        clientPhone: clientPhone.trim() || null,
        clientNotes: clientNotes.trim() || null,

        laborHours: parseNumber(laborHours),
        hourlyRate: parseNumber(hourlyRate),
        materialCost: parseNumber(materialCost),

        photoUris: photoUris,
        // ✅ never store base64 in Firestore
        photoBase64s: [],

        // ✅ ARRAY model (unassigned by default)
        assignedToUids: [],

        // ✅ REQUIRED for your rules + owner query
        ownerUid: session.uid,
        createdByUid: session.uid,
      };

      try {
        const jobsRef = collection(db, "companies", session.companyId, "jobs");
        await addDoc(jobsRef, fireJob);

        Alert.alert("Saved", "Job created.", [{ text: "OK", onPress: goBackSafe }]);
        return;
      } catch (e) {
        console.warn("Failed to create Firestore job:", e);
        Alert.alert("Error", "Could not create this job. Try again.");
        return;
      }
    }

    // ---------------- INDEPENDENT MODE: AsyncStorage ----------------
    const newJob: Job = {
      id: createJobId(),
      title: trimmedTitle,
      address: trimmedAddress,
      description: trimmedDescription,
      createdAt: new Date().toISOString(),
      isDone: false,
      clientName: clientName.trim() || undefined,
      clientPhone: clientPhone.trim() || undefined,
      clientNotes: clientNotes.trim() || undefined,
      laborHours: parseNumber(laborHours),
      hourlyRate: parseNumber(hourlyRate),
      materialCost: parseNumber(materialCost),
      photoUris,
      photoBase64s,
      assignedToUids: [],
    };

    try {
      const jobsJson = await AsyncStorage.getItem(STORAGE_KEYS.JOBS);
      const jobs: Job[] = jobsJson ? JSON.parse(jobsJson) : [];

      const next = [newJob, ...jobs];
      await persistJobs(next);

      Alert.alert("Saved", "Job created.", [{ text: "OK", onPress: goBackSafe }]);
    } catch (e) {
      console.warn("Failed to save new job:", e);
      Alert.alert("Error", "Could not save this job. Try again.");
    }
  };

  const dismissKeyboardAndEditing = () => {
    Keyboard.dismiss();
    setIsEditing(false);
  };

  if (!isReady) {
    return <View style={{ flex: 1, backgroundColor: themes.light.screenBackground }} />;
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.screenBackground }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <Animated.View
        style={[
          styles.detailsScreen,
          {
            transform: [{ scale: screenScale }],
            backgroundColor: theme.screenBackground,
          },
        ]}
      >
        <View style={{ flex: 1 }}>
          <View style={styles.headerRow}>
            <View style={{ width: 60 }} />
            <Text style={[styles.headerTitle, { color: theme.headerText }]}>Add Job</Text>
            <View style={{ width: 60 }} />
          </View>

          <ScrollView
            ref={scrollRef}
            style={{ flex: 1, backgroundColor: theme.screenBackground }}
            contentContainerStyle={[
              styles.detailsScroll,
              { paddingBottom: isEditing ? 8 : 24 },
            ]}
            keyboardShouldPersistTaps="always"
            showsVerticalScrollIndicator={false}
            onScrollBeginDrag={dismissKeyboardAndEditing}
          >
            <TouchableWithoutFeedback onPress={dismissKeyboardAndEditing} accessible={false}>
              <View>
                <View onLayout={(e) => registerSection("title", e.nativeEvent.layout.y)}>
                  <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>Title</Text>
                  <TextInput
                    style={[
                      styles.modalInput,
                      {
                        backgroundColor: theme.inputBackground,
                        color: theme.inputText,
                        borderColor: theme.inputBorder,
                        borderWidth: 1,
                      },
                    ]}
                    value={title}
                    onChangeText={setTitle}
                    placeholder="e.g. Troubleshoot Lights Flickering"
                    placeholderTextColor={theme.textMuted}
                    onFocus={() => {
                      setIsEditing(true);
                      scrollToSection("title");
                    }}
                    onBlur={() => setIsEditing(false)}
                  />
                </View>

                <View onLayout={(e) => registerSection("address", e.nativeEvent.layout.y)}>
                  <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>Address</Text>
                  <TextInput
                    style={[
                      styles.modalInput,
                      {
                        backgroundColor: theme.inputBackground,
                        color: theme.inputText,
                        borderColor: theme.inputBorder,
                        borderWidth: 1,
                      },
                    ]}
                    value={address}
                    onChangeText={setAddress}
                    placeholder="Job address..."
                    placeholderTextColor={theme.textMuted}
                    onFocus={() => {
                      setIsEditing(true);
                      scrollToSection("address");
                    }}
                    onBlur={() => setIsEditing(false)}
                  />
                </View>

                <View onLayout={(e) => registerSection("description", e.nativeEvent.layout.y)}>
                  <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>
                    Description / Scope
                  </Text>
                  <TextInput
                    style={[
                      styles.modalInputMultiline,
                      {
                        backgroundColor: theme.inputBackground,
                        color: theme.inputText,
                        borderColor: theme.inputBorder,
                        borderWidth: 1,
                      },
                    ]}
                    value={description}
                    onChangeText={setDescription}
                    multiline
                    placeholder="What are you here to do?"
                    placeholderTextColor={theme.textMuted}
                    onFocus={() => {
                      setIsEditing(true);
                      scrollToSection("description");
                    }}
                    onBlur={() => setIsEditing(false)}
                  />
                </View>

                <View onLayout={(e) => registerSection("client", e.nativeEvent.layout.y)}>
                  <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
                    Client Info
                  </Text>

                  <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>
                    Client Name
                  </Text>
                  <TextInput
                    style={[
                      styles.modalInput,
                      {
                        backgroundColor: theme.inputBackground,
                        color: theme.inputText,
                        borderColor: theme.inputBorder,
                        borderWidth: 1,
                      },
                    ]}
                    value={clientName}
                    onChangeText={setClientName}
                    placeholder="Client name..."
                    placeholderTextColor={theme.textMuted}
                    onFocus={() => {
                      setIsEditing(true);
                      scrollToSection("client");
                    }}
                    onBlur={() => setIsEditing(false)}
                  />

                  <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>
                    Client Phone
                  </Text>
                  <TextInput
                    style={[
                      styles.modalInput,
                      {
                        backgroundColor: theme.inputBackground,
                        color: theme.inputText,
                        borderColor: theme.inputBorder,
                        borderWidth: 1,
                      },
                    ]}
                    value={clientPhone}
                    onChangeText={setClientPhone}
                    placeholder="Phone number..."
                    placeholderTextColor={theme.textMuted}
                    keyboardType="phone-pad"
                    onFocus={() => {
                      setIsEditing(true);
                      scrollToSection("client");
                    }}
                    onBlur={() => setIsEditing(false)}
                  />

                  <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>
                    Client Notes
                  </Text>
                  <TextInput
                    style={[
                      styles.modalInputMultiline,
                      {
                        backgroundColor: theme.inputBackground,
                        color: theme.inputText,
                        borderColor: theme.inputBorder,
                        borderWidth: 1,
                      },
                    ]}
                    value={clientNotes}
                    onChangeText={setClientNotes}
                    placeholder="Gate codes, timing, special info..."
                    placeholderTextColor={theme.textMuted}
                    multiline
                    onFocus={() => {
                      setIsEditing(true);
                      scrollToSection("client");
                    }}
                    onBlur={() => setIsEditing(false)}
                  />
                </View>

                <View onLayout={(e) => registerSection("pricing", e.nativeEvent.layout.y)}>
                  <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Pricing</Text>

                  <View
                    style={[
                      styles.pricingCard,
                      {
                        backgroundColor: theme.cardSecondaryBackground,
                        borderColor: theme.cardBorder,
                      },
                    ]}
                  >
                    <View style={styles.pricingTotalHeader}>
                      <Text style={[styles.pricingTotalHeaderLabel, { color: theme.textMuted }]}>
                        Total
                      </Text>
                      <Text style={[styles.pricingTotalHeaderValue, { color: accentColor }]}>
                        $
                        {totalAmount.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                        })}
                      </Text>
                    </View>

                    <View style={styles.pricingInputsRow}>
                      <View style={styles.pricingColumn}>
                        <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>
                          Labor hours
                        </Text>
                        <TextInput
                          style={[
                            styles.modalInput,
                            styles.pricingInput,
                            {
                              backgroundColor: theme.inputBackground,
                              color: theme.inputText,
                              borderColor: theme.inputBorder,
                              borderWidth: 1,
                            },
                          ]}
                          value={laborHours}
                          onChangeText={setLaborHours}
                          keyboardType="numeric"
                          placeholder="e.g. 4"
                          placeholderTextColor={theme.textMuted}
                          onFocus={() => {
                            setIsEditing(true);
                            scrollToSection("pricing");
                          }}
                          onBlur={() => setIsEditing(false)}
                        />
                      </View>

                      <View style={styles.pricingColumn}>
                        <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>
                          Hourly rate
                        </Text>
                        <TextInput
                          style={[
                            styles.modalInput,
                            styles.pricingInput,
                            {
                              backgroundColor: theme.inputBackground,
                              color: theme.inputText,
                              borderColor: theme.inputBorder,
                              borderWidth: 1,
                            },
                          ]}
                          value={hourlyRate}
                          onChangeText={setHourlyRate}
                          keyboardType="numeric"
                          placeholder="e.g. 125"
                          placeholderTextColor={theme.textMuted}
                          onFocus={() => {
                            setIsEditing(true);
                            scrollToSection("pricing");
                          }}
                          onBlur={() => setIsEditing(false)}
                        />
                      </View>
                    </View>

                    <View style={styles.pricingSingleRow}>
                      <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>
                        Material cost
                      </Text>
                      <TextInput
                        style={[
                          styles.modalInput,
                          styles.pricingInput,
                          {
                            backgroundColor: theme.inputBackground,
                            color: theme.inputText,
                            borderColor: theme.inputBorder,
                            borderWidth: 1,
                          },
                        ]}
                        value={materialCost}
                        onChangeText={setMaterialCost}
                        keyboardType="numeric"
                        placeholder="e.g. 300"
                        placeholderTextColor={theme.textMuted}
                        onFocus={() => {
                          setIsEditing(true);
                          scrollToSection("pricing");
                        }}
                        onBlur={() => setIsEditing(false)}
                      />
                    </View>
                  </View>
                </View>

                <View onLayout={(e) => registerSection("photos", e.nativeEvent.layout.y)}>
                  <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Photos</Text>

                  <JobPhotos
                    theme={theme}
                    accentColor={accentColor}
                    photoUris={photoUris}
                    setPhotoUris={setPhotoUris}
                    photoBase64s={photoBase64s}
                    setPhotoBase64s={setPhotoBase64s}
                  />
                </View>

                <View style={styles.modalButtonRow}>
                  <Animated.View style={{ flex: 1, transform: [{ scale: saveScale }] }}>
                    <TouchableOpacity
                      style={[
                        styles.modalButton,
                        { backgroundColor: theme.primaryButtonBackground },
                      ]}
                      onPress={handleSaveJob}
                      activeOpacity={0.9}
                      onPressIn={saveAnim.onPressIn}
                      onPressOut={saveAnim.onPressOut}
                    >
                      <Text style={[styles.modalButtonText, { color: theme.primaryButtonText }]}>
                        Save Job
                      </Text>
                    </TouchableOpacity>
                  </Animated.View>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </ScrollView>
        </View>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  detailsScreen: {
    flex: 1,
    paddingTop: 48,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    marginBottom: 12,
  },
  backButton: {
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  backText: {
    fontSize: 14,
    fontFamily: "Athiti-Medium",
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: "Athiti-Bold",
  },

  detailsScroll: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingBottom: 110,
  },

  sectionTitle: {
    fontSize: 14,
    fontFamily: "Athiti-Bold",
    marginTop: 16,
    marginBottom: 6,
  },

  modalLabel: {
    fontSize: 12,
    marginBottom: 4,
    fontFamily: "Athiti-Medium",
  },
  modalInput: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    marginBottom: 10,
    fontFamily: "Athiti-Regular",
  },
  modalInputMultiline: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 10,
    minHeight: 96,
    textAlignVertical: "top",
    fontFamily: "Athiti-Regular",
  },

  modalButtonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 18,
    marginBottom: 12,
    gap: 10,
  },
  modalButton: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: "center",
  },
  modalButtonText: {
    fontSize: 15,
    fontFamily: "Athiti-SemiBold",
  },

  photosRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    marginBottom: 10,
  },
  addPhotoButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  addPhotoButtonText: {
    fontSize: 13,
    fontFamily: "Athiti-SemiBold",
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GRID_GAP,
    marginBottom: 12,
  },
  photoWrapper: {
    position: "relative",
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 14,
    overflow: "hidden",
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
    fontFamily: "Athiti-Bold",
  },

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
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 26,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  addPhotoMenuTitle: {
    fontSize: 15,
    fontFamily: "Athiti-SemiBold",
    marginBottom: 10,
    textAlign: "center",
  },
  addPhotoMenuOption: {
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  addPhotoMenuOptionText: {
    fontSize: 14,
    textAlign: "center",
    fontFamily: "Athiti-Medium",
  },
  addPhotoMenuCancel: {
    marginTop: 6,
    paddingVertical: 8,
  },
  addPhotoMenuCancelText: {
    fontSize: 13,
    textAlign: "center",
    fontFamily: "Athiti-Medium",
  },

  pricingCard: {
    borderRadius: 18,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  pricingTotalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 6,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148,163,184,0.25)",
  },
  pricingTotalHeaderLabel: {
    fontSize: 13,
    fontFamily: "Athiti-SemiBold",
  },
  pricingTotalHeaderValue: {
    fontSize: 20,
    fontFamily: "Athiti-Bold",
  },
  pricingInputsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  pricingColumn: {
    flex: 1,
  },
  pricingInput: {
    marginBottom: 8,
  },
  pricingSingleRow: {
    marginTop: 6,
    marginBottom: 4,
  },
});
