// app/job-detail.tsx
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
// 🔽 CHANGED: now using shared appTheme instead of "./theme"
import {
  THEME_STORAGE_KEY,
  ThemeName,
  themes,
} from "../constants/appTheme";

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

// 🔹 Small component just for Photos UI (header + button + grid)
type JobPhotosSectionProps = {
  theme: any;
  photoUris: string[];
  onPressAddPhoto: () => void;
  onPressThumb: (index: number) => void;
  onRemovePhoto: (uri: string) => void;
};

function JobPhotosSection({
  theme,
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
              borderColor: theme.cardBorder,
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

export default function JobDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [themeName, setThemeName] = useState<ThemeName>("dark");
  const theme = themes[themeName] ?? themes.dark;

  // 🔹 Company branding (used in PDFs)
  const [companyName, setCompanyName] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [companyLicense, setCompanyLicense] = useState("");

  useEffect(() => {
    const loadThemeAndBranding = async () => {
      try {
        const [
          savedTheme,
          savedCompanyName,
          savedCompanyPhone,
          savedCompanyEmail,
          savedCompanyLicense,
        ] = await Promise.all([
          AsyncStorage.getItem(THEME_STORAGE_KEY),
          AsyncStorage.getItem(BRANDING_KEYS.COMPANY_NAME),
          AsyncStorage.getItem(BRANDING_KEYS.COMPANY_PHONE),
          AsyncStorage.getItem(BRANDING_KEYS.COMPANY_EMAIL),
          AsyncStorage.getItem(BRANDING_KEYS.COMPANY_LICENSE),
        ]);

        if (
          savedTheme === "light" ||
          savedTheme === "dark" ||
          savedTheme === "midnight"
        ) {
          setThemeName(savedTheme as ThemeName);
        }

        if (savedCompanyName) setCompanyName(savedCompanyName);
        if (savedCompanyPhone) setCompanyPhone(savedCompanyPhone);
        if (savedCompanyEmail) setCompanyEmail(savedCompanyEmail);
        if (savedCompanyLicense) setCompanyLicense(savedCompanyLicense);
      } catch (err) {
        console.warn("Failed to load theme/branding:", err);
      }
    };

    loadThemeAndBranding();
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

  // 🔹 Track editing like home.tsx (for keyboard behavior)
  const [isEditing, setIsEditing] = useState(false);

  // 🔹 Scroll + keyboard handling (unified like add-job / home)
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

  const handleFocus = (sectionKey: string) => {
    setIsEditing(true);
    scrollToSection(sectionKey);
  };

  const handleBlur = () => {
    setIsEditing(false);
  };

  const dismissKeyboard = () => {
    Keyboard.dismiss();
    setIsEditing(false);
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

      // 🔹 Save photos (URIs + base64)
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

  // ---------- Photos (store uri + base64) ----------
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
      base64: true, // 👈 IMPORTANT
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
      base64: true, // 👈 IMPORTANT
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

  // ---------- Share full report (boss / internal) ----------
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

      const hasBranding =
        brandName || brandPhone || brandEmail || brandLicense;

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

      // Prefer live state, fallback to job (for older data)
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

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Job Report</title>
            <style>
              * { box-sizing: border-box; }
              body {
                margin: 0;
                padding: 24px;
                font-family: -apple-system, system-ui, sans-serif;
                background: #111827;
              }
              .page {
                background: #ffffff;
                border-radius: 16px;
                padding: 24px 24px 28px;
                max-width: 800px;
                margin: 0 auto;
                color: #111827;
                font-size: 13px;
              }
              .header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 16px;
              }
              .title-block h1 {
                margin: 0;
                font-size: 20px;
              }
              .title-block .subtitle {
                margin-top: 4px;
                font-size: 11px;
                color: #6b7280;
              }
              .status-pill {
                border-radius: 999px;
                padding: 4px 10px;
                font-size: 11px;
                border: 1px solid ${
                  isDone ? "#059669" : "#2563EB"
                };
                color: ${isDone ? "#047857" : "#1D4ED8"};
              }
              .section {
                margin-top: 18px;
                padding-top: 14px;
                border-top: 1px solid #e5e7eb;
              }
              .section h2 {
                margin: 0 0 8px;
                font-size: 14px;
              }
              .label {
                font-size: 11px;
                color: #6b7280;
                margin-top: 2px;
                margin-bottom: 1px;
              }
              .value {
                font-size: 13px;
                margin-bottom: 4px;
              }
              .muted {
                color: #9ca3af;
                font-size: 12px;
              }
              .table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 4px;
                font-size: 12px;
              }
              .table th,
              .table td {
                border: 1px solid #e5e7eb;
                padding: 6px 8px;
                text-align: left;
              }
              .table th {
                background: #f9fafb;
                font-weight: 600;
              }
              .table tfoot td {
                font-weight: 700;
              }
              .amount {
                text-align: right;
              }
              .amount-total {
                color: #b45309;
              }
              .photo-grid {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                margin-top: 8px;
              }
              .photo {
                width: 160px;
              }
              .photo img {
                width: 100%;
                height: auto;
                border-radius: 8px;
                border: 1px solid #e5e7eb;
                object-fit: cover;
              }
              .photo-label {
                margin-top: 4px;
                font-size: 11px;
                color: #6b7280;
                text-align: center;
              }
              .right-header {
                display: flex;
                flex-direction: column;
                align-items: flex-end;
                gap: 6px;
              }
              .company-block {
                text-align: right;
                font-size: 11px;
                color: #4b5563;
              }
              .company-name {
                font-weight: 600;
                font-size: 13px;
                color: #111827;
              }
              .company-line {
                margin-top: 2px;
              }

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

  // ---------- Share client report (client-friendly, NO images) ----------
  const handleShareClientReport = async () => {
    if (!job) return;

    try {
      const laborNum = parseNumber(laborHours);
      const rateNum = parseNumber(hourlyRate);
      const materialNum = parseNumber(materialCost);

      const createdAt = new Date(job.createdAt).toLocaleDateString();
      const statusLabel = isDone ? "Done" : "Open";

      const brandName = companyName.trim();
      const brandPhone = companyPhone.trim();
      const brandEmail = companyEmail.trim();
      const brandLicense = companyLicense.trim();

      const hasBranding =
        brandName || brandPhone || brandEmail || brandLicense;

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

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Job Summary</title>
            <style>
              * { box-sizing: border-box; }
              body {
                margin: 0;
                padding: 24px;
                font-family: -apple-system, system-ui, sans-serif;
                background: #f3f4f6;
              }
              .page {
                background: #ffffff;
                border-radius: 16px;
                padding: 24px 24px 28px;
                max-width: 800px;
                margin: 0 auto;
                color: #111827;
                font-size: 13px;
                box-shadow: 0 10px 25px rgba(15,23,42,0.12);
              }
              .header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 16px;
              }
              .title-block h1 {
                margin: 0;
                font-size: 20px;
              }
              .title-block .subtitle {
                margin-top: 4px;
                font-size: 11px;
                color: #6b7280;
              }
              .status-pill {
                border-radius: 999px;
                padding: 4px 10px;
                font-size: 11px;
                border: 1px solid ${isDone ? "#16a34a" : "#2563EB"};
                color: ${isDone ? "#15803d" : "#1D4ED8"};
                background: ${isDone ? "#dcfce7" : "#dbeafe"};
              }

              .right-header {
                text-align: right;
              }
              .company-block {
                font-size: 11px;
                color: #4b5563;
                margin-bottom: 6px;
              }
              .company-name {
                font-weight: 600;
                font-size: 13px;
                color: #111827;
              }
              .company-line {
                margin-top: 2px;
              }

              .section {
                margin-top: 18px;
                padding-top: 14px;
                border-top: 1px solid #e5e7eb;
              }
              .section h2 {
                margin: 0 0 8px;
                font-size: 14px;
              }
              .label {
                font-size: 11px;
                color: #6b7280;
                margin-top: 2px;
                margin-bottom: 1px;
              }
              .value {
                font-size: 13px;
                margin-bottom: 4px;
              }
              .muted {
                color: #9ca3af;
                font-size: 12px;
              }
              .table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 4px;
                font-size: 12px;
              }
              .table th,
              .table td {
                border: 1px solid #e5e7eb;
                padding: 6px 8px;
                text-align: left;
              }
              .table th {
                background: #f9fafb;
                font-weight: 600;
              }
              .table tfoot td {
                font-weight: 700;
              }
              .amount {
                text-align: right;
              }
              .amount-total {
                color: #b45309;
              }
              .brand-footnote {
                margin-top: 18px;
                font-size: 10px;
                color: #9ca3af;
                text-align: right;
              }
            </style>
          </head>
          <body>
            <div class="page">
              <div class="header">
                <div class="title-block">
                  <h1>${safeHtml(editTitle || job.title)}</h1>
                  <div class="subtitle">
                    Job summary for client • ${createdAt}
                  </div>
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

              <div class="brand-footnote">
                Generated with TRAKTR – Electrician Job Tracker
              </div>
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
          style={[
            styles.simpleButton,
            { backgroundColor: theme.primaryButtonBackground },
          ]}
          onPress={() => router.back()}
        >
          <Text
            style={[
              styles.simpleButtonText,
              { color: theme.primaryButtonText },
            ]}
          >
            Back
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.screenBackground }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0} // match home.tsx
    >
      <TouchableWithoutFeedback
        onPress={dismissKeyboard}
        accessible={false}
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
          {/* Header */}
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
              style={[
                styles.chatHeaderButton,
                { backgroundColor: theme.primaryButtonBackground },
              ]}
              activeOpacity={0.9}
              onPress={() =>
                router.push({
                  pathname: "/job-chat",
                  params: {
                    id: job.id,
                    title: editTitle || job.title,
                  },
                })
              }
            >
              <Text
                style={[
                  styles.chatHeaderButtonText,
                  { color: theme.primaryButtonText },
                ]}
              >
                Team Chat
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.detailsScroll}
            keyboardShouldPersistTaps="always"
            showsVerticalScrollIndicator={false}
          >
            <View>
              {/* Job ID */}
              <View
                onLayout={(e) =>
                  registerSection("jobId", e.nativeEvent.layout.y)
                }
              >
                <Text
                  style={[styles.sectionTitle, { color: theme.textSecondary }]}
                >
                  Job ID
                </Text>
                <Text style={[styles.infoText, { color: theme.textPrimary }]}>
                  {job.id}
                </Text>
              </View>

              {/* Title */}
              <View
                onLayout={(e) =>
                  registerSection("title", e.nativeEvent.layout.y)
                }
              >
                <Text
                  style={[styles.modalLabel, { color: theme.textSecondary }]}
                >
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
                  onFocus={() => handleFocus("title")}
                  onBlur={handleBlur}
                />
              </View>

              {/* Address */}
              <View
                onLayout={(e) =>
                  registerSection("address", e.nativeEvent.layout.y)
                }
              >
                <Text
                  style={[styles.modalLabel, { color: theme.textSecondary }]}
                >
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
                  onFocus={() => handleFocus("address")}
                  onBlur={handleBlur}
                />
              </View>

              {/* Description */}
              <View
                onLayout={(e) =>
                  registerSection("description", e.nativeEvent.layout.y)
                }
              >
                <Text
                  style={[styles.modalLabel, { color: theme.textSecondary }]}
                >
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
                  onFocus={() => handleFocus("description")}
                  onBlur={handleBlur}
                />
              </View>

              {/* Status */}
              <View
                onLayout={(e) =>
                  registerSection("status", e.nativeEvent.layout.y)
                }
              >
                <Text
                  style={[styles.sectionTitle, { color: theme.textSecondary }]}
                >
                  Status
                </Text>
                <Text style={[styles.infoText, { color: theme.textPrimary }]}>
                  {isDone ? "Done" : "Open"}
                </Text>

                {/* Quick Actions */}
                <View style={styles.quickActionsRow}>
                  {!!editClientPhone.trim() && (
                    <TouchableOpacity
                      style={[
                        styles.quickActionButton,
                        {
                          backgroundColor: theme.cardBackground,
                          borderColor: theme.cardBorder,
                        },
                      ]}
                      onPress={handleCallClient}
                      activeOpacity={0.9}
                    >
                      <Text
                        style={[
                          styles.quickActionText,
                          { color: theme.textPrimary },
                        ]}
                      >
                        📞 Call Client
                      </Text>
                    </TouchableOpacity>
                  )}

                  {!!editAddress.trim() && (
                    <TouchableOpacity
                      style={[
                        styles.quickActionButton,
                        {
                          backgroundColor: theme.cardBackground,
                          borderColor: theme.cardBorder,
                        },
                      ]}
                      onPress={handleOpenInMaps}
                      activeOpacity={0.9}
                    >
                      <Text
                        style={[
                          styles.quickActionText,
                          { color: theme.textPrimary },
                        ]}
                      >
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
                <Text
                  style={[styles.sectionTitle, { color: theme.textSecondary }]}
                >
                  Client Info
                </Text>

                <Text
                  style={[styles.modalLabel, { color: theme.textSecondary }]}
                >
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
                  onBlur={handleBlur}
                />

                <Text
                  style={[styles.modalLabel, { color: theme.textSecondary }]}
                >
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
                  onBlur={handleBlur}
                />

                <Text
                  style={[styles.modalLabel, { color: theme.textSecondary }]}
                >
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
                  onBlur={handleBlur}
                />
              </View>

              {/* Pricing */}
              <View
                onLayout={(e) =>
                  registerSection("pricing", e.nativeEvent.layout.y)
                }
              >
                <Text
                  style={[styles.sectionTitle, { color: theme.textSecondary }]}
                >
                  Pricing
                </Text>

                <View
                  style={[
                    styles.pricingCard,
                    {
                      backgroundColor: theme.cardSecondaryBackground,
                      borderColor: theme.cardBorder,
                    },
                  ]}
                >
                  {/* BIG TOTAL at the top */}
                  <View style={styles.pricingTotalHeader}>
                    <Text
                      style={[
                        styles.pricingTotalHeaderLabel,
                        { color: theme.textMuted },
                      ]}
                    >
                      Total
                    </Text>
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
                        onBlur={handleBlur}
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
                        onBlur={handleBlur}
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
                      onBlur={handleBlur}
                    />
                  </View>
                </View>
              </View>

              {/* Photos */}
              <View
                onLayout={(e) =>
                  registerSection("photos", e.nativeEvent.layout.y)
                }
              >
                <JobPhotosSection
                  theme={theme}
                  photoUris={photoUris}
                  onPressAddPhoto={() => setIsAddPhotoMenuVisible(true)}
                  onPressThumb={handleOpenFullImage}
                  onRemovePhoto={handleRemovePhoto}
                />
              </View>

              {/* Meta */}
              <Text style={[styles.modalMeta, { color: theme.textMuted }]}>
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
                      {
                        backgroundColor: isDone
                          ? theme.secondaryButtonBackground
                          : theme.primaryButtonBackground,
                      },
                    ]}
                    onPress={handleToggleDone}
                    activeOpacity={0.9}
                    onPressIn={markDoneAnim.onPressIn}
                    onPressOut={markDoneAnim.onPressOut}
                  >
                    <Text
                      style={[
                        styles.modalButtonText,
                        {
                          color: isDone
                            ? theme.secondaryButtonText
                            : theme.primaryButtonText,
                        },
                      ]}
                    >
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
                    style={[
                      styles.modalButton,
                      { backgroundColor: theme.primaryButtonBackground },
                    ]}
                    onPress={handleSaveJobEdits}
                    activeOpacity={0.9}
                    onPressIn={saveChangesAnim.onPressIn}
                    onPressOut={saveChangesAnim.onPressOut}
                  >
                    <Text
                      style={[
                        styles.modalButtonText,
                        { color: theme.primaryButtonText },
                      ]}
                    >
                      Save Changes
                    </Text>
                  </TouchableOpacity>
                </Animated.View>
              </View>

              {/* Share buttons + Trash */}
              <TouchableOpacity
                style={[
                  styles.modalDeleteButton,
                  { borderColor: theme.cardBorder },
                ]}
                onPress={handleShareFullReport}
              >
                <Text
                  style={[
                    styles.modalDeleteText,
                    { color: theme.textPrimary },
                  ]}
                >
                  Share full report (PDF)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalDeleteButton,
                  { borderColor: theme.cardBorder },
                ]}
                onPress={handleShareClientReport}
              >
                <Text
                  style={[
                    styles.modalDeleteText,
                    { color: theme.textPrimary },
                  ]}
                >
                  Share client report (PDF)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalDeleteButton,
                  { borderColor: theme.dangerBorder },
                ]}
                onPress={confirmMoveToTrash}
              >
                <Text
                  style={[
                    styles.modalDeleteText,
                    { color: theme.dangerText },
                  ]}
                >
                  Move to Trash
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => router.back()}
              >
                <Text
                  style={[styles.modalCloseText, { color: theme.textMuted }]}
                >
                  Close
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* Add Photo bottom sheet */}
          {isAddPhotoMenuVisible && (
            <View style={styles.addPhotoMenuOverlay}>
              <TouchableWithoutFeedback
                onPress={() => setIsAddPhotoMenuVisible(false)}
              >
                <View style={styles.addPhotoMenuBackdrop} />
              </TouchableWithoutFeedback>

              <View
                style={[
                  styles.addPhotoMenuSheet,
                  { backgroundColor: theme.cardBackground },
                ]}
              >
                <Text
                  style={[
                    styles.addPhotoMenuTitle,
                    { color: theme.textPrimary },
                  ]}
                >
                  Add Photo
                </Text>

                <TouchableOpacity
                  style={[
                    styles.addPhotoMenuOption,
                    {
                      backgroundColor: theme.cardBackground,
                      borderColor: theme.cardBorder,
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
                      borderColor: theme.cardBorder,
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
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    fontSize: 16,
  },
  simpleButton: {
    marginTop: 16,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 999,
  },
  simpleButtonText: {
    fontWeight: "600",
    fontSize: 14,
  },

  detailsScreen: {
    flex: 1,
    paddingTop: 48,
  },

  // HEADER
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
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
  },
  chatHeaderButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  chatHeaderButtonText: {
    fontSize: 12,
    fontWeight: "600",
  },

  // SCROLL CONTENT
  detailsScroll: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingBottom: 32,
  },

  // TEXT
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginTop: 16,
    marginBottom: 6,
  },
  infoText: {
    fontSize: 13,
    marginBottom: 8,
  },
  modalLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  modalInput: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    marginBottom: 10,
  },
  modalInputMultiline: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 10,
    minHeight: 96,
    textAlignVertical: "top",
  },
  modalMeta: {
    fontSize: 11,
    marginTop: 4,
    marginBottom: 10,
  },

  // BUTTONS
  modalButtonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 18,
    marginBottom: 8,
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
    fontWeight: "600",
  },
  modalDeleteButton: {
    marginTop: 10,
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: "center",
  },
  modalDeleteText: {
    fontSize: 13,
    fontWeight: "600",
  },
  modalCloseButton: {
    marginTop: 10,
    paddingVertical: 8,
    alignItems: "center",
  },
  modalCloseText: {
    fontSize: 13,
  },

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
  addPhotoButtonText: {
    fontSize: 13,
    fontWeight: "600",
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
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 26,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  addPhotoMenuTitle: {
    fontSize: 15,
    fontWeight: "600",
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
  },
  addPhotoMenuCancel: {
    marginTop: 6,
    paddingVertical: 8,
  },
  addPhotoMenuCancelText: {
    fontSize: 13,
    textAlign: "center",
  },

  // Pricing card
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
    fontWeight: "600",
  },
  pricingTotalHeaderValue: {
    fontSize: 20,
    color: "#FCD34D",
    fontWeight: "800",
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
  pricingSummaryBox: {
    marginTop: 6,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
  },
  pricingSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  pricingSummaryLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  pricingSummaryValue: {
    fontSize: 12,
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
    fontWeight: "700",
  },
  pricingTotalValue: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FCD34D",
  },

  // Quick actions
  quickActionsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
    marginBottom: 8,
  },
  quickActionButton: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: "600",
  },

  // Team Chat entry card (kept for future if needed)
  chatEntryCard: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginTop: 8,
    marginBottom: 4,
  },
  chatEntryTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4,
  },
  chatEntrySubtitle: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 10,
  },
  chatEntryButton: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  chatEntryButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
