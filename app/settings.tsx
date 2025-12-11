// app/settings.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
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
import BottomNavBar from "../components/BottomNavBar";
import {
  ACCENT_STORAGE_KEY,
  AccentName,
  THEME_STORAGE_KEY,
  ThemeName,
  accentLabels,
  accentSwatchColors,
  themes,
} from "../constants/appTheme";

const USER_STORAGE_KEY = "EJT_USER_SESSION";

const STORAGE_KEYS = {
  DEFAULT_HOURLY_RATE: "EJT_DEFAULT_HOURLY_RATE",
  DEFAULT_CLIENT_NAME: "EJT_DEFAULT_CLIENT_NAME",
  DEFAULT_NOTES_TEMPLATE: "EJT_DEFAULT_NOTES_TEMPLATE",
  BACKUP_LAST_EXPORT: "EJT_BACKUP_LAST_EXPORT",

  // Company branding fields (used by PDFs)
  COMPANY_NAME: "EJT_COMPANY_NAME",
  COMPANY_PHONE: "EJT_COMPANY_PHONE",
  COMPANY_EMAIL: "EJT_COMPANY_EMAIL",
  COMPANY_LICENSE: "EJT_COMPANY_LICENSE",
};

const themeLabels: Record<ThemeName, string> = {
  light: "Light",
  dark: "Dark",
  midnight: "Midnight Blue",
};

// Keep this in sync with BottomNavBar height
const NAV_HEIGHT = 72;

export default function SettingsScreen() {
  const router = useRouter();

  // THEME
  const [themeName, setThemeName] = useState<ThemeName>("dark");
  const [isThemeExpanded, setIsThemeExpanded] = useState(false);
  const theme = themes[themeName];

  // ACCENT
  const [accentName, setAccentName] = useState<AccentName>("jobsiteAmber");
  const [isAccentExpanded, setIsAccentExpanded] = useState(false);
  const accentColor =
    accentSwatchColors[accentName] || theme.primaryButtonBackground;

  // JOB DEFAULTS
  const [defaultHourlyRate, setDefaultHourlyRate] = useState("");
  const [defaultClientName, setDefaultClientName] = useState("");
  const [defaultNotesTemplate, setDefaultNotesTemplate] = useState("");

  // COMPANY BRANDING
  const [companyName, setCompanyName] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [companyLicense, setCompanyLicense] = useState("");

  // BACKUP
  const [lastExport, setLastExport] = useState<string | null>(null);

  // Are we typing in any TextInput?
  const [isEditing, setIsEditing] = useState(false);

  // Screen zoom animation (match other screens)
  const screenScale = useRef(new Animated.Value(1.04)).current;
  useEffect(() => {
    Animated.timing(screenScale, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [screenScale]);

  // 🔹 Scroll handling (same pattern as job-detail)
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

  // Load everything on mount
  const loadSettings = useCallback(async () => {
    try {
      const [
        themeSaved,
        accentSaved,
        hourlySaved,
        clientSaved,
        notesSaved,
        lastExportSaved,
        companyNameSaved,
        companyPhoneSaved,
        companyEmailSaved,
        companyLicenseSaved,
      ] = await Promise.all([
        AsyncStorage.getItem(THEME_STORAGE_KEY),
        AsyncStorage.getItem(ACCENT_STORAGE_KEY),
        AsyncStorage.getItem(STORAGE_KEYS.DEFAULT_HOURLY_RATE),
        AsyncStorage.getItem(STORAGE_KEYS.DEFAULT_CLIENT_NAME),
        AsyncStorage.getItem(STORAGE_KEYS.DEFAULT_NOTES_TEMPLATE),
        AsyncStorage.getItem(STORAGE_KEYS.BACKUP_LAST_EXPORT),
        AsyncStorage.getItem(STORAGE_KEYS.COMPANY_NAME),
        AsyncStorage.getItem(STORAGE_KEYS.COMPANY_PHONE),
        AsyncStorage.getItem(STORAGE_KEYS.COMPANY_EMAIL),
        AsyncStorage.getItem(STORAGE_KEYS.COMPANY_LICENSE),
      ]);

      if (
        themeSaved === "light" ||
        themeSaved === "dark" ||
        themeSaved === "midnight"
      ) {
        setThemeName(themeSaved as ThemeName);
      }

      // 🔧 FIX: accept any valid AccentName (including "safetyGreen")
      if (accentSaved && accentLabels[accentSaved as AccentName]) {
        setAccentName(accentSaved as AccentName);
      }

      if (hourlySaved) setDefaultHourlyRate(hourlySaved);
      if (clientSaved) setDefaultClientName(clientSaved);
      if (notesSaved) setDefaultNotesTemplate(notesSaved);
      if (lastExportSaved) setLastExport(lastExportSaved);

      if (companyNameSaved) setCompanyName(companyNameSaved);
      if (companyPhoneSaved) setCompanyPhone(companyPhoneSaved);
      if (companyEmailSaved) setCompanyEmail(companyEmailSaved);
      if (companyLicenseSaved) setCompanyLicense(companyLicenseSaved);
    } catch (err) {
      console.warn("Failed to load settings:", err);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Save helpers
  const saveTheme = async (name: ThemeName) => {
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, name);
      setThemeName(name);
    } catch (err) {
      console.warn("Failed to save theme:", err);
    }
  };

  const saveAccent = async (name: AccentName) => {
    try {
      await AsyncStorage.setItem(ACCENT_STORAGE_KEY, name);
      setAccentName(name);
    } catch (err) {
      console.warn("Failed to save accent:", err);
    }
  };

  const saveJobDefaults = async (
    hourly: string,
    client: string,
    notes: string
  ) => {
    try {
      await AsyncStorage.multiSet([
        [STORAGE_KEYS.DEFAULT_HOURLY_RATE, hourly],
        [STORAGE_KEYS.DEFAULT_CLIENT_NAME, client],
        [STORAGE_KEYS.DEFAULT_NOTES_TEMPLATE, notes],
      ]);
    } catch (err) {
      console.warn("Failed to save job defaults:", err);
    }
  };

  const saveBranding = async (
    name: string,
    phone: string,
    email: string,
    license: string
  ) => {
    try {
      await AsyncStorage.multiSet([
        [STORAGE_KEYS.COMPANY_NAME, name],
        [STORAGE_KEYS.COMPANY_PHONE, phone],
        [STORAGE_KEYS.COMPANY_EMAIL, email],
        [STORAGE_KEYS.COMPANY_LICENSE, license],
      ]);
    } catch (err) {
      console.warn("Failed to save branding:", err);
    }
  };

  // Backup handlers (JSON) – with clearer UX
  const handleExportJobs = async () => {
    try {
      const jobsJson = await AsyncStorage.getItem("EJT_JOBS");
      const exportText = jobsJson || "[]";

      await Clipboard.setStringAsync(exportText);

      const timestamp = new Date().toISOString();
      setLastExport(timestamp);
      await AsyncStorage.setItem(STORAGE_KEYS.BACKUP_LAST_EXPORT, timestamp);

      Alert.alert(
        "Backup copied ✅",
        "Your jobs are now saved to the clipboard.\n\n" +
          "Next:\n" +
          "1) Open Notes, email, or Files\n" +
          "2) Long-press and tap Paste\n" +
          "3) Save that note/file somewhere safe\n\n" +
          "To restore later: open that backup, copy ALL the text, then come back here and tap “Use copied backup”."
      );
    } catch (err) {
      console.warn("Failed to export jobs:", err);
      Alert.alert("Error", "Could not create backup. Try again.");
    }
  };

  const handleImportJobs = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (!text.trim()) {
        Alert.alert(
          "No backup found 📋",
          "Clipboard is empty.\n\n" +
            "Do this:\n" +
            "1) Open your backup in Notes or email\n" +
            "2) Select ALL the backup text and tap Copy\n" +
            "3) Return to Traktr and tap “Use copied backup” again."
        );
        return;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        Alert.alert(
          "Backup not recognized ❌",
          "The copied text doesn’t look like a Traktr backup.\n\n" +
            "Make sure you copied the full backup exactly (from the first [ to the last ]) and try again."
        );
        return;
      }

      if (!Array.isArray(parsed)) {
        Alert.alert(
          "Invalid backup format ❌",
          "The copied data is not a valid Traktr job backup.\n\n" +
            "Copy the entire backup text again and try once more."
        );
        return;
      }

      const jobCount = parsed.length ?? 0;

      Alert.alert(
        "Confirm restore",
        `This will replace ALL jobs currently in Traktr with the backup (${jobCount} job${
          jobCount === 1 ? "" : "s"
        }).\n\n` +
          "This cannot be undone.\n\n" +
          "Do you want to continue?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Replace jobs",
            style: "destructive",
            onPress: async () => {
              try {
                await AsyncStorage.setItem("EJT_JOBS", JSON.stringify(parsed));
                Alert.alert(
                  "Restored ✅",
                  "Your jobs were restored successfully from backup."
                );
              } catch (err) {
                console.warn("Failed to import jobs:", err);
                Alert.alert("Error", "Restore failed. Try again.");
              }
            },
          },
        ]
      );
    } catch (err) {
      console.warn("Failed to prepare import:", err);
      Alert.alert(
        "Error",
        "Could not read backup from clipboard. Try again."
      );
    }
  };

  const formatLastExport = () => {
    if (!lastExport) return "Never";
    try {
      const d = new Date(lastExport);
      return d.toLocaleString();
    } catch {
      return lastExport;
    }
  };

  // Persist defaults + branding when inputs change
  useEffect(() => {
    saveJobDefaults(defaultHourlyRate, defaultClientName, defaultNotesTemplate);
  }, [defaultHourlyRate, defaultClientName, defaultNotesTemplate]);

  useEffect(() => {
    saveBranding(
      companyName.trim(),
      companyPhone.trim(),
      companyEmail.trim(),
      companyLicense.trim()
    );
  }, [companyName, companyPhone, companyEmail, companyLicense]);

  const handleSendFeedback = () => {
    const email = "support@example.com"; // set your real email here
    const subject = encodeURIComponent("Traktr feedback");
    const body = encodeURIComponent("");
    Linking.openURL(`mailto:${email}?subject=${subject}&body=${body}`).catch(
      () => {
        Alert.alert("Error", "Could not open email app.");
      }
    );
  };

  // LOGOUT HANDLER (new)
  const handleLogout = () => {
    Alert.alert(
      "Log out",
      "This will sign you out of Traktr on this device.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log out",
          style: "destructive",
          onPress: async () => {
            try {
              await AsyncStorage.removeItem(USER_STORAGE_KEY);
              router.replace("/login");
            } catch (err) {
              console.warn("Failed to log out:", err);
              Alert.alert("Error", "Could not log out. Try again.");
            }
          },
        },
      ]
    );
  };

  // Small helper so we don't repeat onFocus logic everywhere
  const handleFocus = (sectionKey: string) => {
    setIsEditing(true);
    scrollToSection(sectionKey);
  };

  const handleBlur = () => {
    setIsEditing(false);
  };

  const dismissKeyboardAndEditing = () => {
    Keyboard.dismiss();
    setIsEditing(false);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.screenBackground }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <Animated.View
        style={[
          styles.screen,
          {
            backgroundColor: theme.screenBackground + "F2",
            transform: [{ scale: screenScale }],
          },
        ]}
      >
        <View style={styles.headerShell}>
          <View
            style={[
              styles.headerRow,
              {
                backgroundColor: theme.cardBackground + "E6",
                borderColor: theme.cardBorder + "55",
              },
            ]}
          >
            <View style={styles.headerLeft}>
              <View
                style={[
                  styles.headerIconBadge,
                  {
                    borderColor: accentColor + "80",
                    backgroundColor: accentColor + "1A",
                  },
                ]}
              >
                <Ionicons
                  name="settings-outline"
                  size={18}
                  color={accentColor}
                />
              </View>
              <Text
                style={[
                  styles.headerTitle,
                  { color: theme.headerText },
                ]}
              >
                Settings
              </Text>
            </View>
            <View style={{ width: 24 }} />
          </View>
        </View>

        <View style={{ flex: 1 }}>
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={[
              styles.scrollContent,
              {
                paddingBottom: isEditing ? 8 : NAV_HEIGHT + 24,
              },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="always"
            onScrollBeginDrag={dismissKeyboardAndEditing}
          >
            {/* Whole screen tappable background */}
            <TouchableWithoutFeedback
              onPress={dismissKeyboardAndEditing}
              accessible={false}
            >
              <View>
                {/* APPEARANCE */}
                <View
                  style={[
                    styles.sectionCard,
                    {
                      backgroundColor: theme.cardBackground + "F2",
                      borderColor: theme.cardBorder + "55",
                      borderTopColor: accentColor + "AA",
                      borderTopWidth: 2,
                    },
                  ]}
                  onLayout={(e) =>
                    registerSection("appearance", e.nativeEvent.layout.y)
                  }
                >
                  <View style={styles.sectionHeaderRow}>
                    <View
                      style={[
                        styles.sectionIconBadge,
                        {
                          borderColor: accentColor + "80",
                          backgroundColor: accentColor + "1A",
                        },
                      ]}
                    >
                      <Ionicons
                        name="color-palette-outline"
                        size={16}
                        color={accentColor}
                      />
                    </View>
                    <Text
                      style={[
                        styles.sectionTitle,
                        { color: accentColor },
                      ]}
                    >
                      Appearance
                    </Text>
                  </View>

                  {/* Theme row */}
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => setIsThemeExpanded((prev) => !prev)}
                    style={styles.row}
                  >
                    <View style={{ flex: 1 }}>
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
                        { color: accentColor },
                      ]}
                    >
                      {themeLabels[themeName]}
                    </Text>
                  </TouchableOpacity>

                  {isThemeExpanded && (
                    <View style={styles.optionList}>
                      {(Object.keys(themeLabels) as ThemeName[]).map(
                        (name) => {
                          const isActive = name === themeName;
                          return (
                            <TouchableOpacity
                              key={name}
                              style={[
                                styles.optionButton,
                                {
                                  borderColor: isActive
                                    ? accentColor
                                    : theme.cardBorder,
                                  backgroundColor: isActive
                                    ? accentColor + "22"
                                    : "transparent",
                                },
                              ]}
                              onPress={() => saveTheme(name)}
                              activeOpacity={0.9}
                            >
                              <Text
                                style={{
                                  color: isActive
                                    ? accentColor
                                    : theme.textPrimary,
                                  fontSize: 13,
                                  fontWeight: isActive ? "700" : "500",
                                }}
                              >
                                {themeLabels[name]}
                              </Text>
                            </TouchableOpacity>
                          );
                        }
                      )}
                    </View>
                  )}

                  {/* Accent row */}
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => setIsAccentExpanded((prev) => !prev)}
                    style={[styles.row, { marginTop: 10 }]}
                  >
                    <View style={{ flex: 1 }}>
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

                    {/* Accent pill preview */}
                    <View
                      style={[
                        styles.accentValuePill,
                        {
                          borderColor: accentColor,
                          backgroundColor: accentColor + "1A",
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.accentDotSmall,
                          { backgroundColor: accentColor },
                        ]}
                      />
                      <Text
                        style={[
                          styles.accentValueText,
                          { color: accentColor },
                        ]}
                      >
                        {accentLabels[accentName]}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {isAccentExpanded && (
                    <View style={styles.optionList}>
                      {(Object.keys(accentLabels) as AccentName[]).map(
                        (name) => {
                          const isActive = name === accentName;
                          const color = accentSwatchColors[name];
                          return (
                            <TouchableOpacity
                              key={name}
                              style={[
                                styles.accentOptionButton,
                                {
                                  borderColor: isActive
                                    ? color
                                    : theme.cardBorder,
                                  backgroundColor: isActive
                                    ? `${color}22`
                                    : "transparent",
                                },
                              ]}
                              onPress={() => saveAccent(name)}
                              activeOpacity={0.9}
                            >
                              <View style={styles.accentOptionContent}>
                                <View
                                  style={[
                                    styles.accentDot,
                                    { backgroundColor: color },
                                  ]}
                                />
                                <Text
                                  style={[
                                    styles.accentLabel,
                                    {
                                      color: theme.textPrimary,
                                      fontWeight: isActive ? "700" : "500",
                                    },
                                  ]}
                                >
                                  {accentLabels[name]}
                                </Text>
                                {isActive && (
                                  <Text
                                    style={[
                                      styles.accentSelectedTag,
                                      { color, borderColor: color },
                                    ]}
                                  >
                                    Selected
                                  </Text>
                                )}
                              </View>
                            </TouchableOpacity>
                          );
                        }
                      )}
                    </View>
                  )}
                </View>

                {/* JOB DEFAULTS */}
                <View
                  style={[
                    styles.sectionCard,
                    {
                      backgroundColor: theme.cardBackground + "F2",
                      borderColor: theme.cardBorder + "55",
                      borderTopColor: accentColor + "AA",
                      borderTopWidth: 2,
                    },
                  ]}
                  onLayout={(e) =>
                    registerSection("jobDefaults", e.nativeEvent.layout.y)
                  }
                >
                  <View style={styles.sectionHeaderRow}>
                    <View
                      style={[
                        styles.sectionIconBadge,
                        {
                          borderColor: accentColor + "80",
                          backgroundColor: accentColor + "1A",
                        },
                      ]}
                    >
                      <Ionicons
                        name="clipboard-outline"
                        size={16}
                        color={accentColor}
                      />
                    </View>
                    <Text
                      style={[
                        styles.sectionTitle,
                        { color: accentColor },
                      ]}
                    >
                      Job Defaults
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.sectionSubtitle,
                      { color: theme.textMuted },
                    ]}
                  >
                    Pre-fill new jobs with your common values.
                  </Text>

                  <View style={styles.fieldBlock}>
                    <Text
                      style={[
                        styles.fieldLabel,
                        { color: theme.textSecondary },
                      ]}
                    >
                      Default hourly rate
                    </Text>
                    <Text
                      style={[
                        styles.fieldHelp,
                        { color: theme.textMuted },
                      ]}
                    >
                      Used as the starting hourly rate for new jobs.
                    </Text>
                    <TextInput
                      style={[
                        styles.fieldInput,
                        {
                          backgroundColor: theme.inputBackground + "F2",
                          color: theme.inputText,
                          borderColor: theme.inputBorder,
                        },
                      ]}
                      value={defaultHourlyRate}
                      onChangeText={setDefaultHourlyRate}
                      keyboardType="numeric"
                      placeholder="Not set"
                      placeholderTextColor={theme.textMuted}
                      onFocus={() => handleFocus("jobDefaults")}
                      onBlur={handleBlur}
                    />
                  </View>

                  <View style={styles.fieldBlock}>
                    <Text
                      style={[
                        styles.fieldLabel,
                        { color: theme.textSecondary },
                      ]}
                    >
                      Default client name
                    </Text>
                    <Text
                      style={[
                        styles.fieldHelp,
                        { color: theme.textMuted },
                      ]}
                    >
                      Helpful for repeat clients or your company name.
                    </Text>
                    <TextInput
                      style={[
                        styles.fieldInput,
                        {
                          backgroundColor: theme.inputBackground + "F2",
                          color: theme.inputText,
                          borderColor: theme.inputBorder,
                        },
                      ]}
                      value={defaultClientName}
                      onChangeText={setDefaultClientName}
                      placeholder="None"
                      placeholderTextColor={theme.textMuted}
                      onFocus={() => handleFocus("jobDefaults")}
                      onBlur={handleBlur}
                    />
                  </View>

                  <View style={styles.fieldBlock}>
                    <Text
                      style={[
                        styles.fieldLabel,
                        { color: theme.textSecondary },
                      ]}
                    >
                      Default notes template
                    </Text>
                    <Text
                      style={[
                        styles.fieldHelp,
                        { color: theme.textMuted },
                      ]}
                    >
                      Pre-fills the Description / Scope on new jobs.
                    </Text>
                    <TextInput
                      style={[
                        styles.notesInput,
                        {
                          backgroundColor: theme.inputBackground + "F2",
                          color: theme.inputText,
                          borderColor: theme.inputBorder,
                        },
                      ]}
                      multiline
                      value={defaultNotesTemplate}
                      onChangeText={setDefaultNotesTemplate}
                      placeholder="Standard (empty)"
                      placeholderTextColor={theme.textMuted}
                      onFocus={() => handleFocus("jobDefaults")}
                      onBlur={handleBlur}
                    />
                  </View>
                </View>

                {/* COMPANY / BRANDING */}
                <View
                  style={[
                    styles.sectionCard,
                    {
                      backgroundColor: theme.cardBackground + "F2",
                      borderColor: theme.cardBorder + "55",
                      borderTopColor: accentColor + "AA",
                      borderTopWidth: 2,
                    },
                  ]}
                  onLayout={(e) =>
                    registerSection("branding", e.nativeEvent.layout.y)
                  }
                >
                  <View style={styles.sectionHeaderRow}>
                    <View
                      style={[
                        styles.sectionIconBadge,
                        {
                          borderColor: accentColor + "80",
                          backgroundColor: accentColor + "1A",
                        },
                      ]}
                    >
                      <Ionicons
                        name="briefcase-outline"
                        size={16}
                        color={accentColor}
                      />
                    </View>
                    <Text
                      style={[
                        styles.sectionTitle,
                        { color: accentColor },
                      ]}
                    >
                      Company / Branding
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.sectionSubtitle,
                      { color: theme.textMuted },
                    ]}
                  >
                    Shown on PDF reports for clients and your boss.
                  </Text>

                  <View style={styles.fieldBlock}>
                    <Text
                      style={[
                        styles.fieldLabel,
                        { color: theme.textSecondary },
                      ]}
                    >
                      Company name
                    </Text>
                    <TextInput
                      style={[
                        styles.fieldInput,
                        {
                          backgroundColor: theme.inputBackground + "F2",
                          color: theme.inputText,
                          borderColor: theme.inputBorder,
                        },
                      ]}
                      value={companyName}
                      onChangeText={setCompanyName}
                      placeholder="e.g. Reyes Electrical LLC"
                      placeholderTextColor={theme.textMuted}
                      onFocus={() => handleFocus("branding")}
                      onBlur={handleBlur}
                    />
                  </View>

                  <View style={styles.fieldBlock}>
                    <Text
                      style={[
                        styles.fieldLabel,
                        { color: theme.textSecondary },
                      ]}
                    >
                      Company phone
                    </Text>
                    <TextInput
                      style={[
                        styles.fieldInput,
                        {
                          backgroundColor: theme.inputBackground + "F2",
                          color: theme.inputText,
                          borderColor: theme.inputBorder,
                        },
                      ]}
                      value={companyPhone}
                      onChangeText={setCompanyPhone}
                      keyboardType="phone-pad"
                      placeholder="(xxx) xxx-xxxx"
                      placeholderTextColor={theme.textMuted}
                      onFocus={() => handleFocus("branding")}
                      onBlur={handleBlur}
                    />
                  </View>

                  <View style={styles.fieldBlock}>
                    <Text
                      style={[
                        styles.fieldLabel,
                        { color: theme.textSecondary },
                      ]}
                    >
                      Company email
                    </Text>
                    <TextInput
                      style={[
                        styles.fieldInput,
                        {
                          backgroundColor: theme.inputBackground + "F2",
                          color: theme.inputText,
                          borderColor: theme.inputBorder,
                        },
                      ]}
                      value={companyEmail}
                      onChangeText={setCompanyEmail}
                      keyboardType="email-address"
                      placeholder="you@example.com"
                      placeholderTextColor={theme.textMuted}
                      autoCapitalize="none"
                      onFocus={() => handleFocus("branding")}
                      onBlur={handleBlur}
                    />
                  </View>

                  <View style={styles.fieldBlock}>
                    <Text
                      style={[
                        styles.fieldLabel,
                        { color: theme.textSecondary },
                      ]}
                    >
                      License / ID / tagline
                    </Text>
                    <TextInput
                      style={[
                        styles.fieldInput,
                        {
                          backgroundColor: theme.inputBackground + "F2",
                          color: theme.inputText,
                          borderColor: theme.inputBorder,
                        },
                      ]}
                      value={companyLicense}
                      onChangeText={setCompanyLicense}
                      placeholder="e.g. NYC Master License #12345"
                      placeholderTextColor={theme.textMuted}
                      onFocus={() => handleFocus("branding")}
                      onBlur={handleBlur}
                    />
                  </View>
                </View>

                {/* DATA & BACKUP */}
                <View
                  style={[
                    styles.sectionCard,
                    {
                      backgroundColor: theme.cardBackground + "F2",
                      borderColor: theme.cardBorder + "55",
                      borderTopColor: accentColor + "AA",
                      borderTopWidth: 2,
                    },
                  ]}
                  onLayout={(e) =>
                    registerSection("backup", e.nativeEvent.layout.y)
                  }
                >
                  <View style={styles.dataHeaderRow}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <View style={styles.sectionHeaderRow}>
                        <View
                          style={[
                            styles.sectionIconBadge,
                            {
                              borderColor: accentColor + "80",
                              backgroundColor: accentColor + "1A",
                            },
                          ]}
                        >
                          <Ionicons
                            name="shield-checkmark-outline"
                            size={16}
                            color={accentColor}
                          />
                        </View>
                        <Text
                          style={[
                            styles.sectionTitle,
                            { color: accentColor },
                          ]}
                        >
                          Data & Backup
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.sectionSubtitle,
                          { color: theme.textMuted },
                        ]}
                      >
                        Manual offline backup for your jobs
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.lastExportText,
                        { color: theme.textMuted },
                      ]}
                      numberOfLines={3}
                    >
                      Last backup: {formatLastExport()}
                    </Text>
                  </View>

                  {/* EXPORT */}
                  <View style={styles.dataRow}>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.fieldLabel,
                          { color: theme.textSecondary },
                        ]}
                      >
                        Create a backup (copy all jobs)
                      </Text>
                      <Text
                        style={[
                          styles.fieldHelp,
                          { color: theme.textMuted, lineHeight: 15 },
                        ]}
                      >
                        Copies all your jobs into the clipboard so you can paste
                        them into Notes, email, or Files and keep them safe.
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={[
                        styles.linkButton,
                        {
                          backgroundColor: accentColor + "22",
                          borderColor: accentColor + "AA",
                        },
                      ]}
                      onPress={handleExportJobs}
                      activeOpacity={0.85}
                    >
                      <Text
                        style={[
                          styles.linkButtonText,
                          { color: accentColor },
                        ]}
                      >
                        Copy backup
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* IMPORT / RESTORE */}
                  <View style={[styles.dataRow, { marginTop: 18 }]}>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.fieldLabel,
                          { color: theme.textSecondary },
                        ]}
                      >
                        Restore using copied backup
                      </Text>
                      <Text
                        style={[
                          styles.fieldHelp,
                          { color: theme.textMuted, lineHeight: 15 },
                        ]}
                      >
                        Open your saved backup in Notes or email, select all the
                        text and tap Copy, then return here and restore your
                        jobs.
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={[
                        styles.linkButton,
                        {
                          backgroundColor: accentColor + "22",
                          borderColor: accentColor + "AA",
                        },
                      ]}
                      onPress={handleImportJobs}
                      activeOpacity={0.85}
                    >
                      <Text
                        style={[
                          styles.linkButtonText,
                          { color: accentColor },
                        ]}
                      >
                        Use copied backup
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* ACCOUNT / LOGOUT (NEW) */}
                <View
                  style={[
                    styles.sectionCard,
                    {
                      backgroundColor: theme.cardBackground + "F2",
                      borderColor: theme.cardBorder + "55",
                      borderTopColor: accentColor + "AA",
                      borderTopWidth: 2,
                    },
                  ]}
                  onLayout={(e) =>
                    registerSection("account", e.nativeEvent.layout.y)
                  }
                >
                  <View style={styles.sectionHeaderRow}>
                    <View
                      style={[
                        styles.sectionIconBadge,
                        {
                          borderColor: accentColor + "80",
                          backgroundColor: accentColor + "1A",
                        },
                      ]}
                    >
                      <Ionicons
                        name="person-circle-outline"
                        size={16}
                        color={accentColor}
                      />
                    </View>
                    <Text
                      style={[
                        styles.sectionTitle,
                        { color: accentColor },
                      ]}
                    >
                      Account
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.sectionSubtitle,
                      { color: theme.textMuted },
                    ]}
                  >
                    Log out of Traktr on this device.
                  </Text>

                  <TouchableOpacity
                    style={[
                      styles.logoutButton,
                      {
                        borderColor: accentColor + "AA",
                        backgroundColor: accentColor + "1A",
                      },
                    ]}
                    onPress={handleLogout}
                    activeOpacity={0.9}
                  >
                    <Ionicons
                      name="log-out-outline"
                      size={16}
                      color={accentColor}
                    />
                    <Text
                      style={[
                        styles.logoutText,
                        { color: accentColor },
                      ]}
                    >
                      Log out
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* ABOUT TRAKTR */}
                <View
                  style={[
                    styles.sectionCard,
                    {
                      backgroundColor: theme.cardBackground + "F2",
                      borderColor: theme.cardBorder + "55",
                      borderTopColor: accentColor + "AA",
                      borderTopWidth: 2,
                    },
                  ]}
                  onLayout={(e) =>
                    registerSection("about", e.nativeEvent.layout.y)
                  }
                >
                  <View style={styles.sectionHeaderRow}>
                    <View
                      style={[
                        styles.sectionIconBadge,
                        {
                          borderColor: accentColor + "80",
                          backgroundColor: accentColor + "1A",
                        },
                      ]}
                    >
                      <Ionicons
                        name="information-circle-outline"
                        size={16}
                        color={accentColor}
                      />
                    </View>
                    <Text
                      style={[
                        styles.sectionTitle,
                        { color: accentColor },
                      ]}
                    >
                      About Traktr
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.aboutRow}
                    onPress={() => router.push("/app-info")}
                    activeOpacity={0.8}
                  >
                    <View style={{ flex: 1 }}>
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
                        { color: accentColor },
                      ]}
                    >
                      Details
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.aboutRow}
                    onPress={handleSendFeedback}
                    activeOpacity={0.8}
                  >
                    <View style={{ flex: 1 }}>
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
                        { color: accentColor },
                      ]}
                    >
                      Email
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </ScrollView>
        </View>

        {/* Bottom Nav – hidden while typing */}
        {!isEditing && <BottomNavBar active="settings" theme={theme} />}
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingTop: 48,
    paddingHorizontal: 16,
  },

  headerShell: {
    paddingBottom: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerIconBadge: {
    width: 30,
    height: 30,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },

  scrollContent: {
    gap: 12,
  },

  sectionCard: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  sectionIconBadge: {
    width: 26,
    height: 26,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  sectionSubtitle: {
    fontSize: 11,
    marginBottom: 6,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  rowTitle: {
    fontSize: 13,
    fontWeight: "600",
  },
  rowSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  rowValue: {
    fontSize: 13,
    fontWeight: "600",
    marginLeft: 12,
  },

  optionList: {
    marginTop: 8,
    gap: 6,
  },
  optionButton: {
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },

  fieldBlock: {
    marginTop: 10,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  fieldHelp: {
    fontSize: 11,
    marginTop: 2,
    marginBottom: 4,
  },
  fieldInput: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
  },
  notesInput: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    minHeight: 80,
    textAlignVertical: "top",
  },

  dataHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  lastExportText: {
    fontSize: 10,
    textAlign: "right",
    flexShrink: 1,
    maxWidth: "50%",
  },
  dataRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 10,
  },

  linkButton: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 34,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  linkButtonText: {
    fontSize: 12,
    fontWeight: "600",
  },

  aboutRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    paddingVertical: 6,
  },

  // Accent styling
  accentValuePill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  accentDotSmall: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  accentValueText: {
    fontSize: 11,
    fontWeight: "600",
  },
  accentOptionButton: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  accentOptionContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  accentDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 8,
  },
  accentLabel: {
    fontSize: 13,
    flex: 1,
  },
  accentSelectedTag: {
    fontSize: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    overflow: "hidden",
  },

  logoutButton: {
    marginTop: 10,
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: "700",
  },
});
