// app/settings.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
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
import { THEME_STORAGE_KEY, ThemeName, themes } from "./theme";

const themeLabels: Record<ThemeName, string> = {
  light: "Light",
  dark: "Dark",
  midnight: "Midnight Blue",
};

// Use the SAME key as Home/Add Job
const JOBS_STORAGE_KEY = "EJT_JOBS";

// Track last backup time
const LAST_EXPORT_KEY = "EJT_LAST_EXPORT_AT";

// Accent color types + presets
type AccentName = "blue" | "amber" | "emerald" | "purple" | "rose";

const ACCENT_STORAGE_KEY = "EJT_ACCENT_COLOR";

const accentPresets: Record<
  AccentName,
  { label: string; color: string; chipBg: string }
> = {
  blue: {
    label: "Electric Blue",
    color: "#3B82F6",
    chipBg: "rgba(59,130,246,0.12)",
  },
  amber: {
    label: "Jobsite Amber",
    color: "#F59E0B",
    chipBg: "rgba(245,158,11,0.12)",
  },
  emerald: {
    label: "Emerald",
    color: "#10B981",
    chipBg: "rgba(16,185,129,0.12)",
  },
  purple: {
    label: "Royal Purple",
    color: "#8B5CF6",
    chipBg: "rgba(139,92,246,0.12)",
  },
  rose: {
    label: "Rose Red",
    color: "#F97373",
    chipBg: "rgba(248,113,113,0.12)",
  },
};

// Job defaults storage keys
const DEFAULTS_STORAGE_KEYS = {
  HOURLY: "EJT_DEFAULT_HOURLY",
  CLIENT_NAME: "EJT_DEFAULT_CLIENT_NAME",
  NOTES_TEMPLATE: "EJT_DEFAULT_NOTES_TEMPLATE",
};

export default function SettingsScreen() {
  const router = useRouter();

  const [themeName, setThemeName] = useState<ThemeName>("dark");
  const [isThemeExpanded, setIsThemeExpanded] = useState(false);

  const [accentName, setAccentName] = useState<AccentName>("blue");
  const [isAccentExpanded, setIsAccentExpanded] = useState(false);

  const theme = themes[themeName];
  const accent = accentPresets[accentName];

  // Backup / restore state
  const [isExportModalVisible, setIsExportModalVisible] = useState(false);
  const [isImportModalVisible, setIsImportModalVisible] = useState(false);
  const [exportJson, setExportJson] = useState("");
  const [importJson, setImportJson] = useState("");

  // Track last export timestamp
  const [lastExportAt, setLastExportAt] = useState<string | null>(null);

  // About modal
  const [isAboutModalVisible, setIsAboutModalVisible] = useState(false);

  // Job Defaults state (strings for TextInputs)
  const [defaultHourly, setDefaultHourly] = useState("");
  const [defaultClientName, setDefaultClientName] = useState("");
  const [defaultNotesTemplate, setDefaultNotesTemplate] = useState("");

  // Refs for focusing inputs
  const hourlyRef = useRef<TextInput | null>(null);
  const clientRef = useRef<TextInput | null>(null);
  const notesRef = useRef<TextInput | null>(null);

  // Ref to force-blur the import TextInput
  const importInputRef = useRef<TextInput | null>(null);

  // ---------- SCROLL + SECTION POSITIONS (same idea as add-job) ----------
  const scrollViewRef = useRef<ScrollView | null>(null);
  const sectionPositions = useRef<Record<string, number>>({});

  const handleSectionLayout = (key: string, y: number) => {
    sectionPositions.current[key] = y;
  };

  const scrollToSection = (key: string) => {
    const y = sectionPositions.current[key] ?? 0;
    const offset = Math.max(y - 80, 0); // small offset so it’s not glued to the top

    scrollViewRef.current?.scrollTo({
      y: offset,
      animated: true,
    });
  };

  const blurImportInput = () => {
    if (importInputRef.current) {
      // @ts-ignore – fine at runtime
      importInputRef.current.blur();
    }
    Keyboard.dismiss();
  };

  const loadTheme = useCallback(async () => {
    try {
      const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (saved === "light" || saved === "dark" || saved === "midnight") {
        setThemeName(saved as ThemeName);
      }
    } catch (err) {
      console.warn("Failed to load theme:", err);
    }
  }, []);

  const loadAccent = useCallback(async () => {
    try {
      const saved = await AsyncStorage.getItem(ACCENT_STORAGE_KEY);
      const validValues: AccentName[] = [
        "blue",
        "amber",
        "emerald",
        "purple",
        "rose",
      ];
      if (saved && (validValues as string[]).includes(saved)) {
        setAccentName(saved as AccentName);
      }
    } catch (err) {
      console.warn("Failed to load accent color:", err);
    }
  }, []);

  const loadDefaults = useCallback(async () => {
    try {
      const [[, hourly], [, clientName], [, notesTemplate]] =
        await AsyncStorage.multiGet([
          DEFAULTS_STORAGE_KEYS.HOURLY,
          DEFAULTS_STORAGE_KEYS.CLIENT_NAME,
          DEFAULTS_STORAGE_KEYS.NOTES_TEMPLATE,
        ]);

      setDefaultHourly(hourly ?? "");
      setDefaultClientName(clientName ?? "");
      setDefaultNotesTemplate(notesTemplate ?? "");
    } catch (err) {
      console.warn("Failed to load job defaults:", err);
    }
  }, []);

  const loadLastExport = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(LAST_EXPORT_KEY);
      if (stored) {
        setLastExportAt(stored);
      }
    } catch (err) {
      console.warn("Failed to load last export time:", err);
    }
  }, []);

  useEffect(() => {
    loadTheme();
    loadAccent();
    loadDefaults();
    loadLastExport();
  }, [loadTheme, loadAccent, loadDefaults, loadLastExport]);

  const handleSelectTheme = async (value: ThemeName) => {
    try {
      setThemeName(value);
      await AsyncStorage.setItem(THEME_STORAGE_KEY, value);
    } catch (err) {
      console.warn("Failed to save theme:", err);
    } finally {
      setIsThemeExpanded(false);
    }
  };

  const handleSelectAccent = async (value: AccentName) => {
    try {
      setAccentName(value);
      await AsyncStorage.setItem(ACCENT_STORAGE_KEY, value);
    } catch (err) {
      console.warn("Failed to save accent color:", err);
    } finally {
      setIsAccentExpanded(false);
    }
  };

  // ---------- Helper: format "Last export" label ----------
  const formatLastExportLabel = (iso: string | null): string => {
    if (!iso) return "Last export: none yet";

    const exportedAt = new Date(iso);
    if (Number.isNaN(exportedAt.getTime())) {
      return "Last export: unknown";
    }

    const now = new Date();
    const diffMs = now.getTime() - exportedAt.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      return "Last export: Today";
    }
    if (diffDays === 1) {
      return "Last export: Yesterday";
    }
    return `Last export: ${diffDays} days ago`;
  };

  // ---------- Job Defaults save handlers (called when editing ends) ----------
  const saveDefaultHourly = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      setDefaultHourly("");
      try {
        await AsyncStorage.removeItem(DEFAULTS_STORAGE_KEYS.HOURLY);
      } catch (err) {
        console.warn("Failed to clear default hourly:", err);
      }
      return;
    }

    const cleaned = trimmed.replace(/[^0-9.]/g, "");
    if (!cleaned) {
      Alert.alert("Invalid rate", "Enter a valid number for hourly rate.");
      return;
    }

    setDefaultHourly(cleaned);
    try {
      await AsyncStorage.setItem(DEFAULTS_STORAGE_KEYS.HOURLY, cleaned);
    } catch (err) {
      console.warn("Failed to save default hourly:", err);
    }
  };

  const saveDefaultClientName = async (value: string) => {
    const trimmed = value.trim();
    setDefaultClientName(value);
    if (!trimmed) {
      try {
        await AsyncStorage.removeItem(DEFAULTS_STORAGE_KEYS.CLIENT_NAME);
      } catch (err) {
        console.warn("Failed to clear default client name:", err);
      }
      return;
    }

    try {
      await AsyncStorage.setItem(
        DEFAULTS_STORAGE_KEYS.CLIENT_NAME,
        trimmed
      );
    } catch (err) {
      console.warn("Failed to save default client name:", err);
    }
  };

  const saveDefaultNotesTemplate = async (value: string) => {
    const trimmed = value.trim();
    setDefaultNotesTemplate(value);
    if (!trimmed) {
      try {
        await AsyncStorage.removeItem(
          DEFAULTS_STORAGE_KEYS.NOTES_TEMPLATE
        );
      } catch (err) {
        console.warn("Failed to clear notes template:", err);
      }
      return;
    }

    try {
      await AsyncStorage.setItem(
        DEFAULTS_STORAGE_KEYS.NOTES_TEMPLATE,
        trimmed
      );
    } catch (err) {
      console.warn("Failed to save notes template:", err);
    }
  };

  // ---------- EXPORT (BACKUP) ----------
  const handleExportJobs = async () => {
    Keyboard.dismiss();
    try {
      const raw = await AsyncStorage.getItem(JOBS_STORAGE_KEY);

      if (!raw || raw === "[]" || raw.trim() === "") {
        Alert.alert(
          "No jobs to export",
          "You don't have any jobs saved yet on this device."
        );
        return;
      }

      let pretty = raw;
      try {
        const parsed = JSON.parse(raw);
        pretty = JSON.stringify(parsed, null, 2);
      } catch {
        // if parse fails, use raw
      }

      setExportJson(pretty);
      setIsExportModalVisible(true);
    } catch (err) {
      console.warn("Failed to export jobs:", err);
      Alert.alert(
        "Export failed",
        "Something went wrong while reading your jobs from storage."
      );
    }
  };

  const handleCopyExport = async () => {
    if (!exportJson.trim()) {
      Alert.alert("Nothing to copy", "There is no backup text to copy.");
      return;
    }

    try {
      await Clipboard.setStringAsync(exportJson);

      // Save "last export" time when user actually copies the backup
      const iso = new Date().toISOString();
      setLastExportAt(iso);
      try {
        await AsyncStorage.setItem(LAST_EXPORT_KEY, iso);
      } catch (err) {
        console.warn("Failed to persist last export time:", err);
      }

      Alert.alert(
        "Backup copied",
        "Your backup JSON has been copied to the clipboard.\n\nTip: Paste it into Notes or email it to yourself so you can test it later and keep a second copy."
      );
    } catch (err) {
      console.warn("Failed to copy backup JSON:", err);
      Alert.alert(
        "Copy failed",
        "We couldn't copy the backup text to your clipboard."
      );
    }
  };

  // ---------- IMPORT (RESTORE) ----------
  const openImportModal = () => {
    Keyboard.dismiss();
    setImportJson("");
    setIsImportModalVisible(true);
  };

  const handleImportJobs = () => {
    blurImportInput();
    const trimmed = importJson.trim();
    if (!trimmed) {
      Alert.alert("Nothing to import", "Paste your JSON backup first.");
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      Alert.alert(
        "Invalid JSON",
        "That doesn't look like valid JSON. Make sure you pasted the full backup."
      );
      return;
    }

    if (!Array.isArray(parsed)) {
      Alert.alert(
        "Wrong format",
        "This backup doesn't look like a list of jobs (expected an array)."
      );
      return;
    }

    Alert.alert(
      "Replace existing jobs?",
      "Importing this backup will overwrite all jobs currently stored on this device.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Import",
          style: "destructive",
          onPress: async () => {
            blurImportInput();
            try {
              await AsyncStorage.setItem(
                JOBS_STORAGE_KEY,
                JSON.stringify(parsed)
              );
              setIsImportModalVisible(false);
              Alert.alert(
                "Import complete",
                "Your jobs backup has been restored on this device."
              );
            } catch (err) {
              console.warn("Failed to import jobs:", err);
              Alert.alert(
                "Import failed",
                "Something went wrong while saving the imported jobs."
              );
            }
          },
        },
      ]
    );
  };

  // ---------- Feedback (mailto) ----------
  const handleFeedbackPress = async () => {
    Keyboard.dismiss();

    // Change this later to your real feedback email
    const email = "traktr.feedback@example.com";
    const subject = encodeURIComponent("Feedback about Traktr");
    const body = encodeURIComponent(
      "Tell us what you like, what is confusing, or what is missing.\n\n"
    );

    const url = `mailto:${email}?subject=${subject}&body=${body}`;

    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert(
          "No mail app found",
          "We couldn’t open your email app on this device."
        );
      }
    } catch (err) {
      console.warn("Failed to open mail app:", err);
      Alert.alert(
        "Something went wrong",
        "We couldn't open your email app. You can send feedback to:\n" +
          email
      );
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.screenBackground }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View
          style={[
            styles.screen,
            { backgroundColor: theme.screenBackground },
          ]}
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={() => {
                Keyboard.dismiss();
                router.back();
              }}
              style={styles.backButton}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.backText,
                  { color: theme.textSecondary },
                ]}
              >
                ← Back
              </Text>
            </TouchableOpacity>

            <Text
              style={[
                styles.headerTitle,
                { color: theme.headerText },
              ]}
            >
              Settings
            </Text>

            <View style={{ width: 60 }} />
          </View>

          {/* Content as ScrollView so fields move above keyboard */}
          <ScrollView
            ref={scrollViewRef}
            style={styles.content}
            contentContainerStyle={{ paddingBottom: 32 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Appearance */}
            <Text
              style={[
                styles.sectionLabel,
                { color: theme.textSecondary },
              ]}
            >
              Appearance
            </Text>

            <View
              style={[
                styles.sectionCard,
                {
                  backgroundColor: theme.cardBackground,
                  borderColor: theme.cardBorder,
                },
              ]}
            >
              {/* Theme row */}
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => {
                  Keyboard.dismiss();
                  setIsThemeExpanded((prev) => !prev);
                }}
                style={styles.row}
              >
                <View style={styles.rowTextCol}>
                  <Text
                    style={[
                      styles.rowTitle,
                      { color: theme.textPrimary },
                    ]}
                  >
                    Theme
                  </Text>
                  <Text
                    style={[
                      styles.rowSubtitle,
                      { color: theme.textMuted },
                    ]}
                  >
                    Choose between Light, Dark, and Midnight Blue.
                  </Text>
                </View>

                <Text
                  style={[
                    styles.rowValue,
                    { color: accent.color },
                  ]}
                >
                  {themeLabels[themeName]}
                </Text>
              </TouchableOpacity>

              {isThemeExpanded && (
                <View style={styles.themeOptions}>
                  {(["light", "dark", "midnight"] as ThemeName[]).map(
                    (value) => (
                      <TouchableOpacity
                        key={value}
                        style={styles.themeOptionRow}
                        activeOpacity={0.9}
                        onPress={() => handleSelectTheme(value)}
                      >
                        <View style={styles.themeOptionDotWrap}>
                          <View
                            style={[
                              styles.themeOptionDot,
                              value === themeName &&
                                styles.themeOptionDotActive,
                            ]}
                          />
                        </View>
                        <Text
                          style={[
                            styles.themeOptionLabel,
                            {
                              color:
                                value === themeName
                                  ? theme.textPrimary
                                  : theme.textSecondary,
                            },
                          ]}
                        >
                          {themeLabels[value]}
                        </Text>
                      </TouchableOpacity>
                    )
                  )}
                </View>
              )}

              {/* Accent color row */}
              <View style={styles.rowDivider} />
              <TouchableOpacity
                style={styles.row}
                activeOpacity={0.9}
                onPress={() => {
                  Keyboard.dismiss();
                  setIsAccentExpanded((prev) => !prev);
                }}
              >
                <View style={styles.rowTextCol}>
                  <Text
                    style={[
                      styles.rowTitle,
                      { color: theme.textPrimary },
                    ]}
                  >
                    Accent color
                  </Text>
                  <Text
                    style={[
                      styles.rowSubtitle,
                      { color: theme.textMuted },
                    ]}
                  >
                    Highlight color for buttons and tags.
                  </Text>
                </View>
                <Text
                  style={[
                    styles.rowValue,
                    { color: accent.color },
                  ]}
                >
                  {accent.label}
                </Text>
              </TouchableOpacity>

              {isAccentExpanded && (
                <View style={styles.accentOptionsRow}>
                  {(
                    ["blue", "amber", "emerald", "purple", "rose"] as AccentName[]
                  ).map((value) => {
                    const option = accentPresets[value];
                    const isActive = value === accentName;
                    return (
                      <TouchableOpacity
                        key={value}
                        style={[
                          styles.accentChip,
                          {
                            backgroundColor: option.chipBg,
                            borderColor: isActive
                              ? option.color
                              : "transparent",
                          },
                        ]}
                        activeOpacity={0.9}
                        onPress={() => handleSelectAccent(value)}
                      >
                        <View
                          style={[
                            styles.accentDot,
                            { backgroundColor: option.color },
                          ]}
                        />
                        <Text
                          style={[
                            styles.accentLabel,
                            {
                              color: isActive
                                ? option.color
                                : theme.textSecondary,
                            },
                          ]}
                        >
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            {/* Job Defaults */}
            <Text
              style={[
                styles.sectionLabel,
                { color: theme.textSecondary },
              ]}
            >
              Job Defaults
            </Text>

            <View
              style={[
                styles.sectionCard,
                {
                  backgroundColor: theme.cardBackground,
                  borderColor: theme.cardBorder,
                },
              ]}
              onLayout={(e) =>
                handleSectionLayout("jobDefaults", e.nativeEvent.layout.y)
              }
            >
              {/* Default hourly rate */}
              <TouchableOpacity
                style={styles.row}
                activeOpacity={1}
                onPress={() => {
                  scrollToSection("jobDefaults");
                  hourlyRef.current?.focus();
                }}
              >
                <View style={styles.rowTextCol}>
                  <Text
                    style={[
                      styles.rowTitle,
                      { color: theme.textPrimary },
                    ]}
                  >
                    Default hourly rate
                  </Text>
                  <Text
                    style={[
                      styles.rowSubtitle,
                      { color: theme.textMuted },
                    ]}
                  >
                    Used as the starting hourly rate for new jobs.
                  </Text>
                </View>
                <TextInput
                  ref={hourlyRef}
                  style={[
                    styles.defaultInput,
                    {
                      backgroundColor: theme.inputBackground,
                      color: theme.inputText,
                      borderColor: theme.inputBorder,
                    },
                  ]}
                  value={defaultHourly}
                  onChangeText={setDefaultHourly}
                  onEndEditing={(e) => saveDefaultHourly(e.nativeEvent.text)}
                  placeholder="Not set"
                  placeholderTextColor={theme.textMuted}
                  keyboardType="numeric"
                  returnKeyType="next"
                  onFocus={() => scrollToSection("jobDefaults")}
                  onSubmitEditing={() => {
                    scrollToSection("jobDefaults");
                    clientRef.current?.focus();
                  }}
                />
              </TouchableOpacity>

              <View style={styles.rowDivider} />

              {/* Default client name */}
              <TouchableOpacity
                style={styles.row}
                activeOpacity={1}
                onPress={() => {
                  scrollToSection("jobDefaults");
                  clientRef.current?.focus();
                }}
              >
                <View style={styles.rowTextCol}>
                  <Text
                    style={[
                      styles.rowTitle,
                      { color: theme.textPrimary },
                    ]}
                  >
                    Default client name
                  </Text>
                  <Text
                    style={[
                      styles.rowSubtitle,
                      { color: theme.textMuted },
                    ]}
                  >
                    Helpful for repeat clients or your company name.
                  </Text>
                </View>
                <TextInput
                  ref={clientRef}
                  style={[
                    styles.defaultInput,
                    {
                      backgroundColor: theme.inputBackground,
                      color: theme.inputText,
                      borderColor: theme.inputBorder,
                    },
                  ]}
                  value={defaultClientName}
                  onChangeText={setDefaultClientName}
                  onEndEditing={(e) =>
                    saveDefaultClientName(e.nativeEvent.text)
                  }
                  placeholder="None"
                  placeholderTextColor={theme.textMuted}
                  returnKeyType="next"
                  onFocus={() => scrollToSection("jobDefaults")}
                  onSubmitEditing={() => {
                    scrollToSection("jobDefaults");
                    notesRef.current?.focus();
                  }}
                />
              </TouchableOpacity>

              <View style={styles.rowDivider} />

              {/* Default notes template */}
              <TouchableOpacity
                activeOpacity={1}
                onPress={() => {
                  scrollToSection("jobDefaults");
                  notesRef.current?.focus();
                }}
                style={{ paddingVertical: 10 }}
              >
                <Text
                  style={[
                    styles.rowTitle,
                    { color: theme.textPrimary, marginBottom: 4 },
                  ]}
                >
                  Default notes template
                </Text>
                <Text
                  style={[
                    styles.rowSubtitle,
                    { color: theme.textMuted, marginBottom: 6 },
                  ]}
                >
                  Pre-fills the Description / Scope on new jobs.
                </Text>
                <TextInput
                  ref={notesRef}
                  style={[
                    styles.defaultNotesInput,
                    {
                      backgroundColor: theme.inputBackground,
                      color: theme.inputText,
                      borderColor: theme.inputBorder,
                    },
                  ]}
                  value={defaultNotesTemplate}
                  onChangeText={setDefaultNotesTemplate}
                  onEndEditing={(e) =>
                    saveDefaultNotesTemplate(e.nativeEvent.text)
                  }
                  placeholder="Standard (empty)"
                  placeholderTextColor={theme.textMuted}
                  multiline
                  returnKeyType="done"
                  onFocus={() => scrollToSection("jobDefaults")}
                />
              </TouchableOpacity>
            </View>

            {/* Data & Backup */}
            <Text
              style={[
                styles.sectionLabel,
                { color: theme.textSecondary },
              ]}
            >
              Data & Backup
            </Text>

            <View
              style={[
                styles.sectionCard,
                {
                  backgroundColor: theme.cardBackground,
                  borderColor: theme.cardBorder,
                },
              ]}
            >
                {/* Pill + last export status */}
  <View style={styles.backupMetaRow}>
    <View
      style={[
        styles.backupTag,
        {
          backgroundColor: "rgba(148,163,184,0.12)",
          borderColor: "rgba(148,163,184,0.4)",
        },
      ]}
    >
      <Text
        style={[
          styles.backupTagText,
          { color: theme.textSecondary },
        ]}
      >
        Offline backup (no cloud)
      </Text>
    </View>

    <Text
      style={[
        styles.backupStatusText,
        { color: theme.textMuted },
      ]}
    >
      {formatLastExportLabel(lastExportAt)}
    </Text>
  </View>

  <View style={styles.rowDivider} />

              {/* Export */}
              <TouchableOpacity
                style={styles.row}
                activeOpacity={0.9}
                onPress={handleExportJobs}
              >
                <View style={styles.rowTextCol}>
                  <Text
                    style={[
                      styles.rowTitle,
                      { color: theme.textPrimary },
                    ]}
                  >
                    Export jobs (JSON)
                  </Text>
                  <Text
                    style={[
                      styles.rowSubtitle,
                      { color: theme.textMuted },
                    ]}
                  >
                    Open a backup screen and copy all jobs as JSON text. Copy
                    your jobs and paste them into Notes, email, or your laptop
                    for safekeeping.
                  </Text>
                </View>
                <Text
                  style={[
                    styles.rowValue,
                    { color: accent.color },
                  ]}
                >
                  Open
                </Text>
              </TouchableOpacity>

              <View style={styles.rowDivider} />

              {/* Import */}
              <TouchableOpacity
                style={styles.row}
                activeOpacity={0.9}
                onPress={openImportModal}
              >
                <View style={styles.rowTextCol}>
                  <Text
                    style={[
                      styles.rowTitle,
                      { color: theme.textPrimary },
                    ]}
                  >
                    Import from JSON
                  </Text>
                  <Text
                    style={[
                      styles.rowSubtitle,
                      { color: theme.textMuted },
                    ]}
                  >
                    Paste a JSON backup to restore jobs on this device.
                  </Text>
                </View>
                <Text
                  style={[
                    styles.rowValue,
                    { color: theme.textMuted },
                  ]}
                >
                  Paste
                </Text>
              </TouchableOpacity>
            </View>

            {/* About */}
            <Text
              style={[
                styles.sectionLabel,
                { color: theme.textSecondary },
              ]}
            >
              About Traktr
            </Text>

            <View
              style={[
                styles.sectionCard,
                {
                  backgroundColor: theme.cardBackground,
                  borderColor: theme.cardBorder,
                },
              ]}
            >
              {/* About this app row */}
              <TouchableOpacity
                style={styles.row}
                activeOpacity={0.9}
                onPress={() => {
                  Keyboard.dismiss();
                  setIsAboutModalVisible(true);
                }}
              >
                <View style={styles.rowTextCol}>
                  <Text
                    style={[
                      styles.rowTitle,
                      { color: theme.textPrimary },
                    ]}
                  >
                    About this app
                  </Text>
                  <Text
                    style={[
                      styles.rowSubtitle,
                      { color: theme.textMuted },
                    ]}
                  >
                    See version, purpose, and future plans.
                  </Text>
                </View>
                <Text
                  style={[
                    styles.rowValue,
                    { color: accent.color },
                  ]}
                >
                  Details
                </Text>
              </TouchableOpacity>

              <View style={styles.rowDivider} />

              {/* Feedback row */}
              <TouchableOpacity
                style={styles.row}
                activeOpacity={0.9}
                onPress={handleFeedbackPress}
              >
                <View style={styles.rowTextCol}>
                  <Text
                    style={[
                      styles.rowTitle,
                      { color: theme.textPrimary },
                    ]}
                  >
                    Feedback
                  </Text>
                  <Text
                    style={[
                      styles.rowSubtitle,
                      { color: theme.textMuted },
                    ]}
                  >
                    Share ideas or report issues.
                  </Text>
                </View>
                <Text
                  style={[
                    styles.rowValue,
                    { color: accent.color },
                  ]}
                >
                  Email
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* ABOUT MODAL */}
          <Modal
            visible={isAboutModalVisible}
            animationType="fade"
            transparent
            onRequestClose={() => setIsAboutModalVisible(false)}
          >
            <View style={styles.modalBackdrop}>
              <View
                style={[
                  styles.modalCard,
                  { backgroundColor: theme.cardBackground },
                ]}
              >
                <Text
                  style={[
                    styles.modalTitle,
                    { color: theme.textPrimary },
                  ]}
                >
                  About Traktr
                </Text>

                <Text
                  style={[
                    styles.modalBodyText,
                    { color: theme.textMuted },
                  ]}
                >
                  Traktr is your electrician job tracker. Keep jobs, photos,
                  pricing, and notes in one place — even when you're offline.
                </Text>

                <View style={{ marginTop: 8, marginBottom: 12 }}>
                  <Text
                    style={[
                      styles.modalBodyText,
                      { color: theme.textMuted },
                    ]}
                  >
                    Version: 0.1 (dev build)
                  </Text>
                  <Text
                    style={[
                      styles.modalBodyText,
                      { color: theme.textMuted },
                    ]}
                  >
                    Built for solo electricians, small teams, and bigger
                    companies — all in the same app.
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() => setIsAboutModalVisible(false)}
                  style={[
                    styles.modalButton,
                    {
                      alignSelf: "flex-end",
                      borderRadius: 999,
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      backgroundColor: accent.color,
                    },
                  ]}
                  activeOpacity={0.9}
                >
                  <Text
                    style={[
                      styles.modalButtonText,
                      { color: "#FFFFFF" },
                    ]}
                  >
                    Close
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* EXPORT MODAL */}
          <Modal
            visible={isExportModalVisible}
            animationType="slide"
            transparent
            onRequestClose={() => {
              Keyboard.dismiss();
              setIsExportModalVisible(false);
            }}
          >
            <View style={styles.modalBackdrop}>
              <View
                style={[
                  styles.modalCard,
                  { backgroundColor: theme.cardBackground },
                ]}
              >
                <Text
                  style={[
                    styles.modalTitle,
                    { color: theme.textPrimary },
                  ]}
                >
                  Backup JSON
                </Text>
                <Text
                  style={[
                    styles.modalBodyText,
                    { color: theme.textMuted },
                  ]}
                >
                  This is your Traktr data as JSON.{"\n"}
                  Copy it and save it in Notes, email, or cloud storage.
                </Text>

                <ScrollView
                  style={styles.modalTextAreaWrapper}
                  contentContainerStyle={{ paddingBottom: 16 }}
                >
                  <TextInput
                    multiline
                    editable={false}
                    value={exportJson}
                    style={[
                      styles.modalTextArea,
                      {
                        color: theme.textPrimary,
                        borderColor: theme.cardBorder,
                        backgroundColor: theme.screenBackground,
                      },
                    ]}
                  />
                </ScrollView>

                <View style={styles.modalButtonsRow}>
                  <TouchableOpacity
                    onPress={() => {
                      Keyboard.dismiss();
                      setIsExportModalVisible(false);
                    }}
                    style={[
                      styles.modalButton,
                      {
                        backgroundColor: "transparent",
                        borderColor: theme.cardBorder,
                        borderWidth: 1,
                      },
                    ]}
                    activeOpacity={0.85}
                  >
                    <Text
                      style={[
                        styles.modalButtonText,
                        { color: theme.textPrimary },
                      ]}
                    >
                      Close
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleCopyExport}
                    style={[
                      styles.modalButton,
                      { backgroundColor: accent.color },
                    ]}
                    activeOpacity={0.9}
                  >
                    <Text
                      style={[
                        styles.modalButtonText,
                        { color: "#FFFFFF" },
                      ]}
                    >
                      Copy JSON
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          {/* IMPORT MODAL */}
          <Modal
            visible={isImportModalVisible}
            animationType="slide"
            transparent
            onRequestClose={() => {
              blurImportInput();
              setIsImportModalVisible(false);
            }}
          >
            <KeyboardAvoidingView
              style={styles.modalBackdrop}
              behavior={Platform.OS === "ios" ? "padding" : undefined}
              keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
            >
              <View
                style={[
                  styles.modalCard,
                  { backgroundColor: theme.cardBackground },
                ]}
              >
                <Text
                  style={[
                    styles.modalTitle,
                    { color: theme.textPrimary },
                  ]}
                >
                  Restore from JSON
                </Text>
                <Text
                  style={[
                    styles.modalBodyText,
                    { color: theme.textMuted },
                  ]}
                >
                  Paste a backup exported from Traktr.{"\n"}
                  Existing jobs on this device will be replaced.
                </Text>
                <Text
                  style={[
                    styles.modalWarningText,
                    { color: "#F97373" },
                  ]}
                >
                  This will overwrite all existing jobs on this device.
                </Text>

                <ScrollView
                  style={styles.modalTextAreaWrapper}
                  contentContainerStyle={{ paddingBottom: 16 }}
                  keyboardShouldPersistTaps="handled"
                >
                  <TextInput
                    ref={importInputRef}
                    multiline
                    value={importJson}
                    onChangeText={setImportJson}
                    placeholder="Paste your JSON backup here"
                    placeholderTextColor={theme.textMuted}
                    style={[
                      styles.modalTextArea,
                      {
                        color: theme.textPrimary,
                        borderColor: theme.cardBorder,
                        backgroundColor: theme.screenBackground,
                      },
                    ]}
                    autoCapitalize="none"
                    autoCorrect={false}
                    blurOnSubmit
                  />
                </ScrollView>

                <View style={styles.modalButtonsRow}>
                  <TouchableOpacity
                    onPress={() => {
                      blurImportInput();
                      setIsImportModalVisible(false);
                    }}
                    style={[
                      styles.modalButton,
                      {
                        backgroundColor: "transparent",
                        borderColor: theme.cardBorder,
                        borderWidth: 1,
                      },
                    ]}
                    activeOpacity={0.85}
                  >
                    <Text
                      style={[
                        styles.modalButtonText,
                        { color: theme.textPrimary },
                      ]}
                    >
                      Cancel
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleImportJobs}
                    style={[
                      styles.modalButton,
                      { backgroundColor: "#EF4444" },
                    ]}
                    activeOpacity={0.9}
                  >
                    <Text
                      style={[
                        styles.modalButtonText,
                        { color: "#FFFFFF" },
                      ]}
                    >
                      Import
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </KeyboardAvoidingView>
          </Modal>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 12,
  },
  backButton: {
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  backText: {
    fontSize: 14,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "700",
    marginTop: 8,
    marginBottom: 8,
  },
  sectionCard: {
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    marginBottom: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(148,163,184,0.25)",
  },
  rowTextCol: {
    flex: 1,
    paddingRight: 12,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 2,
  },
  rowSubtitle: {
    fontSize: 13,
  },
  rowValue: {
    fontSize: 14,
    fontWeight: "600",
  },

  // Theme options dropdown
  themeOptions: {
    paddingBottom: 8,
  },
  themeOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
  },
  themeOptionDotWrap: {
    width: 28,
    alignItems: "center",
  },
  themeOptionDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#6B7280",
    backgroundColor: "transparent",
  },
  themeOptionDotActive: {
    borderColor: "#3B82F6",
    backgroundColor: "#3B82F6",
  },
  themeOptionLabel: {
    fontSize: 14,
  },

  // Accent chips
  accentOptionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingBottom: 8,
    paddingTop: 2,
  },
  accentChip: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
  },
  accentDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    marginRight: 6,
  },
  accentLabel: {
    fontSize: 12,
    fontWeight: "600",
  },

  // Job defaults inputs
  defaultInput: {
    width: 110,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 13,
    borderWidth: 1,
  },
  defaultNotesInput: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    borderWidth: 1,
    minHeight: 70,
    textAlignVertical: "top",
  },

  // Backup meta
  backupMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
    marginTop: 6,
  },
  backupTag: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
  },
  backupTagText: {
    fontSize: 11,
    fontWeight: "600",
  },
  backupStatusText: {
    fontSize: 12,
  },

  // Modals
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.55)",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  modalCard: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    maxHeight: "80%",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 6,
  },
  modalBodyText: {
    fontSize: 13,
    marginBottom: 8,
  },
  modalWarningText: {
    fontSize: 12,
    marginBottom: 8,
    fontWeight: "600",
  },
  modalTextAreaWrapper: {
    borderRadius: 12,
    marginTop: 4,
    marginBottom: 10,
  },
  modalTextArea: {
    minHeight: 160,
    maxHeight: 260,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    fontFamily: Platform.select({
      ios: "Menlo",
      android: "monospace",
      default: "monospace",
    }),
  },
  modalButtonsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  modalButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
