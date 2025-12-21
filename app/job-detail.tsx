// app/job-detail.tsx
import CallIcon from "../assets/icons/call.png";
import MapIcon from "../assets/icons/map.png";
import TeamChatIcon from "../assets/icons/team-chat.png";

import AsyncStorage from "@react-native-async-storage/async-storage";
// ✅ CHANGED (1 import line): use legacy FS to avoid deprecated downloadAsync warning
import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import * as Print from "expo-print";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import React, { useEffect, useMemo, useRef, useState } from "react";
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
import { firebaseAuth } from "../firebaseConfig";

// ✅ Firestore
import { collection, doc, getDoc, getDocs, updateDoc } from "firebase/firestore";
import { db, storage } from "../firebaseConfig";

// ✅ Storage
import {
  deleteObject,
  getDownloadURL,
  ref as storageRef,
  uploadBytes,
} from "firebase/storage";

const USER_STORAGE_KEY = "EJT_USER_SESSION";

// ✅ Cloud photo object (industry standard: store URL + path)
type StoredPhoto = {
  url: string;
  path: string;
};

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
  photoUris?: string[]; // ✅ Independent: local URIs | Cloud: Storage download URLs (kept for backward compatibility)
  photoBase64s?: string[]; // ✅ Independent only (for PDF export)

  // ✅ NEW (cloud): url + path so we can delete from Storage
  photoFiles?: StoredPhoto[];

  // pricing
  laborHours?: number;
  hourlyRate?: number;
  materialCost?: number;

  // ✅ assignment (Option B)
  assignedToUid?: string | null;
};

type Role = "owner" | "employee" | "independent";
type Session = {
  uid?: string;
  email?: string | null;
  name?: string;
  role?: Role;
  companyId?: string | null;
};

type EmployeeRecord = {
  uid: string;
  name?: string;
  email?: string;
  role?: string;
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
const SCROLL_OFFSET = 80;

type ActiveSectionKey =
  | "jobInfo"
  | "client"
  | "pricing"
  | "photos"
  | "assignment"
  | null;

// ---------------- HELPERS ----------------

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

const safeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const withLineBreaks = (value: string) =>
  safeHtml(value).replace(/\n/g, "<br />");

const isHttpUrl = (u: string) => /^https?:\/\//i.test(u);
// ✅ Expo ImagePicker compat:
// Some SDKs only have MediaTypeOptions, newer ones have MediaType.
// This avoids TS errors + future-proofs the app.
const IMAGE_MEDIA_TYPES: any =
  (ImagePicker as any).MediaType?.Images ??
  (ImagePicker as any).MediaTypeOptions?.Images ??
  "Images";
// ✅ iOS Photos app often returns ph:// URIs. Convert them into a real file:// URI
// so fetch(uri).blob() works consistently.
async function ensureFileUriForUpload(inputUri: string): Promise<string> {
  if (!inputUri) return inputUri;

  const lower = inputUri.toLowerCase();
  const isPh = lower.startsWith("ph://");
  const isAssetsLib = lower.startsWith("assets-library://");

  // file:// already fine
  if (!isPh && !isAssetsLib) return inputUri;

  // Convert to a cached JPEG using ImageManipulator (creates file://)
  try {
    const out = await ImageManipulator.manipulateAsync(
      inputUri,
      [], // no transforms, just re-encode
      { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
    );
    return out.uri; // file://...
  } catch (e) {
    console.warn("ensureFileUriForUpload failed:", e);
    return inputUri; // fallback (may fail later, but we'll log)
  }
}

/**
 * =========================================================
 * ✅ PDF PREP HELPERS (2 helper blocks)
 * Turns BOTH:
 * - file://... (local optimistic preview)
 * - ph://... / assets-library://... (iOS)
 * - https://firebasestorage... (cloud URL)
 * into data URLs: data:image/jpeg;base64,...
 * =========================================================
 */

// ✅ Helper Block #1: mime + base64 -> data URL
const guessMimeFromUri = (uri: string): string => {
  const clean = (uri || "").split("?")[0].toLowerCase();
  const ext = clean.split(".").pop() || "";

  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "heic") return "image/heic";
  if (ext === "jpeg" || ext === "jpg") return "image/jpeg";
  return "image/jpeg";
};

const base64ToDataUrl = (base64: string, mime: string) =>
  `data:${mime};base64,${base64}`;

// ✅ Helper Block #2: uri -> base64 -> data URL (local OR remote)
async function uriToDataUrl(uri: string): Promise<string | null> {
  try {
    if (!uri) return null;

    const mime = guessMimeFromUri(uri);

    // iOS Photos URIs -> convert to file:// first
    const lower = uri.toLowerCase();
    if (lower.startsWith("ph://") || lower.startsWith("assets-library://")) {
      const fileUri = await ensureFileUriForUpload(uri);
      if (fileUri?.startsWith("file://")) {
        const b64 = await FileSystem.readAsStringAsync(fileUri, {
          encoding: "base64",
        });
        return base64ToDataUrl(b64, mime);
      }
      // If conversion fails, fall through and try original (best effort)
    }

    // Local file
    if (uri.startsWith("file://")) {
      const b64 = await FileSystem.readAsStringAsync(uri, { encoding: "base64" });
      return base64ToDataUrl(b64, mime);
    }

    // Remote URL (Firebase storage etc.)
    if (isHttpUrl(uri)) {
      const FS: any = FileSystem as any;
      const baseDir: string =
        (FS.cacheDirectory as string) || (FS.documentDirectory as string) || "";

      const ext =
        mime === "image/png"
          ? "png"
          : mime === "image/webp"
          ? "webp"
          : mime === "image/heic"
          ? "heic"
          : "jpg";

      const tmpPath = `${baseDir}job-photo-${Date.now()}-${Math.random()
        .toString(16)
        .slice(2)}.${ext}`;

      const dl = await FS.downloadAsync(uri, tmpPath);

      const b64: string = await FileSystem.readAsStringAsync(dl.uri, {
        encoding: "base64",
      });

      FS.deleteAsync(dl.uri, { idempotent: true }).catch(() => {});
      return base64ToDataUrl(b64, mime);
    }

    return null;
  } catch (e) {
    console.warn("uriToDataUrl failed:", uri, e);
    return null;
  }
}

// 🔹 Small component just for Photos UI (header + button + grid)
type JobPhotosSectionProps = {
  theme: any;
  accentColor: string;
  photoUris: string[];
  onPressAddPhoto: () => void;
  onPressThumb: (index: number) => void;
  onRemovePhoto: (uri: string) => void;
  disableRemove?: boolean;
};

function JobPhotosSection({
  theme,
  accentColor,
  photoUris,
  onPressAddPhoto,
  onPressThumb,
  onRemovePhoto,
  disableRemove,
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
            <View key={`${uri}-${index}`} style={styles.photoWrapper}>
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
                style={[
                  styles.photoRemoveButton,
                  disableRemove ? { opacity: 0.5 } : null,
                ]}
                disabled={!!disableRemove}
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

// ✅ icon-only action
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
      style={{ transform: [{ scale }], opacity: disabled ? 0.45 : 1 }}
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

// ✅ Upload local file URI to Firebase Storage and return BOTH url + path
async function uploadJobPhotoToStorage(params: {
  companyId: string;
  jobId: string;
  localUri: string;
}): Promise<StoredPhoto> {
  const { companyId, jobId, localUri } = params;

  // ✅ Fix iOS Photos app "ph://" URIs
  const uploadableUri = await ensureFileUriForUpload(localUri);

  // Fetch the local file as blob
  const resp = await fetch(uploadableUri);
  const blob = await resp.blob();

  // Try to infer extension
  const extGuess = (
    uploadableUri.split("?")[0].split(".").pop() || "jpg"
  ).toLowerCase();
  const safeExt = ["jpg", "jpeg", "png", "webp", "heic"].includes(extGuess)
    ? extGuess
    : "jpg";

  const filename = `${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}.${safeExt}`;
  const path = `companies/${companyId}/jobs/${jobId}/${filename}`;

  const ref = storageRef(storage, path);

  const contentType =
    safeExt === "png"
      ? "image/png"
      : safeExt === "webp"
      ? "image/webp"
      : safeExt === "heic"
      ? "image/heic"
      : "image/jpeg";

  await uploadBytes(ref, blob, { contentType });
  const url = await getDownloadURL(ref);

  return { url, path };
}

// ✅ Download remote URL to base64 (for PDF images in cloud mode)
// Kept for backward compatibility (not required by the new PDF prep)
async function downloadUrlToBase64(url: string): Promise<string | null> {
  try {
    const FS: any = FileSystem as any;

    const baseDir: string =
      (FS.cacheDirectory as string) || (FS.documentDirectory as string) || "";

    const tmpPath = `${baseDir}job-photo-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}.img`;

    const dl = await FS.downloadAsync(url, tmpPath);

    const base64: string = await FileSystem.readAsStringAsync(dl.uri, {
      encoding: "base64",
    });

    FS.deleteAsync(dl.uri, { idempotent: true }).catch(() => {});
    return base64;
  } catch (e) {
    console.warn("downloadUrlToBase64 failed:", e);
    return null;
  }
}

const normalizeStorageUrl = (u: string) => {
  try {
    const url = new URL(u);
    // Remove query string differences like ?alt=media&token=...
    return `${url.origin}${url.pathname}`;
  } catch {
    return u;
  }
};

export default function JobDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();

  // ✅ LOCKED theme + accent from PreferencesContext
  const { isReady, theme, accentColor } = usePreferences();

  // ✅ session (to know owner vs employee + company)
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);

  const isOwner = session?.role === "owner";
  const isEmployee = session?.role === "employee";
  const companyId = session?.companyId ?? null;

  const isCloudMode = (isOwner || isEmployee) && !!companyId;

  // ✅ IMPORTANT FIX:
  // Never "return;" from inside the component without returning JSX.
  // We'll guard cloud uploads by checking canUseCloudUploads.
  const user = firebaseAuth.currentUser;
  const canUseCloudUploads = isCloudMode && !!user;

  useEffect(() => {
    if (isCloudMode && !user) {
      Alert.alert(
        "Not logged in",
        "Firebase session expired. Please log out and log back in, then try uploading again."
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCloudMode, user?.uid]);

  // 🔹 Company branding (used in PDFs)
  const [companyName, setCompanyName] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [companyLicense, setCompanyLicense] = useState("");

  // ✅ assignment data (owner only)
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [assignedToUid, setAssignedToUid] = useState<string>("");
  const [isAssignMenuVisible, setIsAssignMenuVisible] = useState(false);

  // ✅ Upload state (cloud photos)
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);

  // ✅ Cloud photo files (url + path)
  const [photoFiles, setPhotoFiles] = useState<StoredPhoto[]>([]);

  // ✅ safe back
  const safeBack = () => {
    try {
      // @ts-ignore
      if (router?.canGoBack?.()) {
        router.back();
        return;
      }
    } catch {}
    router.replace("/home" as any);
  };

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

  // ✅ load session once
  useEffect(() => {
    const loadSession = async () => {
      try {
        const stored = await AsyncStorage.getItem(USER_STORAGE_KEY);
        if (!stored) {
          setSession(null);
          setSessionLoaded(true);
          return;
        }
        try {
          setSession(JSON.parse(stored));
        } catch {
          setSession(null);
        } finally {
          setSessionLoaded(true);
        }
      } catch {
        setSession(null);
        setSessionLoaded(true);
      }
    };
    loadSession();
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

  // ✅ UI URIs (independent: local uris, cloud: download URLs)
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

  // ✅ Keep Firestore in sync when cloud photos change
  const persistCloudPhotos = async (nextFiles: StoredPhoto[]) => {
    if (!isCloudMode) return;
    if (!companyId || !job?.id) return;

    const jobRef = doc(db, "companies", companyId, "jobs", job.id);
    const nextUris = nextFiles.map((f) => f.url);

    await updateDoc(jobRef, {
      photoFiles: nextFiles,
      photoUris: nextUris,
    });
  };

  // ---------- Load job (Cloud OR Local) ----------
  useEffect(() => {
    if (!id) {
      setIsLoading(false);
      return;
    }
    if (!sessionLoaded) return;

    const loadJob = async () => {
      try {
        setIsLoading(true);

        // ✅ CLOUD MODE: Firestore
        if (isCloudMode && companyId) {
          const jobRef = doc(db, "companies", companyId, "jobs", id);
          const snap = await getDoc(jobRef);
          if (!snap.exists()) {
            setJob(null);
            return;
          }

          const data: any = snap.data() ?? {};

          const loadedFiles: StoredPhoto[] = Array.isArray(data.photoFiles)
            ? data.photoFiles
                .map((p: any) => ({
                  url: typeof p?.url === "string" ? p.url : "",
                  path: typeof p?.path === "string" ? p.path : "",
                }))
                .filter((p: StoredPhoto) => !!p.url)
            : [];

          const loadedUris: string[] = Array.isArray(data.photoUris)
            ? data.photoUris
            : [];

          const effectiveFiles: StoredPhoto[] =
            loadedFiles.length > 0
              ? loadedFiles
              : loadedUris.map((u) => ({ url: String(u), path: "" }));

          const found: Job = {
            id: snap.id,
            title: String(data.title ?? ""),
            address: String(data.address ?? ""),
            description: String(data.description ?? ""),
            createdAt: normalizeCreatedAt(data.createdAt),
            isDone: Boolean(data.isDone ?? false),

            clientName: data.clientName ? String(data.clientName) : undefined,
            clientPhone: data.clientPhone ? String(data.clientPhone) : undefined,
            clientNotes: data.clientNotes ? String(data.clientNotes) : undefined,

            photoFiles: effectiveFiles,
            photoUris: effectiveFiles.map((f) => f.url),
            photoBase64s: [],

            laborHours: typeof data.laborHours === "number" ? data.laborHours : 0,
            hourlyRate:
              typeof data.hourlyRate === "number" ? data.hourlyRate : 0,
            materialCost:
              typeof data.materialCost === "number" ? data.materialCost : 0,

            assignedToUid:
              data.assignedToUid === null || data.assignedToUid === undefined
                ? null
                : String(data.assignedToUid),
          };

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

          setPhotoFiles(effectiveFiles);
          setPhotoUris(effectiveFiles.map((f) => f.url));
          setPhotoBase64s([]);

          setAssignedToUid(found.assignedToUid || "");
          return;
        }

        // ✅ INDEPENDENT MODE: AsyncStorage
        const jobsJson = await AsyncStorage.getItem(STORAGE_KEYS.JOBS);
        if (!jobsJson) {
          setJob(null);
          return;
        }

        const jobs: Job[] = JSON.parse(jobsJson);
        const found = jobs.find((j) => j.id === id);
        if (!found) {
          setJob(null);
          return;
        }

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

        setAssignedToUid(found.assignedToUid || "");
      } catch (e) {
        console.warn("Failed to load job:", e);
        setJob(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadJob();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isCloudMode, companyId, sessionLoaded]);

  // ✅ Load employees list (owner only + has companyId)
  useEffect(() => {
    const loadEmployees = async () => {
      if (!isOwner) return;
      if (!companyId) return;

      try {
        const ref = collection(db, "companies", companyId, "employees");
        const snap = await getDocs(ref);

        const list: EmployeeRecord[] = snap.docs.map((d) => {
          const data: any = d.data() ?? {};
          const uid = String(data.uid ?? d.id);
          return {
            uid,
            name: data.name ? String(data.name) : undefined,
            email: data.email ? String(data.email) : undefined,
            role: data.role ? String(data.role) : undefined,
          };
        });

        const filtered = list.filter((e) => (e.role ? e.role !== "owner" : true));
        setEmployees(filtered);
      } catch (e) {
        console.warn("Failed to load employees:", e);
        setEmployees([]);
      }
    };

    loadEmployees();
  }, [isOwner, companyId]);

  const assignedLabel = useMemo(() => {
    if (!assignedToUid) return "Unassigned";
    const found = employees.find((e) => e.uid === assignedToUid);
    if (!found) return "Assigned";
    return found.name?.trim()
      ? found.name.trim()
      : found.email?.trim()
      ? found.email.trim()
      : "Assigned";
  }, [assignedToUid, employees]);

  const employeeAssignedLabel = useMemo(() => {
    if (!assignedToUid) return "Unassigned";
    if (session?.uid && assignedToUid === session.uid) return "You";
    const short = assignedToUid.slice(0, 6) + "…" + assignedToUid.slice(-4);
    return `Assigned (${short})`;
  }, [assignedToUid, session?.uid]);

  // ✅ Firestore update helpers
  const getCloudJobRef = () => {
    if (!companyId) return null;
    if (!job?.id) return null;
    return doc(db, "companies", companyId, "jobs", job.id);
  };

  const updateAssignmentFirestore = async (nextUid: string) => {
    const jobRef = getCloudJobRef();
    if (!jobRef) {
      Alert.alert("Missing company/job", "Could not locate the job in cloud.");
      return;
    }

    try {
      await updateDoc(jobRef, { assignedToUid: nextUid || null });
    } catch (e) {
      console.warn("Failed to update assignment:", e);
      Alert.alert("Error", "Could not update assignment. Try again.");
      throw e;
    }
  };

  const handleAssignTo = async (nextUid: string) => {
    if (!job) return;

    handleFocus("assignment");

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setAssignedToUid(nextUid || "");
    setIsAssignMenuVisible(false);

    const updatedJob: Job = { ...job, assignedToUid: nextUid ? nextUid : null };
    setJob(updatedJob);

    if (isCloudMode) {
      await updateAssignmentFirestore(nextUid);
      return;
    }

    try {
      const jobsJson = await AsyncStorage.getItem(STORAGE_KEYS.JOBS);
      const jobs: Job[] = jobsJson ? JSON.parse(jobsJson) : [];
      const next = jobs.map((j) => (j.id === job.id ? updatedJob : j));
      await persistJobs(next);
    } catch (e) {
      console.warn("Failed to persist assignment locally:", e);
    }
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

      // ✅ photos
      photoUris: isCloudMode ? photoFiles.map((f) => f.url) : photoUris,
      photoFiles: isCloudMode ? photoFiles : undefined,

      // ✅ cloud never stores base64
      photoBase64s: isCloudMode ? [] : photoBase64s,

      assignedToUid: assignedToUid ? assignedToUid : null,
    };

    try {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

      // ✅ CLOUD MODE: update Firestore
      if (isCloudMode) {
        const jobRef = getCloudJobRef();
        if (!jobRef) {
          Alert.alert("Missing company/job", "Could not locate the job in cloud.");
          return;
        }

        await updateDoc(jobRef, {
          title: updated.title,
          address: updated.address,
          description: updated.description,
          clientName: updated.clientName || null,
          clientPhone: updated.clientPhone || null,
          clientNotes: updated.clientNotes || null,
          isDone: updated.isDone,
          laborHours: updated.laborHours ?? 0,
          hourlyRate: updated.hourlyRate ?? 0,
          materialCost: updated.materialCost ?? 0,

          // ✅ store both
          photoFiles: photoFiles,
          photoUris: photoFiles.map((f) => f.url),

          assignedToUid: updated.assignedToUid || null,
        });

        setJob(updated);
        Alert.alert("Saved", "Job details updated.", [{ text: "OK", onPress: safeBack }]);
        return;
      }

      // ✅ INDEPENDENT: AsyncStorage
      const jobsJson = await AsyncStorage.getItem(STORAGE_KEYS.JOBS);
      const jobs: Job[] = jobsJson ? JSON.parse(jobsJson) : [];
      const next = jobs.map((j) => (j.id === job.id ? updated : j));

      await persistJobs(next);
      setJob(updated);

      Alert.alert("Saved", "Job details updated.", [{ text: "OK", onPress: safeBack }]);
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
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

      if (isCloudMode) {
        const jobRef = getCloudJobRef();
        if (!jobRef) return;
        await updateDoc(jobRef, { isDone: nextDone });
        setJob((prev) => (prev ? { ...prev, isDone: nextDone } : prev));
        return;
      }

      const jobsJson = await AsyncStorage.getItem(STORAGE_KEYS.JOBS);
      const jobs: Job[] = jobsJson ? JSON.parse(jobsJson) : [];
      const next = jobs.map((j) => (j.id === job.id ? { ...j, isDone: nextDone } : j));

      await persistJobs(next);
      setJob((prev) => (prev ? { ...prev, isDone: nextDone } : prev));
    } catch (e) {
      console.warn("Failed to toggle done:", e);
    }
  };

  const confirmMoveToTrash = () => {
    if (!job) return;

    if (isCloudMode) {
      Alert.alert(
        "Not available yet",
        "Trash is only available for Independent mode right now. (We’ll add Firestore delete/trash next.)"
      );
      return;
    }

    Alert.alert("Move to Trash", "Are you sure you want to move this job to Trash?", [
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

            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            await Promise.all([
              AsyncStorage.setItem(STORAGE_KEYS.JOBS, JSON.stringify(remaining)),
              AsyncStorage.setItem(STORAGE_KEYS.TRASH, JSON.stringify(newTrash)),
            ]);

            safeBack();
          } catch (e) {
            console.warn("Failed to move to trash:", e);
            Alert.alert("Error", "Could not move job to Trash.");
          }
        },
      },
    ]);
  };

  // ---------- Photos ----------
  const requireCloudAuth = () => {
    if (!isCloudMode) return true; // independent doesn't need auth
    if (!canUseCloudUploads) {
      Alert.alert(
        "Not logged in",
        "Firebase session expired. Please log out and log back in, then try uploading again."
      );
      return false;
    }
    return true;
  };

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
      mediaTypes: IMAGE_MEDIA_TYPES,
      allowsMultipleSelection: true,
      quality: 0.7,
      base64: !isCloudMode,
    });

    if (result.canceled || !result.assets?.length) return;

    // ✅ INDEPENDENT: keep local uri + base64
    if (!isCloudMode) {
      const newUris: string[] = [];
      const newBase64s: string[] = [];

      for (const asset of result.assets) {
        if (!asset.uri) continue;
        newUris.push(asset.uri);
        if (asset.base64) newBase64s.push(asset.base64);
      }

      if (!newUris.length) return;

      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setPhotoUris((prev) => [...prev, ...newUris]);
      setPhotoBase64s((prev) => [...prev, ...newBase64s]);
      return;
    }

    // ✅ CLOUD
    if (!requireCloudAuth()) return;

    if (!companyId || !job?.id) {
      Alert.alert("Missing company/job", "Cannot upload photos without company + job id.");
      return;
    }

    const localUris = result.assets.map((a) => a.uri).filter(Boolean) as string[];
    if (!localUris.length) return;

    // Optimistic: show local previews while uploading
    const baseIndex = photoUris.length;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setPhotoUris((prev) => [...prev, ...localUris]);

    setIsUploadingPhotos(true);
    try {
      const uploaded: StoredPhoto[] = [];

      for (let i = 0; i < localUris.length; i++) {
        const localUri = localUris[i];

        const file = await uploadJobPhotoToStorage({
          companyId,
          jobId: job.id,
          localUri,
        });

        uploaded.push(file);

        // Replace local preview with download URL (by index)
        setPhotoUris((prev) => {
          const next = [...prev];
          const idx = baseIndex + i;
          if (idx >= 0 && idx < next.length) next[idx] = file.url;
          return next;
        });
      }

      // Merge into cloud photoFiles
      const nextFiles = [...photoFiles, ...uploaded];
      setPhotoFiles(nextFiles);

      // Persist to Firestore immediately
      await persistCloudPhotos(nextFiles);

      Alert.alert("Uploaded", "Photos uploaded to cloud storage.");
    } catch (e: any) {
      console.warn("Upload failed:", e);

      const code = e?.code ? String(e.code) : "";
      const message = e?.message ? String(e.message) : "";
      const raw = (() => {
        try {
          return JSON.stringify(e);
        } catch {
          return String(e);
        }
      })();

      Alert.alert("Upload failed", `Could not upload photo.\n\n${code}\n${message}\n\n${raw}`);
    } finally {
      setIsUploadingPhotos(false);
    }
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
      mediaTypes: IMAGE_MEDIA_TYPES,
      quality: 0.7,
      base64: !isCloudMode,
    });

    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset?.uri) return;

    // ✅ INDEPENDENT
    if (!isCloudMode) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setPhotoUris((prev) => [...prev, asset.uri]);
      if (asset.base64) setPhotoBase64s((prev) => [...prev, asset.base64 as string]);
      return;
    }

    // ✅ CLOUD
    if (!requireCloudAuth()) return;

    if (!companyId || !job?.id) {
      Alert.alert("Missing company/job", "Cannot upload photos without company + job id.");
      return;
    }

    const baseIndex = photoUris.length;

    // optimistic preview
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setPhotoUris((prev) => [...prev, asset.uri]);

    setIsUploadingPhotos(true);
    try {
      const file = await uploadJobPhotoToStorage({
        companyId,
        jobId: job.id,
        localUri: asset.uri,
      });

      setPhotoUris((prev) => {
        const next = [...prev];
        if (baseIndex >= 0 && baseIndex < next.length) next[baseIndex] = file.url;
        return next;
      });

      const nextFiles = [...photoFiles, file];
      setPhotoFiles(nextFiles);
      await persistCloudPhotos(nextFiles);

      Alert.alert("Uploaded", "Photo uploaded to cloud storage.");
    } catch (e: any) {
      console.warn("Upload failed:", e);

      const code = e?.code ? String(e.code) : "";
      const message = e?.message ? String(e.message) : "";
      const raw = (() => {
        try {
          return JSON.stringify(e);
        } catch {
          return String(e);
        }
      })();

      Alert.alert("Upload failed", `Could not upload photo.\n\n${code}\n${message}\n\n${raw}`);
    } finally {
      setIsUploadingPhotos(false);
    }
  };

  const handleRemovePhoto = (uriToRemove: string) => {
    const index = photoUris.indexOf(uriToRemove);

    Alert.alert("Remove photo", "Are you sure you want to remove this photo from the job?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          // ✅ INDEPENDENT: just remove local lists
          if (!isCloudMode) {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setPhotoUris((prev) => prev.filter((u) => u !== uriToRemove));
            setPhotoBase64s((prev) =>
              index >= 0 ? prev.filter((_, i) => i !== index) : prev
            );
            return;
          }

          // ✅ CLOUD: delete from Storage (if we have path) + update Firestore
          try {
            const targetNorm = normalizeStorageUrl(uriToRemove);

            const file = photoFiles.find((f) => normalizeStorageUrl(f.url) === targetNorm);

            // Update UI immediately
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setPhotoUris((prev) =>
              prev.filter((u) => normalizeStorageUrl(u) !== targetNorm)
            );

            // Remove from photoFiles in state
            const nextFiles = photoFiles.filter(
              (f) => normalizeStorageUrl(f.url) !== targetNorm
            );
            setPhotoFiles(nextFiles);

            // Persist Firestore right away
            await persistCloudPhotos(nextFiles);

            // Best effort: delete object in Storage
            if (file?.path) {
              await deleteObject(storageRef(storage, file.path));
            } else {
              console.warn(
                "Cloud photo removed but no storage path was available (legacy photoUris)."
              );
            }

            Alert.alert("Removed", "Photo removed.");
          } catch (e) {
            console.warn("Failed to remove cloud photo:", e);
            Alert.alert("Error", "Could not remove photo. Try again.");
          }
        },
      },
    ]);
  };

  const handleOpenFullImage = (index: number) => {
    setFullImageIndex(index);
    setIsImageOverlayVisible(true);
  };

  // ✅ Create base64s for PDF (legacy)
  const getPdfPhotoBase64s = async (): Promise<string[]> => {
    if (!photoUris.length) return [];

    if (!isCloudMode) {
      return photoBase64s.length ? photoBase64s : job?.photoBase64s || [];
    }

    const urls = photoFiles.map((f) => f.url).filter((u) => isHttpUrl(u));

    const bases: string[] = [];
    for (const url of urls) {
      const b64 = await downloadUrlToBase64(url);
      if (b64) bases.push(b64);
    }
    return bases;
  };

  const guardShareWhileUploading = () => {
    if (!isCloudMode) return false;
    if (isUploadingPhotos) {
      Alert.alert("Uploading…", "Wait until photo uploads finish, then try sharing again.");
      return true;
    }
    // If any previews are still local, block share (avoids missing images)
    const hasLocalPreview = photoUris.some((u) => u && !isHttpUrl(u));
    if (hasLocalPreview) {
      Alert.alert("Uploading…", "Some photos are still syncing. Give it a moment, then share again.");
      return true;
    }
    return false;
  };

  // ---------- Share full report ----------
  const handleShareFullReport = async () => {
    if (!job) return;
    if (guardShareWhileUploading()) return;

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
      if (brandName)
        companyHeaderLines.push(`<div class="company-name">${safeHtml(brandName)}</div>`);
      if (brandPhone)
        companyHeaderLines.push(`<div class="company-line">${safeHtml(brandPhone)}</div>`);
      if (brandEmail)
        companyHeaderLines.push(`<div class="company-line">${safeHtml(brandEmail)}</div>`);
      if (brandLicense)
        companyHeaderLines.push(`<div class="company-line">${safeHtml(brandLicense)}</div>`);

      const companyHeaderHtml = hasBranding
        ? `<div class="company-block">${companyHeaderLines.join("")}</div>`
        : "";

      /**
       * ✅ UPDATED PHOTO SECTION (PDF PREP ONLY)
       * Build data URLs from BOTH:
       * - file:// optimistic previews
       * - https:// firebasestorage urls
       * - ph:// etc (iOS)
       */
      const dataUrls: string[] = [];

      // Prefer what's currently on screen (includes local optimistic previews)
      const sources = (photoUris || []).filter(Boolean);

      for (const src of sources) {
        const dataUrl = await uriToDataUrl(src);
        if (dataUrl) dataUrls.push(dataUrl);
      }

      // Independent fallback: if we couldn't build from URIs but we have stored base64s
      if (!dataUrls.length && !isCloudMode) {
        const bases = photoBase64s.length ? photoBase64s : job?.photoBase64s || [];
        for (const b64 of bases) {
          if (!b64) continue;
          dataUrls.push(base64ToDataUrl(b64, "image/jpeg"));
        }
      }

      const photoBlocks: string[] = [];
      for (let i = 0; i < dataUrls.length; i++) {
        const dataUrl = dataUrls[i];
        photoBlocks.push(`
          <div class="photo">
            <img src="${dataUrl}" />
            <div class="photo-label">Photo ${i + 1}</div>
          </div>
        `);
      }

      const photosSection =
        dataUrls.length === 0
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
                  ${editClientName.trim() ? safeHtml(editClientName.trim()) : "Not set"}
                </div>

                <div class="label">Client Phone</div>
                <div class="value">
                  ${editClientPhone.trim() ? safeHtml(editClientPhone.trim()) : "Not set"}
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
    if (guardShareWhileUploading()) return;

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
        companyHeaderLines.push(`<div class="company-name">${safeHtml(brandName)}</div>`);
      if (brandPhone)
        companyHeaderLines.push(`<div class="company-line">${safeHtml(brandPhone)}</div>`);
      if (brandEmail)
        companyHeaderLines.push(`<div class="company-line">${safeHtml(brandEmail)}</div>`);
      if (brandLicense)
        companyHeaderLines.push(`<div class="company-line">${safeHtml(brandLicense)}</div>`);

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
                <div class="value">${withLineBreaks(
                  editDescription || job.description
                )}</div>
              </div>

              <div class="section">
                <h2>Client Info</h2>
                <div class="label">Client Name</div>
                <div class="value">${
                  editClientName.trim()
                    ? safeHtml(editClientName.trim())
                    : "Not set"
                }</div>

                <div class="label">Client Phone</div>
                <div class="value">${
                  editClientPhone.trim()
                    ? safeHtml(editClientPhone.trim())
                    : "Not set"
                }</div>
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
    if (guardShareWhileUploading()) return;

    Alert.alert("Share", "Choose what to share", [
      { text: "Cancel", style: "cancel" },
      { text: "Share full report (PDF)", onPress: handleShareFullReport },
      { text: "Share client report (PDF)", onPress: handleShareClientReport },
    ]);
  };

  // ✅ Don’t render until prefs are ready
  if (!isReady) {
    return <View style={{ flex: 1, backgroundColor: themes.graphite.screenBackground }} />;
  }

  // ---------- Render states ----------
  if (isLoading) {
    return (
      <View style={[styles.loadingScreen, { backgroundColor: theme.screenBackground }]}>
        <Text style={[styles.loadingText, { color: theme.textPrimary }]}>Loading job…</Text>
      </View>
    );
  }

  if (!job) {
    return (
      <View style={[styles.loadingScreen, { backgroundColor: theme.screenBackground }]}>
        <Text style={[styles.loadingText, { color: theme.textPrimary }]}>Job not found.</Text>
        <TouchableOpacity
          style={[styles.simpleButton, { backgroundColor: accentColor }]}
          onPress={safeBack}
        >
          <Text style={[styles.simpleButtonText, { color: "#F9FAFB" }]}>Back</Text>
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
          { transform: [{ scale: screenScale }], backgroundColor: theme.screenBackground },
        ]}
      >
        {/* TOP NAV */}
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={safeBack} style={styles.backButton} activeOpacity={0.8}>
            <Text style={[styles.backText, { color: theme.headerMuted }]}>← Back</Text>
          </TouchableOpacity>

          <Text style={[styles.headerTitle, { color: theme.headerText }]}>Job Detail</Text>

          <TouchableOpacity
            style={[styles.chatHeaderButton, { backgroundColor: accentColor }]}
            activeOpacity={0.9}
            onPress={openShareChooser}
          >
            <Text style={[styles.chatHeaderButtonText, { color: "#F9FAFB" }]}>Share</Text>
          </TouchableOpacity>
        </View>

        {!!isUploadingPhotos && (
          <View style={{ paddingHorizontal: 18, paddingBottom: 8 }}>
            <Text style={{ color: theme.textMuted, fontFamily: "Athiti-SemiBold", fontSize: 12 }}>
              Uploading photos to cloud…
            </Text>
          </View>
        )}

        <ScrollView
          contentContainerStyle={[
            styles.detailsScroll,
            { paddingBottom: isEditing ? 18 : STICKY_BAR_HEIGHT + 26 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          onScrollBeginDrag={dismissKeyboard}
          ref={scrollRef}
        >
          <TouchableWithoutFeedback onPress={dismissKeyboard} accessible={false}>
            <View>
              {/* HERO HEADER */}
              <View style={styles.heroWrap}>
                <View
                  style={[
                    styles.heroBg,
                    { borderColor: theme.cardBorder, backgroundColor: theme.cardBackground },
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
                    <Text numberOfLines={1} style={[styles.heroTitle, { color: theme.headerText }]}>
                      {editTitle || job.title}
                    </Text>

                    <Text
                      numberOfLines={2}
                      style={[styles.heroSubtitle, { color: theme.textSecondary }]}
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
                    onPress={() => {
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
                    }}
                    disabled={!editClientPhone.trim()}
                    size={54}
                  />

                  <ActionIcon
                    iconSource={MapIcon}
                    onPress={() => {
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
                    }}
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

              {/* ✅ EMPLOYEE: read-only assignment info (Cloud mode) */}
              {isEmployee && isCloudMode ? (
                <SectionCard
                  theme={theme}
                  accentColor={accentColor}
                  title="Assignment"
                  subtitle="Who this job is assigned to"
                  icon="🧑‍🔧"
                  isActive={false}
                  isDimmed={false}
                  onLayout={(y) => registerSection("assignment", y)}
                >
                  <View style={styles.assignmentRow}>
                    <Text style={[styles.assignmentLabel, { color: theme.textMuted }]}>
                      Assigned to
                    </Text>

                    <View
                      style={[
                        styles.assignmentPicker,
                        {
                          backgroundColor: theme.inputBackground,
                          borderColor: theme.inputBorder,
                          opacity: 0.95,
                        },
                      ]}
                    >
                      <Text style={[styles.assignmentPickerText, { color: theme.textPrimary }]}>
                        {employeeAssignedLabel}
                      </Text>
                    </View>
                  </View>

                  <Text style={[styles.assignmentHint, { color: theme.textMuted }]}>
                    Only assigned jobs appear on your Home screen.
                  </Text>
                </SectionCard>
              ) : null}

              {/* ✅ OWNER ONLY: ASSIGNMENT CARD (Cloud only) */}
              {isOwner && isCloudMode ? (
                <SectionCard
                  theme={theme}
                  accentColor={accentColor}
                  title="Assignment"
                  subtitle="Assign this job to an employee"
                  icon="🧑‍🔧"
                  isActive={cardIsActive("assignment")}
                  isDimmed={cardIsDimmed("assignment")}
                  onLayout={(y) => registerSection("assignment", y)}
                >
                  <View style={styles.assignmentRow}>
                    <Text style={[styles.assignmentLabel, { color: theme.textMuted }]}>
                      Assigned to
                    </Text>

                    <TouchableOpacity
                      style={[
                        styles.assignmentPicker,
                        {
                          backgroundColor: theme.inputBackground,
                          borderColor: isAssignMenuVisible ? accentColor : theme.inputBorder,
                        },
                      ]}
                      activeOpacity={0.9}
                      onPress={() => {
                        handleFocus("assignment");
                        setIsAssignMenuVisible((p) => !p);
                      }}
                    >
                      <Text style={[styles.assignmentPickerText, { color: theme.textPrimary }]}>
                        {assignedLabel}
                      </Text>
                      <Text style={[styles.assignmentPickerChevron, { color: theme.textMuted }]}>
                        ▾
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.assignmentActionsRow}>
                    <TouchableOpacity
                      style={[
                        styles.assignmentSmallButton,
                        {
                          backgroundColor: accentColor,
                          opacity: employees.length ? 1 : 0.6,
                        },
                      ]}
                      activeOpacity={0.9}
                      onPress={() => {
                        if (!employees.length) {
                          Alert.alert(
                            "No employees",
                            "No employees found in companies/{companyId}/employees."
                          );
                          return;
                        }
                        handleFocus("assignment");
                        setIsAssignMenuVisible(true);
                      }}
                    >
                      <Text style={[styles.assignmentSmallButtonText, { color: "#F9FAFB" }]}>
                        Choose employee
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.assignmentSmallButton,
                        {
                          backgroundColor: theme.secondaryButtonBackground,
                          borderColor: theme.cardBorder,
                          borderWidth: 1,
                          opacity: assignedToUid ? 1 : 0.6,
                        },
                      ]}
                      activeOpacity={0.9}
                      disabled={!assignedToUid}
                      onPress={() => {
                        Alert.alert("Unassign", "Remove assignment from this job?", [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: "Unassign",
                            style: "destructive",
                            onPress: async () => {
                              try {
                                await handleAssignTo("");
                              } catch {}
                            },
                          },
                        ]);
                      }}
                    >
                      <Text
                        style={[
                          styles.assignmentSmallButtonText,
                          { color: theme.secondaryButtonText },
                        ]}
                      >
                        Unassign
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {isAssignMenuVisible ? (
                    <View
                      style={[
                        styles.assignmentDropdown,
                        { backgroundColor: theme.cardSecondaryBackground, borderColor: theme.cardBorder },
                      ]}
                    >
                      <TouchableOpacity
                        style={styles.assignmentOption}
                        onPress={async () => {
                          try {
                            await handleAssignTo("");
                          } catch {}
                        }}
                      >
                        <Text style={[styles.assignmentOptionText, { color: theme.textPrimary }]}>
                          Unassigned
                        </Text>
                      </TouchableOpacity>

                      {employees.map((emp) => {
                        const label =
                          emp.name?.trim() ||
                          emp.email?.trim() ||
                          emp.uid.slice(0, 6) + "…" + emp.uid.slice(-4);

                        const isActive = emp.uid === assignedToUid;

                        return (
                          <TouchableOpacity
                            key={emp.uid}
                            style={[
                              styles.assignmentOption,
                              isActive && { backgroundColor: accentColor + "1A" },
                            ]}
                            onPress={async () => {
                              try {
                                await handleAssignTo(emp.uid);
                              } catch {}
                            }}
                          >
                            <Text
                              style={[
                                styles.assignmentOptionText,
                                { color: isActive ? accentColor : theme.textPrimary },
                              ]}
                            >
                              {label}
                            </Text>
                            {isActive ? (
                              <Text style={[styles.assignmentOptionCheck, { color: accentColor }]}>
                                ✓
                              </Text>
                            ) : null}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ) : null}

                  <Text style={[styles.assignmentHint, { color: theme.textMuted }]}>
                    Employees will only see jobs assigned to their UID.
                  </Text>
                </SectionCard>
              ) : null}

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
                  <Text style={[styles.metaLabel, { color: theme.textMuted }]}>Job ID</Text>
                  <Text style={[styles.metaValue, { color: theme.textPrimary }]}>{job.id}</Text>
                </View>

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
                  value={editTitle}
                  onChangeText={setEditTitle}
                  placeholderTextColor={theme.textMuted}
                  onFocus={() => handleFocus("jobInfo")}
                  onBlur={() => setIsEditing(false)}
                />

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
                <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>Client Name</Text>
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

                <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>Client Phone</Text>
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

                <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>Client Notes</Text>
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
                    { backgroundColor: theme.cardSecondaryBackground, borderColor: theme.cardBorder },
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
                        onFocus={() => handleFocus("pricing")}
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
                        onFocus={() => handleFocus("pricing")}
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
                  photoUris={photoUris.filter(Boolean)}
                  onPressAddPhoto={() => setIsAddPhotoMenuVisible(true)}
                  onPressThumb={handleOpenFullImage}
                  onRemovePhoto={handleRemovePhoto}
                  disableRemove={isUploadingPhotos}
                />
              </SectionCard>

              {/* TRASH */}
              <SectionCard theme={theme} accentColor={accentColor} title="Trash" icon="⚠️">
                <TouchableOpacity
                  style={[
                    styles.modalDeleteButton,
                    { borderColor: theme.dangerBorder, opacity: isCloudMode ? 0.55 : 1 },
                  ]}
                  onPress={confirmMoveToTrash}
                  disabled={isCloudMode}
                >
                  <Text style={[styles.modalDeleteText, { color: theme.dangerText }]}>
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
              { backgroundColor: theme.screenBackground, borderTopColor: theme.cardBorder },
            ]}
          >
            <View style={styles.stickyButtonsRow}>
              <Animated.View style={{ flex: 1, transform: [{ scale: markDoneScale }] }}>
                <TouchableOpacity
                  style={[
                    styles.stickyButton,
                    { backgroundColor: isDone ? theme.secondaryButtonBackground : accentColor },
                  ]}
                  onPress={handleToggleDone}
                  activeOpacity={0.9}
                  onPressIn={markDoneAnim.onPressIn}
                  onPressOut={markDoneAnim.onPressOut}
                >
                  <Text
                    style={[
                      styles.stickyButtonText,
                      { color: isDone ? theme.secondaryButtonText : "#F9FAFB" },
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
            <View style={[styles.addPhotoMenuSheet, { backgroundColor: theme.cardBackground }]}>
              <Text style={[styles.addPhotoMenuTitle, { color: theme.textPrimary }]}>Add Photo</Text>

              <TouchableOpacity
                style={[
                  styles.addPhotoMenuOption,
                  { backgroundColor: theme.cardBackground, borderColor: accentColor },
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
                  { backgroundColor: theme.cardBackground, borderColor: accentColor },
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

        {/* Fullscreen viewer */}
        {photoUris.filter(Boolean).length > 0 && (
          <ImageViewing
            images={photoUris.filter(Boolean).map((uri) => ({ uri }))}
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
  heroBg: { height: 132, borderRadius: 22, overflow: "hidden", borderWidth: 1 },
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
  card: { borderRadius: 18, borderWidth: 1, padding: 14, marginBottom: 12 },
  cardActiveShadow: {
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  cardHeaderRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  cardIconBubble: {
    width: 38,
    height: 38,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  cardIconText: { fontSize: 16, fontFamily: "Athiti-Bold" },
  cardTitle: { fontSize: 13, marginBottom: 2, fontFamily: "Athiti-Bold" },
  cardSubtitle: { fontSize: 11, fontFamily: "Athiti-SemiBold" },
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

  // Assignment
  assignmentRow: { gap: 8 },
  assignmentLabel: { fontSize: 12, fontFamily: "Athiti-SemiBold" },
  assignmentPicker: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
  },
  assignmentPickerText: { flex: 1, fontSize: 14, fontFamily: "Athiti-SemiBold" },
  assignmentPickerChevron: {
    fontSize: 14,
    fontFamily: "Athiti-Bold",
    marginLeft: 8,
  },
  assignmentActionsRow: { flexDirection: "row", gap: 10, marginTop: 10 },
  assignmentSmallButton: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: "center",
  },
  assignmentSmallButtonText: { fontSize: 13, fontFamily: "Athiti-Bold" },
  assignmentDropdown: {
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  assignmentOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  assignmentOptionText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Athiti-SemiBold",
  },
  assignmentOptionCheck: { fontSize: 14, fontFamily: "Athiti-Bold" },
  assignmentHint: { marginTop: 10, fontSize: 11, fontFamily: "Athiti-Regular" },

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
  photoRemoveText: {
    color: "#FCA5A5",
    fontSize: 10,
    fontFamily: "Athiti-Bold",
  },

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
  pricingTotalHeaderValue: { fontSize: 20, fontFamily: "Athiti-Bold" },
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
