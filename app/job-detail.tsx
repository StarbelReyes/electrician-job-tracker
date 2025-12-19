// app/job-detail.tsx
import CallIcon from "../assets/icons/call.png";
import MapIcon from "../assets/icons/map.png";
import TeamChatIcon from "../assets/icons/team-chat.png";

import AsyncStorage from "@react-native-async-storage/async-storage";
// We no longer depend on FileSystem for images, only for PDF via Print
import * as ImagePicker from "expo-image-picker";
import * as Print from "expo-print";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
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
import { themes } from "../constants/appTheme";
import { usePreferences } from "../context/PreferencesContext";

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

  // Photos
  photoUris?: string[]; // For in-app thumbnails
  photoBase64s?: string[]; // For PDF export

  // pricing
  laborHours?: number;
  hourlyRate?: number;
  materialCost?: number;
};

const STORAGE_KEYS = {
  JOBS: "EJT_JOBS",
  TRASH: "EJT_TRASH",
};

const BRANDING_KEYS = {
  COMPANY_NAME: "EJT_COMPANY_NAME",
  COMPANY_PHONE: "EJT_COMPANY_PHONE",
  COMPANY_EMAIL: "EJT_COMPANY_EMAIL",
  COMPANY_LICENSE: "EJT_COMPANY_LICENSE",
};

const GRID_COLUMNS = 3;
const GRID_HORIZONTAL_PADDING = 16 * 2;
const GRID_GAP = 8;

const screenWidth = Dimensions.get("window").width;
const THUMB_SIZE =
  (screenWidth - GRID_HORIZONTAL_PADDING - GRID_GAP * (GRID_COLUMNS - 1)) /
  GRID_COLUMNS;

const STICKY_BAR_HEIGHT = 86;

// ✅ Match add-job.tsx offset behavior
const SCROLL_OFFSET = 80;

type ActiveSectionKey = "jobInfo" | "client" | "pricing" | "photos" | null;

// 🔹 Small component just for Photos UI (header + button + grid)
type JobPhotosSectionProps = {
  theme: any;
  accentColor: string;
  photoUris: string[];
  onPressAddPhoto: () => void;
  onPressThumb: (index: number) => void;
  onRemovePhoto: (uri: string) => void;
};

function JobPhotosSection({
  theme,
  accentColor,
  photoUris,
  onPressAddPhoto,
  onPressThumb,
  onRemovePhoto,
}: JobPhotosSectionProps) {
  return (
    <View>
      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
        Photos
      </Text>

      <View style={styles.photosRow}>
        <TouchableOpacity
          style={[
            styles.addPhotoButton,
            {
              backgroundColor: theme.cardBackground,
              borderColor: accentColor,
            },
          ]}
          onPress={onPressAddPhoto}
          activeOpacity={0.9}
        >
          <Text
            style={[styles.addPhotoButtonText, { color: theme.textPrimary }]}
          >
            + Add Photo
          </Text>
        </TouchableOpacity>
      </View>

      {photoUris.length > 0 && (
        <View style={styles.photoGrid}>
          {photoUris.map((uri, index) => (
            <View key={uri} style={styles.photoWrapper}>
              <TouchableOpacity
                style={{ flex: 1 }}
                activeOpacity={0.9}
                onPress={() => onPressThumb(index)}
              >
                <Image
                  source={{ uri }}
                  style={styles.photoThumb}
                  resizeMode="cover"
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.photoRemoveButton}
                onPress={() => onRemovePhoto(uri)}
              >
                <Text style={styles.photoRemoveText}>X</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ---------- Pure layout helpers (no logic changes) ----------
function SectionCard({
  theme,
  accentColor,
  title,
  subtitle,
  icon,
  isActive,
  isDimmed,
  children,
  onLayout,
}: {
  theme: any;
  accentColor: string;
  title: string;
  subtitle?: string;
  icon?: string;
  isActive?: boolean;
  isDimmed?: boolean;
  children: React.ReactNode;
  onLayout?: (y: number) => void;
}) {
  return (
    <Animated.View
      onLayout={(e) => onLayout?.(e.nativeEvent.layout.y)}
      style={[
        styles.card,
        {
          backgroundColor: theme.cardBackground,
          borderColor: isActive ? accentColor : theme.cardBorder,
          opacity: isDimmed ? 0.92 : 1,
          transform: [{ scale: isActive ? 1.01 : 1 }],
        },
        isActive ? styles.cardActiveShadow : null,
      ]}
    >
      <View style={styles.cardHeaderRow}>
        <View
          style={[
            styles.cardIconBubble,
            {
              backgroundColor: theme.cardSecondaryBackground,
              borderColor: theme.cardBorder,
            },
          ]}
        >
          <Text style={[styles.cardIconText, { color: theme.textPrimary }]}>
            {icon ?? "•"}
          </Text>
        </View>

        <View style={{ flex: 1 }}>
          <Text style={[styles.cardTitle, { color: theme.textSecondary }]}>
            {title}
          </Text>

          {!!subtitle && (
            <View style={{ height: 16 }}>
              {isActive ? (
                <Text style={[styles.cardSubtitle, { color: theme.textMuted }]}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
          )}
        </View>

        {isActive ? (
          <View
            style={[
              styles.cardActivePill,
              {
                borderColor: accentColor,
                backgroundColor: accentColor + "1A",
              },
            ]}
          >
            <Text
              style={[styles.cardActivePillText, { color: theme.textPrimary }]}
            >
              Editing
            </Text>
          </View>
        ) : null}
      </View>

      <View style={{ marginTop: 10 }}>{children}</View>
    </Animated.View>
  );
}

// ✅ icon-only action (no pill, no label)
function ActionIcon({
  iconSource,
  onPress,
  disabled,
  size = 28,
}: {
  iconSource: any;
  onPress: () => void;
  disabled?: boolean;
  size?: number;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    Animated.spring(scale, {
      toValue: 0.94,
      useNativeDriver: true,
      friction: 6,
      tension: 180,
    }).start();
  };

  const onPressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      friction: 6,
      tension: 180,
    }).start();
  };

  return (
    <Animated.View
      style={{
        transform: [{ scale }],
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <TouchableOpacity
        onPress={onPress}
        disabled={!!disabled}
        activeOpacity={0.9}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={styles.actionIconButton}
      >
        <Image
          source={iconSource}
          style={{ width: size, height: size }}
          resizeMode="contain"
        />
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function JobDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();

  // ✅ LOCKED theme + accent from PreferencesContext
  const { isReady, theme, accentColor } = usePreferences();

  // 🔹 Company branding (used in PDFs)
  const [companyName, setCompanyName] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [companyLicense, setCompanyLicense] = useState("");

  useEffect(() => {
    const loadBranding = async () => {
      try {
        const [
          savedCompanyName,
          savedCompanyPhone,
          savedCompanyEmail,
          savedCompanyLicense,
        ] = await Promise.all([
          AsyncStorage.getItem(BRANDING_KEYS.COMPANY_NAME),
          AsyncStorage.getItem(BRANDING_KEYS.COMPANY_PHONE),
          AsyncStorage.getItem(BRANDING_KEYS.COMPANY_EMAIL),
          AsyncStorage.getItem(BRANDING_KEYS.COMPANY_LICENSE),
        ]);

        if (savedCompanyName) setCompanyName(savedCompanyName);
        if (savedCompanyPhone) setCompanyPhone(savedCompanyPhone);
        if (savedCompanyEmail) setCompanyEmail(savedCompanyEmail);
        if (savedCompanyLicense) setCompanyLicense(savedCompanyLicense);
      } catch (err) {
        console.warn("Failed to load branding:", err);
      }
    };

    loadBranding();
  }, []);

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
  const [photoBase64s, setPhotoBase64s] = useState<string[]>([]);

  // 🔹 Track editing (used for keyboard + sticky behavior)
  const [isEditing, setIsEditing] = useState(false);

  // ✅ UI-only: which section is active
  const [activeSection, setActiveSection] = useState<ActiveSectionKey>(null);

  // 🔹 Scroll + keyboard handling
  const scrollRef = useRef<ScrollView | null>(null);
  const sectionPositions = useRef<Record<string, number>>({});

  const registerSection = (key: string, y: number) => {
    sectionPositions.current[key] = y;
  };

  const scrollToSectionWithRetry = (
    key: string,
    triesLeft = 8,
    delayMs = 40
  ) => {
    const y = sectionPositions.current[key];

    if (scrollRef.current && y !== undefined) {
      scrollRef.current.scrollTo({
        y: Math.max(y - SCROLL_OFFSET, 0),
        animated: true,
      });
      return;
    }

    if (triesLeft <= 0) return;
    setTimeout(
      () => scrollToSectionWithRetry(key, triesLeft - 1, delayMs),
      delayMs
    );
  };

  const handleFocus = (sectionKey: Exclude<ActiveSectionKey, null>) => {
    setIsEditing(true);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveSection(sectionKey);

    requestAnimationFrame(() => {
      scrollToSectionWithRetry(sectionKey);
    });
  };

  const dismissKeyboard = () => {
    Keyboard.dismiss();
    setIsEditing(false);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveSection(null);
  };

  const hasActive = isEditing && activeSection !== null;
  const cardIsActive = (k: Exclude<ActiveSectionKey, null>) =>
    hasActive && activeSection === k;
  const cardIsDimmed = (k: Exclude<ActiveSectionKey, null>) =>
    hasActive && activeSection !== k;

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

  // 🔹 Screen zoom
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
          setPhotoBase64s(found.photoBase64s || []);
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

  const safeHtml = (value: string) =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const withLineBreaks = (value: string) =>
    safeHtml(value).replace(/\n/g, "<br />");

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
      photoBase64s,
    };

    try {
      const jobsJson = await AsyncStorage.getItem(STORAGE_KEYS.JOBS);
      const jobs: Job[] = jobsJson ? JSON.parse(jobsJson) : [];
      const next = jobs.map((j) => (j.id === job.id ? updated : j));

      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      await persistJobs(next);
      setJob(updated);

      Alert.alert("Saved", "Job details updated.", [
        { text: "OK", onPress: () => router.back() },
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
            setPhotoBase64s((prev) =>
              index >= 0 ? prev.filter((_, i) => i !== index) : prev
            );
          },
        },
      ]
    );
  };

  const handleOpenFullImage = (index: number) => {
    setFullImageIndex(index);
    setIsImageOverlayVisible(true);
  };

  // ---------- Share full report ----------
  const handleShareFullReport = async () => {
    if (!job) return;

    try {
      const laborNum = parseNumber(laborHours);
      const rateNum = parseNumber(hourlyRate);
      const materialNum = parseNumber(materialCost);

      const createdAt = new Date(job.createdAt).toLocaleString();
      const statusLabel = isDone ? "Done" : "Open";

      const brandName = companyName.trim();
      const brandPhone = companyPhone.trim();
      const brandEmail = companyEmail.trim();
      const brandLicense = companyLicense.trim();

      const hasBranding = brandName || brandPhone || brandEmail || brandLicense;

      const companyHeaderLines: string[] = [];
      if (brandName) {
        companyHeaderLines.push(
          `<div class="company-name">${safeHtml(brandName)}</div>`
        );
      }
      if (brandPhone) {
        companyHeaderLines.push(
          `<div class="company-line">${safeHtml(brandPhone)}</div>`
        );
      }
      if (brandEmail) {
        companyHeaderLines.push(
          `<div class="company-line">${safeHtml(brandEmail)}</div>`
        );
      }
      if (brandLicense) {
        companyHeaderLines.push(
          `<div class="company-line">${safeHtml(brandLicense)}</div>`
        );
      }

      const companyHeaderHtml = hasBranding
        ? `<div class="company-block">${companyHeaderLines.join("")}</div>`
        : "";

      const bases: string[] =
        photoBase64s.length > 0 ? photoBase64s : job.photoBase64s || [];

      const photoBlocks: string[] = [];
      for (let i = 0; i < bases.length; i++) {
        const base64 = bases[i];
        if (!base64) continue;
        photoBlocks.push(`
          <div class="photo">
            <img src="data:image/jpeg;base64,${base64}" />
            <div class="photo-label">Photo ${i + 1}</div>
          </div>
        `);
      }

      const photosSection =
        bases.length === 0
          ? `
        <div class="section">
          <h2>Photos</h2>
          <p class="muted">No photos attached.</p>
        </div>
      `
          : `
        <div class="section">
          <h2>Photos</h2>
          <div class="photo-grid">
            ${photoBlocks.join("")}
          </div>
        </div>
      `;

      const openColor = accentColor;

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Job Report</title>
            <style>
              * { box-sizing: border-box; }
              body { margin: 0; padding: 24px; font-family: -apple-system, system-ui, sans-serif; background: #111827; }
              .page { background: #ffffff; border-radius: 16px; padding: 24px 24px 28px; max-width: 800px; margin: 0 auto; color: #111827; font-size: 13px; }
              .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
              .title-block h1 { margin: 0; font-size: 20px; }
              .title-block .subtitle { margin-top: 4px; font-size: 11px; color: #6b7280; }
              .status-pill { border-radius: 999px; padding: 4px 10px; font-size: 11px; border: 1px solid ${
                isDone ? "#059669" : openColor
              }; color: ${isDone ? "#047857" : openColor}; }
              .section { margin-top: 18px; padding-top: 14px; border-top: 1px solid #e5e7eb; }
              .section h2 { margin: 0 0 8px; font-size: 14px; }
              .label { font-size: 11px; color: #6b7280; margin-top: 2px; margin-bottom: 1px; }
              .value { font-size: 13px; margin-bottom: 4px; }
              .muted { color: #9ca3af; font-size: 12px; }
              .table { width: 100%; border-collapse: collapse; margin-top: 4px; font-size: 12px; }
              .table th, .table td { border: 1px solid #e5e7eb; padding: 6px 8px; text-align: left; }
              .table th { background: #f9fafb; font-weight: 600; }
              .table tfoot td { font-weight: 700; }
              .amount { text-align: right; }
              .amount-total { color: ${openColor}; }
              .photo-grid { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
              .photo { width: 160px; }
              .photo img { width: 100%; height: auto; border-radius: 8px; border: 1px solid #e5e7eb; object-fit: cover; }
              .photo-label { margin-top: 4px; font-size: 11px; color: #6b7280; text-align: center; }
              .right-header { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
              .company-block { text-align: right; font-size: 11px; color: #4b5563; }
              .company-name { font-weight: 600; font-size: 13px; color: #111827; }
              .company-line { margin-top: 2px; }
            </style>
          </head>
          <body>
            <div class="page">
              <div class="header">
                <div class="title-block">
                  <h1>${safeHtml(editTitle || job.title)}</h1>
                  <div class="subtitle">
                    Generated by TRAKTR – Electrician Job Tracker • ${createdAt}
                  </div>
                </div>
                <div class="right-header">
                  ${companyHeaderHtml}
                  <div class="status-pill">${statusLabel}</div>
                </div>
              </div>

              <div class="section">
                <h2>Job Info</h2>
                <div class="label">Job ID</div>
                <div class="value">${safeHtml(job.id)}</div>

                <div class="label">Address</div>
                <div class="value">${safeHtml(editAddress || job.address)}</div>

                <div class="label">Description / Scope</div>
                <div class="value">
                  ${withLineBreaks(editDescription || job.description)}
                </div>
              </div>

              <div class="section">
                <h2>Client Info</h2>
                <div class="label">Client Name</div>
                <div class="value">
                  ${
                    editClientName.trim()
                      ? safeHtml(editClientName.trim())
                      : "Not set"
                  }
                </div>

                <div class="label">Client Phone</div>
                <div class="value">
                  ${
                    editClientPhone.trim()
                      ? safeHtml(editClientPhone.trim())
                      : "Not set"
                  }
                </div>

                <div class="label">Client Notes</div>
                <div class="value">
                  ${
                    editClientNotes.trim()
                      ? withLineBreaks(editClientNotes.trim())
                      : '<span class="muted">No extra notes.</span>'
                  }
                </div>
              </div>

              <div class="section">
                <h2>Pricing</h2>
                <table class="table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Details</th>
                      <th class="amount">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Labor</td>
                      <td>${laborNum} h × $${rateNum.toFixed(2)}</td>
                      <td class="amount">$${(laborNum * rateNum).toFixed(
                        2
                      )}</td>
                    </tr>
                    <tr>
                      <td>Material</td>
                      <td>Material cost</td>
                      <td class="amount">$${materialNum.toFixed(2)}</td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colspan="2">Total</td>
                      <td class="amount amount-total">$${totalAmount.toFixed(
                        2
                      )}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              ${photosSection}
            </div>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });

      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle: "Share job report",
        UTI: "com.adobe.pdf",
      });
    } catch (e) {
      console.warn("Failed to share full report:", e);
      Alert.alert("Error", "Could not generate PDF report. Try again.");
    }
  };

  // ---------- Share client report ----------
  const handleShareClientReport = async () => {
    if (!job) return;

    try {
      const laborNum = parseNumber(laborHours);
      const rateNum = parseNumber(hourlyRate);
      const materialNum = parseNumber(materialCost);

      const createdAt = new Date(job.createdAt).toLocaleDateString();
      const statusLabel = isDone ? "Done" : "Open";
      const openColor = accentColor;

      const brandName = companyName.trim();
      const brandPhone = companyPhone.trim();
      const brandEmail = companyEmail.trim();
      const brandLicense = companyLicense.trim();

      const hasBranding = brandName || brandPhone || brandEmail || brandLicense;

      const companyHeaderLines: string[] = [];
      if (brandName)
        companyHeaderLines.push(
          `<div class="company-name">${safeHtml(brandName)}</div>`
        );
      if (brandPhone)
        companyHeaderLines.push(
          `<div class="company-line">${safeHtml(brandPhone)}</div>`
        );
      if (brandEmail)
        companyHeaderLines.push(
          `<div class="company-line">${safeHtml(brandEmail)}</div>`
        );
      if (brandLicense)
        companyHeaderLines.push(
          `<div class="company-line">${safeHtml(brandLicense)}</div>`
        );

      const companyHeaderHtml = hasBranding
        ? `<div class="company-block">${companyHeaderLines.join("")}</div>`
        : "";

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Job Summary</title>
            <style>
              * { box-sizing: border-box; }
              body { margin: 0; padding: 24px; font-family: -apple-system, system-ui, sans-serif; background: #f3f4f6; }
              .page { background: #ffffff; border-radius: 16px; padding: 24px 24px 28px; max-width: 800px; margin: 0 auto; color: #111827; font-size: 13px; box-shadow: 0 10px 25px rgba(15,23,42,0.12); }
              .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
              .title-block h1 { margin: 0; font-size: 20px; }
              .title-block .subtitle { margin-top: 4px; font-size: 11px; color: #6b7280; }
              .status-pill { border-radius: 999px; padding: 4px 10px; font-size: 11px; border: 1px solid ${
                isDone ? "#16a34a" : openColor
              }; color: ${isDone ? "#15803d" : openColor}; background: ${
                isDone ? "#dcfce7" : "#ffffff"
              }; }
              .right-header { text-align: right; }
              .company-block { font-size: 11px; color: #4b5563; margin-bottom: 6px; }
              .company-name { font-weight: 600; font-size: 13px; color: #111827; }
              .company-line { margin-top: 2px; }
              .section { margin-top: 18px; padding-top: 14px; border-top: 1px solid #e5e7eb; }
              .section h2 { margin: 0 0 8px; font-size: 14px; }
              .label { font-size: 11px; color: #6b7280; margin-top: 2px; margin-bottom: 1px; }
              .value { font-size: 13px; margin-bottom: 4px; }
              .table { width: 100%; border-collapse: collapse; margin-top: 4px; font-size: 12px; }
              .table th, .table td { border: 1px solid #e5e7eb; padding: 6px 8px; text-align: left; }
              .table th { background: #f9fafb; font-weight: 600; }
              .table tfoot td { font-weight: 700; }
              .amount { text-align: right; }
              .amount-total { color: ${openColor}; }
              .brand-footnote { margin-top: 18px; font-size: 10px; color: #9ca3af; text-align: right; }
            </style>
          </head>
          <body>
            <div class="page">
              <div class="header">
                <div class="title-block">
                  <h1>${safeHtml(editTitle || job.title)}</h1>
                  <div class="subtitle">Job summary for client • ${createdAt}</div>
                </div>
                <div class="right-header">
                  ${companyHeaderHtml}
                  <div class="status-pill">${statusLabel}</div>
                </div>
              </div>

              <div class="section">
                <h2>Job Info</h2>
                <div class="label">Address</div>
                <div class="value">${safeHtml(editAddress || job.address)}</div>

                <div class="label">Description / Scope</div>
                <div class="value">${withLineBreaks(editDescription || job.description)}</div>
              </div>

              <div class="section">
                <h2>Client Info</h2>
                <div class="label">Client Name</div>
                <div class="value">${editClientName.trim() ? safeHtml(editClientName.trim()) : "Not set"}</div>

                <div class="label">Client Phone</div>
                <div class="value">${editClientPhone.trim() ? safeHtml(editClientPhone.trim()) : "Not set"}</div>
              </div>

              <div class="section">
                <h2>Pricing</h2>
                <table class="table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Details</th>
                      <th class="amount">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Labor</td>
                      <td>${laborNum} h × $${rateNum.toFixed(2)}</td>
                      <td class="amount">$${(laborNum * rateNum).toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td>Material</td>
                      <td>Material cost</td>
                      <td class="amount">$${materialNum.toFixed(2)}</td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colspan="2">Total</td>
                      <td class="amount amount-total">$${totalAmount.toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div class="brand-footnote">Generated with TRAKTR – Electrician Job Tracker</div>
            </div>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });

      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle: "Share client report",
        UTI: "com.adobe.pdf",
      });
    } catch (e) {
      console.warn("Failed to share client report:", e);
      Alert.alert("Error", "Could not generate client PDF. Try again.");
    }
  };

  const openShareChooser = () => {
    Alert.alert("Share", "Choose what to share", [
      { text: "Cancel", style: "cancel" },
      { text: "Share full report (PDF)", onPress: handleShareFullReport },
      { text: "Share client report (PDF)", onPress: handleShareClientReport },
    ]);
  };

  // ✅ Don’t render until prefs are ready (kills initial flash)
  if (!isReady) {
    return <View style={{ flex: 1, backgroundColor: themes.light.screenBackground }} />;
  }

  // ---------- Render states ----------
  if (isLoading) {
    return (
      <View
        style={[
          styles.loadingScreen,
          { backgroundColor: theme.screenBackground },
        ]}
      >
        <Text style={[styles.loadingText, { color: theme.textPrimary }]}>
          Loading job…
        </Text>
      </View>
    );
  }

  if (!job) {
    return (
      <View
        style={[
          styles.loadingScreen,
          { backgroundColor: theme.screenBackground },
        ]}
      >
        <Text style={[styles.loadingText, { color: theme.textPrimary }]}>
          Job not found.
        </Text>
        <TouchableOpacity
          style={[styles.simpleButton, { backgroundColor: accentColor }]}
          onPress={() => router.back()}
        >
          <Text style={[styles.simpleButtonText, { color: "#F9FAFB" }]}>
            Back
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const heroPhotoUri = photoUris.length ? photoUris[0] : null;

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
        {/* TOP NAV */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            activeOpacity={0.8}
          >
            <Text style={[styles.backText, { color: theme.headerMuted }]}>
              ← Back
            </Text>
          </TouchableOpacity>

          <Text style={[styles.headerTitle, { color: theme.headerText }]}>
            Job Detail
          </Text>

          <TouchableOpacity
            style={[styles.chatHeaderButton, { backgroundColor: accentColor }]}
            activeOpacity={0.9}
            onPress={openShareChooser}
          >
            <Text style={[styles.chatHeaderButtonText, { color: "#F9FAFB" }]}>
              Share
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[
            styles.detailsScroll,
            { paddingBottom: isEditing ? 18 : STICKY_BAR_HEIGHT + 26 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          onScrollBeginDrag={dismissKeyboard}
        >
          <TouchableWithoutFeedback onPress={dismissKeyboard} accessible={false}>
            <View>
              {/* HERO HEADER */}
              <View style={styles.heroWrap}>
                <View
                  style={[
                    styles.heroBg,
                    {
                      borderColor: theme.cardBorder,
                      backgroundColor: theme.cardBackground,
                    },
                  ]}
                >
                  {!!heroPhotoUri ? (
                    <>
                      <Image
                        source={{ uri: heroPhotoUri }}
                        style={StyleSheet.absoluteFillObject}
                        resizeMode="cover"
                        blurRadius={18}
                      />
                      <View style={styles.heroOverlay} />
                    </>
                  ) : (
                    <View
                      style={[
                        StyleSheet.absoluteFillObject,
                        { backgroundColor: accentColor, opacity: 0.18 },
                      ]}
                    />
                  )}

                  <View style={styles.heroContent}>
                    <Text
                      numberOfLines={1}
                      style={[styles.heroTitle, { color: theme.headerText }]}
                    >
                      {editTitle || job.title}
                    </Text>

                    <Text
                      numberOfLines={2}
                      style={[
                        styles.heroSubtitle,
                        { color: theme.textSecondary },
                      ]}
                    >
                      {editAddress || job.address}
                    </Text>

                    <View
                      style={[
                        styles.statusPill,
                        {
                          borderColor: isDone ? "#16a34a" : accentColor,
                          backgroundColor: isDone
                            ? "rgba(22,163,74,0.10)"
                            : accentColor + "1A",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusPillText,
                          { color: isDone ? "#22c55e" : accentColor },
                        ]}
                      >
                        {isDone ? "Done" : "Open"}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* QUICK ACTIONS */}
                <View style={styles.heroActionsRow}>
                  <ActionIcon
                    iconSource={CallIcon}
                    onPress={handleCallClient}
                    disabled={!editClientPhone.trim()}
                    size={54}
                  />

                  <ActionIcon
                    iconSource={MapIcon}
                    onPress={handleOpenInMaps}
                    disabled={!editAddress.trim()}
                    size={54}
                  />

                  <ActionIcon
                    iconSource={TeamChatIcon}
                    onPress={() =>
                      router.push({
                        pathname: "/job-chat",
                        params: { id: job.id, title: editTitle || job.title },
                      })
                    }
                    size={82}
                  />
                </View>
              </View>

              {/* JOB INFO CARD */}
              <SectionCard
                theme={theme}
                accentColor={accentColor}
                title="Job Info"
                subtitle="Title, address, scope"
                icon="🧾"
                isActive={cardIsActive("jobInfo")}
                isDimmed={cardIsDimmed("jobInfo")}
                onLayout={(y) => registerSection("jobInfo", y)}
              >
                <View style={styles.row}>
                  <Text style={[styles.metaLabel, { color: theme.textMuted }]}>
                    Job ID
                  </Text>
                  <Text style={[styles.metaValue, { color: theme.textPrimary }]}>
                    {job.id}
                  </Text>
                </View>

                <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>
                  Title
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
                  value={editTitle}
                  onChangeText={setEditTitle}
                  placeholderTextColor={theme.textMuted}
                  onFocus={() => handleFocus("jobInfo")}
                  onBlur={() => setIsEditing(false)}
                />

                <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>
                  Address
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
                  value={editAddress}
                  onChangeText={setEditAddress}
                  placeholderTextColor={theme.textMuted}
                  onFocus={() => handleFocus("jobInfo")}
                  onBlur={() => setIsEditing(false)}
                />

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
                  value={editDescription}
                  onChangeText={setEditDescription}
                  multiline
                  placeholderTextColor={theme.textMuted}
                  onFocus={() => handleFocus("jobInfo")}
                  onBlur={() => setIsEditing(false)}
                />
              </SectionCard>

              {/* CLIENT CARD */}
              <SectionCard
                theme={theme}
                accentColor={accentColor}
                title="Client"
                subtitle="Name, phone, notes"
                icon="👤"
                isActive={cardIsActive("client")}
                isDimmed={cardIsDimmed("client")}
                onLayout={(y) => registerSection("client", y)}
              >
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
                  value={editClientName}
                  onChangeText={setEditClientName}
                  placeholder="Client name..."
                  placeholderTextColor={theme.textMuted}
                  onFocus={() => handleFocus("client")}
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
                  value={editClientPhone}
                  onChangeText={setEditClientPhone}
                  placeholder="Phone number..."
                  placeholderTextColor={theme.textMuted}
                  keyboardType="phone-pad"
                  onFocus={() => handleFocus("client")}
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
                  value={editClientNotes}
                  onChangeText={setEditClientNotes}
                  placeholder="Gate codes, timing, special info..."
                  placeholderTextColor={theme.textMuted}
                  multiline
                  onFocus={() => handleFocus("client")}
                  onBlur={() => setIsEditing(false)}
                />
              </SectionCard>

              {/* PRICING CARD */}
              <SectionCard
                theme={theme}
                accentColor={accentColor}
                title="Pricing"
                subtitle="Labor + materials"
                icon="💰"
                isActive={cardIsActive("pricing")}
                isDimmed={cardIsDimmed("pricing")}
                onLayout={(y) => registerSection("pricing", y)}
              >
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
                    <Text
                      style={[
                        styles.pricingTotalHeaderLabel,
                        { color: theme.textMuted },
                      ]}
                    >
                      Total
                    </Text>
                    <Text
                      style={[
                        styles.pricingTotalHeaderValue,
                        { color: accentColor },
                      ]}
                    >
                      $
                      {totalAmount.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                      })}
                    </Text>
                  </View>

                  <View style={styles.pricingInputsRow}>
                    <View style={styles.pricingColumn}>
                      <Text
                        style={[
                          styles.modalLabel,
                          { color: theme.textSecondary },
                        ]}
                      >
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
                        onFocus={() => handleFocus("pricing")}
                        onBlur={() => setIsEditing(false)}
                      />
                    </View>

                    <View style={styles.pricingColumn}>
                      <Text
                        style={[
                          styles.modalLabel,
                          { color: theme.textSecondary },
                        ]}
                      >
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
                        onFocus={() => handleFocus("pricing")}
                        onBlur={() => setIsEditing(false)}
                      />
                    </View>
                  </View>

                  <View style={styles.pricingSingleRow}>
                    <Text
                      style={[
                        styles.modalLabel,
                        { color: theme.textSecondary },
                      ]}
                    >
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
                      onFocus={() => handleFocus("pricing")}
                      onBlur={() => setIsEditing(false)}
                    />
                  </View>
                </View>
              </SectionCard>

              {/* PHOTOS CARD */}
              <SectionCard
                theme={theme}
                accentColor={accentColor}
                title="Attachments"
                subtitle="Photos + add"
                icon="📎"
                isActive={cardIsActive("photos")}
                isDimmed={cardIsDimmed("photos")}
                onLayout={(y) => registerSection("photos", y)}
              >
                <JobPhotosSection
                  theme={theme}
                  accentColor={accentColor}
                  photoUris={photoUris}
                  onPressAddPhoto={() => setIsAddPhotoMenuVisible(true)}
                  onPressThumb={handleOpenFullImage}
                  onRemovePhoto={handleRemovePhoto}
                />
              </SectionCard>

              {/* TRASH ONLY */}
              <SectionCard
                theme={theme}
                accentColor={accentColor}
                title="Trash"
                icon="⚠️"
              >
                <TouchableOpacity
                  style={[
                    styles.modalDeleteButton,
                    { borderColor: theme.dangerBorder },
                  ]}
                  onPress={confirmMoveToTrash}
                >
                  <Text
                    style={[styles.modalDeleteText, { color: theme.dangerText }]}
                  >
                    Move to Trash
                  </Text>
                </TouchableOpacity>

                <Text style={[styles.modalMeta, { color: theme.textMuted }]}>
                  Created: {new Date(job.createdAt).toLocaleString()}
                </Text>
              </SectionCard>
            </View>
          </TouchableWithoutFeedback>
        </ScrollView>

        {/* ✅ STICKY ACTION BAR — HIDE WHILE EDITING */}
        {!isEditing && (
          <View
            style={[
              styles.stickyBar,
              {
                backgroundColor: theme.screenBackground,
                borderTopColor: theme.cardBorder,
              },
            ]}
          >
            <View style={styles.stickyButtonsRow}>
              <Animated.View style={{ flex: 1, transform: [{ scale: markDoneScale }] }}>
                <TouchableOpacity
                  style={[
                    styles.stickyButton,
                    {
                      backgroundColor: isDone
                        ? theme.secondaryButtonBackground
                        : accentColor,
                    },
                  ]}
                  onPress={handleToggleDone}
                  activeOpacity={0.9}
                  onPressIn={markDoneAnim.onPressIn}
                  onPressOut={markDoneAnim.onPressOut}
                >
                  <Text
                    style={[
                      styles.stickyButtonText,
                      {
                        color: isDone
                          ? theme.secondaryButtonText
                          : "#F9FAFB",
                      },
                    ]}
                  >
                    {isDone ? "Mark Not Done" : "Mark Done"}
                  </Text>
                </TouchableOpacity>
              </Animated.View>

              <Animated.View style={{ flex: 1, transform: [{ scale: saveChangesScale }] }}>
                <TouchableOpacity
                  style={[styles.stickyButton, { backgroundColor: accentColor }]}
                  onPress={handleSaveJobEdits}
                  activeOpacity={0.9}
                  onPressIn={saveChangesAnim.onPressIn}
                  onPressOut={saveChangesAnim.onPressOut}
                >
                  <Text style={[styles.stickyButtonText, { color: "#F9FAFB" }]}>
                    Save Changes
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
          </View>
        )}

        {/* Add Photo bottom sheet */}
        {isAddPhotoMenuVisible && (
          <View style={styles.addPhotoMenuOverlay}>
            <TouchableOpacity
              activeOpacity={1}
              onPress={() => setIsAddPhotoMenuVisible(false)}
              style={styles.addPhotoMenuBackdrop}
            />
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
                <Text
                  style={[
                    styles.addPhotoMenuOptionText,
                    { color: theme.textPrimary },
                  ]}
                >
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
                <Text
                  style={[
                    styles.addPhotoMenuOptionText,
                    { color: theme.textPrimary },
                  ]}
                >
                  🖼️ Choose from Gallery
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.addPhotoMenuCancel}
                onPress={() => setIsAddPhotoMenuVisible(false)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.addPhotoMenuCancelText,
                    { color: theme.textMuted },
                  ]}
                >
                  Cancel
                </Text>
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
  loadingScreen: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { fontSize: 16, fontFamily: "Athiti-Regular" },

  simpleButton: {
    marginTop: 16,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 999,
  },
  simpleButtonText: { fontSize: 14, fontFamily: "Athiti-SemiBold" },

  detailsScreen: { flex: 1, paddingTop: 48 },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    marginBottom: 10,
  },
  backButton: { paddingVertical: 4, paddingHorizontal: 4 },
  backText: { fontSize: 14, fontFamily: "Athiti-SemiBold" },

  headerTitle: { fontSize: 22, fontFamily: "Athiti-Bold" },

  chatHeaderButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  chatHeaderButtonText: { fontSize: 12, fontFamily: "Athiti-SemiBold" },

  detailsScroll: { flexGrow: 1, paddingHorizontal: 18 },

  // HERO
  heroWrap: { marginBottom: 14 },
  heroBg: {
    height: 132,
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(2,6,23,0.55)",
  },
  heroContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    justifyContent: "space-between",
  },
  heroTitle: { fontSize: 18, fontFamily: "Athiti-Bold" },
  heroSubtitle: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: "Athiti-SemiBold",
  },

  statusPill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
  },
  statusPillText: { fontSize: 11, fontFamily: "Athiti-Bold" },

  heroActionsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 35,
    marginTop: 10,
  },

  actionIconButton: {
    width: 62,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
  },

  // CARDS
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  cardActiveShadow: {
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  cardIconBubble: {
    width: 38,
    height: 38,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  cardIconText: { fontSize: 16, fontFamily: "Athiti-Bold" },

  cardTitle: {
    fontSize: 13,
    marginBottom: 2,
    fontFamily: "Athiti-Bold",
  },
  cardSubtitle: {
    fontSize: 11,
    fontFamily: "Athiti-SemiBold",
  },

  cardActivePill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
  },
  cardActivePillText: { fontSize: 11, fontFamily: "Athiti-Bold" },

  row: { marginBottom: 10 },
  metaLabel: { fontSize: 11, fontFamily: "Athiti-Bold" },
  metaValue: { fontSize: 13, marginTop: 4, fontFamily: "Athiti-Bold" },

  sectionTitle: {
    fontSize: 14,
    marginTop: 10,
    marginBottom: 6,
    fontFamily: "Athiti-Bold",
  },

  modalLabel: { fontSize: 12, marginBottom: 4, fontFamily: "Athiti-SemiBold" },

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
  modalMeta: { fontSize: 11, marginTop: 8, fontFamily: "Athiti-Regular" },

  // Photos
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
  addPhotoButtonText: { fontSize: 13, fontFamily: "Athiti-SemiBold" },

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
  photoThumb: { width: "100%", height: "100%" },
  photoRemoveButton: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 10,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  photoRemoveText: { color: "#FCA5A5", fontSize: 10, fontFamily: "Athiti-Bold" },

  // Pricing
  pricingCard: {
    borderRadius: 18,
    padding: 14,
    marginBottom: 2,
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
  pricingTotalHeaderLabel: { fontSize: 13, fontFamily: "Athiti-SemiBold" },
  pricingTotalHeaderValue: {
    fontSize: 20,
    fontFamily: "Athiti-Bold",
  },
  pricingInputsRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  pricingColumn: { flex: 1 },
  pricingInput: { marginBottom: 8 },
  pricingSingleRow: { marginTop: 6, marginBottom: 4 },

  // Buttons
  modalDeleteButton: {
    marginTop: 10,
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: "center",
  },
  modalDeleteText: { fontSize: 13, fontFamily: "Athiti-Bold" },

  // Sticky bar
  stickyBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 22 : 12,
    borderTopWidth: 1,
  },
  stickyButtonsRow: { flexDirection: "row", gap: 10 },
  stickyButton: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: "center",
  },
  stickyButtonText: { fontSize: 14, fontFamily: "Athiti-Bold" },

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
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 26,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  addPhotoMenuTitle: {
    fontSize: 15,
    marginBottom: 10,
    textAlign: "center",
    fontFamily: "Athiti-SemiBold",
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
    fontFamily: "Athiti-SemiBold",
  },
  addPhotoMenuCancel: { marginTop: 6, paddingVertical: 8 },
  addPhotoMenuCancelText: {
    fontSize: 13,
    textAlign: "center",
    fontFamily: "Athiti-Regular",
  },
});
