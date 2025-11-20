// app/add-job.tsx
import { Ionicons } from "@expo/vector-icons";
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
  LayoutAnimation,
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
import { THEME_STORAGE_KEY, ThemeName, themes } from "./theme";

type Job = {
  id: string;
  title: string;
  address: string;
  description: string;
  createdAt: string; // ISO
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
  SORT: "EJT_SORT_OPTION",
};

const screenWidth = Dimensions.get("window").width;
const GRID_COLUMNS = 3;
const GRID_HORIZONTAL_PADDING = 16 * 2;
const GRID_GAP = 8;

const THUMB_SIZE =
  (screenWidth - GRID_HORIZONTAL_PADDING - GRID_GAP * (GRID_COLUMNS - 1)) /
  GRID_COLUMNS;

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const AddJobScreen = () => {
  const router = useRouter();

  // THEME
  const [themeName, setThemeName] = useState<ThemeName>("dark");
  const theme = themes[themeName];

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (
          saved === "light" ||
          saved === "dark" ||
          saved === "midnight"
        ) {
          setThemeName(saved as ThemeName);
        }
      } catch (err) {
        console.warn("Failed to load theme:", err);
      }
    };

    loadTheme();
  }, []);

  // FORM STATE
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

  // ANIMATIONS
  const screenScale = useRef(new Animated.Value(1.04)).current;
  const saveButtonScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(screenScale, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [screenScale]);

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

  const saveAnim = createScaleHandlers(saveButtonScale);

  const parseNumber = (value: string) => {
    const n = Number(value.replace(/[^0-9.]/g, ""));
    return Number.isNaN(n) ? 0 : n;
  };

  const totalAmount =
    parseNumber(laborHours) * parseNumber(hourlyRate) +
    parseNumber(materialCost);

  // ---------- PHOTOS ----------
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

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
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

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setPhotoUris((prev) => [...prev, uri]);
  };

  const handleRemovePhoto = (uriToRemove: string) => {
    Alert.alert(
      "Remove photo",
      "Are you sure you want to remove this photo?",
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

  // ---------- SAVE ----------
  const handleSaveJob = async () => {
    if (!title.trim()) {
      Alert.alert("Missing title", "Please enter a job title.");
      return;
    }

    const job: Job = {
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
      photoUris: photoUris.length > 0 ? photoUris : [],
      laborHours: parseNumber(laborHours),
      hourlyRate: parseNumber(hourlyRate),
      materialCost: parseNumber(materialCost),
    };

    try {
      const jobsJson = await AsyncStorage.getItem(STORAGE_KEYS.JOBS);
      const jobs: Job[] = jobsJson ? JSON.parse(jobsJson) : [];

      const nextJobs = [...jobs, job];

      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      await AsyncStorage.setItem(
        STORAGE_KEYS.JOBS,
        JSON.stringify(nextJobs)
      );

      Alert.alert("Job saved", "New job has been added.", [
        {
          text: "OK",
          onPress: () => router.back(),
        },
      ]);
    } catch (err) {
      console.warn("Failed to save new job:", err);
      Alert.alert("Error", "Could not save job. Try again.");
    }
  };

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
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
              activeOpacity={0.8}
            >
              <Ionicons
                name="chevron-back"
                size={20}
                color={theme.headerMuted}
              />
              <Text
                style={[
                  styles.backText,
                  { color: theme.headerMuted },
                ]}
              >
                Back
              </Text>
            </TouchableOpacity>

            <Text
              style={[
                styles.headerTitle,
                { color: theme.headerText },
              ]}
            >
              Add New Job
            </Text>

            <View style={{ width: 60 }} />
          </View>

          {/* FORM */}
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="always"
            showsVerticalScrollIndicator={false}
          >
            {/* JOB INFO CARD */}
            <View
              style={[
                styles.card,
                {
                  backgroundColor: theme.cardBackground,
                  borderColor: theme.cardBorder,
                },
              ]}
            >
              <Text
                style={[
                  styles.cardTitle,
                  { color: theme.textPrimary },
                ]}
              >
                Job Info
              </Text>

              <Text
                style={[
                  styles.label,
                  { color: theme.textMuted },
                ]}
              >
                Title
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.inputBackground,
                    color: theme.inputText,
                    borderColor: theme.inputBorder,
                  },
                ]}
                value={title}
                onChangeText={setTitle}
                placeholder="Ex: Install Tesla Wall Charger"
                placeholderTextColor={theme.textMuted}
              />

              <Text
                style={[
                  styles.label,
                  { color: theme.textMuted },
                ]}
              >
                Address
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.inputBackground,
                    color: theme.inputText,
                    borderColor: theme.inputBorder,
                  },
                ]}
                value={address}
                onChangeText={setAddress}
                placeholder="Job address"
                placeholderTextColor={theme.textMuted}
              />

              <Text
                style={[
                  styles.label,
                  { color: theme.textMuted },
                ]}
              >
                Description / Scope
              </Text>
              <TextInput
                style={[
                  styles.inputMultiline,
                  {
                    backgroundColor: theme.inputBackground,
                    color: theme.inputText,
                    borderColor: theme.inputBorder,
                  },
                ]}
                value={description}
                onChangeText={setDescription}
                placeholder="What are you doing on this job?"
                placeholderTextColor={theme.textMuted}
                multiline
              />
            </View>

            {/* CLIENT INFO CARD */}
            <View
              style={[
                styles.card,
                {
                  backgroundColor: theme.cardBackground,
                  borderColor: theme.cardBorder,
                },
              ]}
            >
              <Text
                style={[
                  styles.cardTitle,
                  { color: theme.textPrimary },
                ]}
              >
                Client Info
              </Text>

              <Text
                style={[
                  styles.label,
                  { color: theme.textMuted },
                ]}
              >
                Client Name
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.inputBackground,
                    color: theme.inputText,
                    borderColor: theme.inputBorder,
                  },
                ]}
                value={clientName}
                onChangeText={setClientName}
                placeholder="Client name"
                placeholderTextColor={theme.textMuted}
              />

              <Text
                style={[
                  styles.label,
                  { color: theme.textMuted },
                ]}
              >
                Client Phone
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.inputBackground,
                    color: theme.inputText,
                    borderColor: theme.inputBorder,
                  },
                ]}
                value={clientPhone}
                onChangeText={setClientPhone}
                placeholder="Phone number"
                keyboardType="phone-pad"
                placeholderTextColor={theme.textMuted}
              />

              <Text
                style={[
                  styles.label,
                  { color: theme.textMuted },
                ]}
              >
                Notes (gate codes, timing, etc.)
              </Text>
              <TextInput
                style={[
                  styles.inputMultiline,
                  {
                    backgroundColor: theme.inputBackground,
                    color: theme.inputText,
                    borderColor: theme.inputBorder,
                  },
                ]}
                value={clientNotes}
                onChangeText={setClientNotes}
                placeholder="Any special info..."
                placeholderTextColor={theme.textMuted}
                multiline
              />
            </View>

            {/* PRICING CARD */}
            <View
              style={[
                styles.card,
                {
                  backgroundColor: theme.cardBackground,
                  borderColor: theme.cardBorder,
                },
              ]}
            >
              <Text
                style={[
                  styles.cardTitle,
                  { color: theme.textPrimary },
                ]}
              >
                Pricing
              </Text>

              <View style={styles.pricingRow}>
                <View style={styles.pricingColumn}>
                  <Text
                    style={[
                      styles.label,
                      { color: theme.textMuted },
                    ]}
                  >
                    Labor hours
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      styles.inputCompact,
                      {
                        backgroundColor: theme.inputBackground,
                        color: theme.inputText,
                        borderColor: theme.inputBorder,
                      },
                    ]}
                    value={laborHours}
                    onChangeText={setLaborHours}
                    placeholder="4.5"
                    keyboardType="numeric"
                    placeholderTextColor={theme.textMuted}
                  />
                </View>

                <View style={styles.pricingColumn}>
                  <Text
                    style={[
                      styles.label,
                      { color: theme.textMuted },
                    ]}
                  >
                    Hourly rate
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      styles.inputCompact,
                      {
                        backgroundColor: theme.inputBackground,
                        color: theme.inputText,
                        borderColor: theme.inputBorder,
                      },
                    ]}
                    value={hourlyRate}
                    onChangeText={setHourlyRate}
                    placeholder="120"
                    keyboardType="numeric"
                    placeholderTextColor={theme.textMuted}
                  />
                </View>
              </View>

              <Text
                style={[
                  styles.label,
                  { color: theme.textMuted },
                ]}
              >
                Material cost
              </Text>
              <TextInput
                style={[
                  styles.input,
                  styles.inputCompact,
                  {
                    backgroundColor: theme.inputBackground,
                    color: theme.inputText,
                    borderColor: theme.inputBorder,
                  },
                ]}
                value={materialCost}
                onChangeText={setMaterialCost}
                placeholder="350"
                keyboardType="numeric"
                placeholderTextColor={theme.textMuted}
              />

              <View style={styles.totalRow}>
                <Text
                  style={[
                    styles.totalLabel,
                    { color: theme.textMuted },
                  ]}
                >
                  Estimated total
                </Text>
                <Text style={styles.totalValue}>
                  $
                  {totalAmount.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                  })}
                </Text>
              </View>
            </View>

            {/* PHOTOS CARD */}
            <View
              style={[
                styles.card,
                {
                  backgroundColor: theme.cardBackground,
                  borderColor: theme.cardBorder,
                },
              ]}
            >
              <Text
                style={[
                  styles.cardTitle,
                  { color: theme.textPrimary },
                ]}
              >
                Photos
              </Text>

              <View style={styles.photosButtonRow}>
                <TouchableOpacity
                  style={[
                    styles.photoActionButton,
                    {
                      backgroundColor: theme.secondaryButtonBackground,
                    },
                  ]}
                  onPress={handleAddPhotoFromCamera}
                  activeOpacity={0.9}
                >
                  <Text
                    style={[
                      styles.photoActionText,
                      { color: theme.secondaryButtonText },
                    ]}
                  >
                    📸 Take photo
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.photoActionButton,
                    {
                      backgroundColor: theme.secondaryButtonBackground,
                    },
                  ]}
                  onPress={handleAddPhotoFromGallery}
                  activeOpacity={0.9}
                >
                  <Text
                    style={[
                      styles.photoActionText,
                      { color: theme.secondaryButtonText },
                    ]}
                  >
                    🖼️ From Gallery
                  </Text>
                </TouchableOpacity>
              </View>

              {photoUris.length > 0 && (
                <View style={styles.photoGrid}>
                  {photoUris.map((uri) => (
                    <View key={uri} style={styles.photoWrapper}>
                      <Image
                        source={{ uri }}
                        style={styles.photoThumb}
                        resizeMode="cover"
                      />
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

            {/* SAVE BUTTON */}
            <Animated.View
              style={[
                styles.saveButtonWrapper,
                { transform: [{ scale: saveButtonScale }] },
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.saveButton,
                  { backgroundColor: theme.primaryButtonBackground },
                ]}
                onPress={handleSaveJob}
                activeOpacity={0.9}
                onPressIn={saveAnim.onPressIn}
                onPressOut={saveAnim.onPressOut}
              >
                <Text
                  style={[
                    styles.saveButtonText,
                    { color: theme.primaryButtonText },
                  ]}
                >
                  Save Job
                </Text>
              </TouchableOpacity>
            </Animated.View>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => router.back()}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.cancelText,
                  { color: theme.textMuted },
                ]}
              >
                Cancel
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </Animated.View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

export default AddJobScreen;

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
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  backText: {
    fontSize: 13,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  scrollContent: {
    paddingBottom: 32,
  },
  card: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    marginBottom: 4,
  },
  input: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    borderWidth: 1,
    marginBottom: 10,
  },
  inputMultiline: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    borderWidth: 1,
    marginBottom: 10,
    minHeight: 90,
    textAlignVertical: "top",
  },
  pricingRow: {
    flexDirection: "row",
    gap: 8,
  },
  pricingColumn: {
    flex: 1,
  },
  inputCompact: {
    marginBottom: 6,
  },
  totalRow: {
    marginTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: {
    fontSize: 12,
  },
  totalValue: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FCD34D",
  },
  photosButtonRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  photoActionButton: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  photoActionText: {
    fontSize: 12,
    fontWeight: "600",
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GRID_GAP,
    marginBottom: 4,
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
  saveButtonWrapper: {
    marginTop: 8,
  },
  saveButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  cancelButton: {
    marginTop: 10,
    alignItems: "center",
  },
  cancelText: {
    fontSize: 13,
  },
});
