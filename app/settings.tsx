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
import { usePreferences } from "../context/PreferencesContext";

const USER_STORAGE_KEY = "EJT_USER_SESSION";

const STORAGE_KEYS = {
  DEFAULT_HOURLY_RATE: "EJT_DEFAULT_HOURLY_RATE",
  DEFAULT_CLIENT_NAME: "EJT_DEFAULT_CLIENT_NAME",
  DEFAULT_NOTES_TEMPLATE: "EJT_DEFAULT_NOTES_TEMPLATE",
  BACKUP_LAST_EXPORT: "EJT_BACKUP_LAST_EXPORT",

  COMPANY_NAME: "EJT_COMPANY_NAME",
  COMPANY_PHONE: "EJT_COMPANY_PHONE",
  COMPANY_EMAIL: "EJT_COMPANY_EMAIL",
  COMPANY_LICENSE: "EJT_COMPANY_LICENSE",
};

export default function SettingsScreen() {
  const router = useRouter();
  const { theme } = usePreferences();

  // 🔒 Brand from locked theme
  const brand = theme.primaryButtonBackground;

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

  // Screen zoom animation
  const screenScale = useRef(new Animated.Value(1.04)).current;
  useEffect(() => {
    Animated.timing(screenScale, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [screenScale]);

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

  const loadSettings = useCallback(async () => {
    try {
      const [
        hourlySaved,
        clientSaved,
        notesSaved,
        lastExportSaved,
        companyNameSaved,
        companyPhoneSaved,
        companyEmailSaved,
        companyLicenseSaved,
      ] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.DEFAULT_HOURLY_RATE),
        AsyncStorage.getItem(STORAGE_KEYS.DEFAULT_CLIENT_NAME),
        AsyncStorage.getItem(STORAGE_KEYS.DEFAULT_NOTES_TEMPLATE),
        AsyncStorage.getItem(STORAGE_KEYS.BACKUP_LAST_EXPORT),
        AsyncStorage.getItem(STORAGE_KEYS.COMPANY_NAME),
        AsyncStorage.getItem(STORAGE_KEYS.COMPANY_PHONE),
        AsyncStorage.getItem(STORAGE_KEYS.COMPANY_EMAIL),
        AsyncStorage.getItem(STORAGE_KEYS.COMPANY_LICENSE),
      ]);

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

  const saveJobDefaults = async (hourly: string, client: string, notes: string) => {
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

  const saveBranding = async (name: string, phone: string, email: string, license: string) => {
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

  // Backup handlers
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
        }).\n\nThis cannot be undone.\n\nDo you want to continue?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Replace jobs",
            style: "destructive",
            onPress: async () => {
              try {
                await AsyncStorage.setItem("EJT_JOBS", JSON.stringify(parsed));
                Alert.alert("Restored ✅", "Your jobs were restored successfully from backup.");
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
      Alert.alert("Error", "Could not read backup from clipboard. Try again.");
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

  useEffect(() => {
    saveJobDefaults(defaultHourlyRate, defaultClientName, defaultNotesTemplate);
  }, [defaultHourlyRate, defaultClientName, defaultNotesTemplate]);

  useEffect(() => {
    saveBranding(companyName.trim(), companyPhone.trim(), companyEmail.trim(), companyLicense.trim());
  }, [companyName, companyPhone, companyEmail, companyLicense]);

  const handleSendFeedback = () => {
    const email = "support@example.com";
    const subject = encodeURIComponent("Traktr feedback");
    const body = encodeURIComponent("");
    Linking.openURL(`mailto:${email}?subject=${subject}&body=${body}`).catch(() => {
      Alert.alert("Error", "Could not open email app.");
    });
  };

  const handleLogout = () => {
    Alert.alert("Log out", "This will sign you out of Traktr on this device.", [
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
    ]);
  };

  const handleFocus = (sectionKey: string) => {
    setIsEditing(true);
    scrollToSection(sectionKey);
  };

  const handleBlur = () => setIsEditing(false);

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
                    borderColor: brand + "80",
                    backgroundColor: brand + "1A",
                  },
                ]}
              >
                <Ionicons name="settings-outline" size={18} color={brand} />
              </View>
              <Text style={[styles.headerTitle, { color: theme.headerText }]}>Settings</Text>
            </View>
            <View style={{ width: 24 }} />
          </View>
        </View>

        <View style={{ flex: 1 }}>
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1, backgroundColor: theme.screenBackground }}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: isEditing ? 8 : 24 }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="always"
            onScrollBeginDrag={dismissKeyboardAndEditing}
          >
            <TouchableWithoutFeedback onPress={dismissKeyboardAndEditing} accessible={false}>
              <View>
                {/* JOB DEFAULTS */}
                <View
                  style={[
                    styles.sectionCard,
                    {
                      backgroundColor: theme.cardBackground + "F2",
                      borderColor: theme.cardBorder + "55",
                      borderTopColor: brand + "AA",
                      borderTopWidth: 2,
                    },
                  ]}
                  onLayout={(e) => registerSection("jobDefaults", e.nativeEvent.layout.y)}
                >
                  <View style={styles.sectionHeaderRow}>
                    <View
                      style={[
                        styles.sectionIconBadge,
                        { borderColor: brand + "80", backgroundColor: brand + "1A" },
                      ]}
                    >
                      <Ionicons name="clipboard-outline" size={16} color={brand} />
                    </View>
                    <Text style={[styles.sectionTitle, { color: brand }]}>Job Defaults</Text>
                  </View>
                  <Text style={[styles.sectionSubtitle, { color: theme.textMuted }]}>
                    Pre-fill new jobs with your common values.
                  </Text>

                  <View style={styles.fieldBlock}>
                    <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                      Default hourly rate
                    </Text>
                    <Text style={[styles.fieldHelp, { color: theme.textMuted }]}>
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
                    <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                      Default client name
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
                    <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                      Default notes template
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
                      borderTopColor: brand + "AA",
                      borderTopWidth: 2,
                    },
                  ]}
                  onLayout={(e) => registerSection("branding", e.nativeEvent.layout.y)}
                >
                  <View style={styles.sectionHeaderRow}>
                    <View
                      style={[
                        styles.sectionIconBadge,
                        { borderColor: brand + "80", backgroundColor: brand + "1A" },
                      ]}
                    >
                      <Ionicons name="briefcase-outline" size={16} color={brand} />
                    </View>
                    <Text style={[styles.sectionTitle, { color: brand }]}>Company / Branding</Text>
                  </View>
                  <Text style={[styles.sectionSubtitle, { color: theme.textMuted }]}>
                    Shown on PDF reports for clients and your boss.
                  </Text>

                  <View style={styles.fieldBlock}>
                    <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Company name</Text>
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
                    <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Company phone</Text>
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
                    <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Company email</Text>
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
                    <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
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
                      borderTopColor: brand + "AA",
                      borderTopWidth: 2,
                    },
                  ]}
                  onLayout={(e) => registerSection("backup", e.nativeEvent.layout.y)}
                >
                  <View style={styles.dataHeaderRow}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <View style={styles.sectionHeaderRow}>
                        <View
                          style={[
                            styles.sectionIconBadge,
                            { borderColor: brand + "80", backgroundColor: brand + "1A" },
                          ]}
                        >
                          <Ionicons name="shield-checkmark-outline" size={16} color={brand} />
                        </View>
                        <Text style={[styles.sectionTitle, { color: brand }]}>Data & Backup</Text>
                      </View>
                      <Text style={[styles.sectionSubtitle, { color: theme.textMuted }]}>
                        Manual offline backup for your jobs
                      </Text>
                    </View>

                    <Text style={[styles.lastExportText, { color: theme.textMuted }]} numberOfLines={3}>
                      Last backup: {formatLastExport()}
                    </Text>
                  </View>

                  <View style={styles.dataRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                        Create a backup (copy all jobs)
                      </Text>
                      <Text style={[styles.fieldHelp, { color: theme.textMuted, lineHeight: 15 }]}>
                        Copies all your jobs into the clipboard so you can paste them into Notes, email,
                        or Files and keep them safe.
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={[
                        styles.linkButton,
                        { backgroundColor: brand + "22", borderColor: brand + "AA" },
                      ]}
                      onPress={handleExportJobs}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.linkButtonText, { color: brand }]}>Copy backup</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={[styles.dataRow, { marginTop: 18 }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                        Restore using copied backup
                      </Text>
                      <Text style={[styles.fieldHelp, { color: theme.textMuted, lineHeight: 15 }]}>
                        Open your saved backup in Notes or email, select all the text and tap Copy,
                        then return here and restore your jobs.
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={[
                        styles.linkButton,
                        { backgroundColor: brand + "22", borderColor: brand + "AA" },
                      ]}
                      onPress={handleImportJobs}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.linkButtonText, { color: brand }]}>Use copied backup</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* ACCOUNT */}
                <View
                  style={[
                    styles.sectionCard,
                    {
                      backgroundColor: theme.cardBackground + "F2",
                      borderColor: theme.cardBorder + "55",
                      borderTopColor: brand + "AA",
                      borderTopWidth: 2,
                    },
                  ]}
                  onLayout={(e) => registerSection("account", e.nativeEvent.layout.y)}
                >
                  <View style={styles.sectionHeaderRow}>
                    <View
                      style={[
                        styles.sectionIconBadge,
                        { borderColor: brand + "80", backgroundColor: brand + "1A" },
                      ]}
                    >
                      <Ionicons name="person-circle-outline" size={16} color={brand} />
                    </View>
                    <Text style={[styles.sectionTitle, { color: brand }]}>Account</Text>
                  </View>
                  <Text style={[styles.sectionSubtitle, { color: theme.textMuted }]}>
                    Log out of Traktr on this device.
                  </Text>

                  <TouchableOpacity
                    style={[
                      styles.logoutButton,
                      { borderColor: brand + "AA", backgroundColor: brand + "1A" },
                    ]}
                    onPress={handleLogout}
                    activeOpacity={0.9}
                  >
                    <Ionicons name="log-out-outline" size={16} color={brand} />
                    <Text style={[styles.logoutText, { color: brand }]}>Log out</Text>
                  </TouchableOpacity>
                </View>

                {/* ABOUT */}
                <View
                  style={[
                    styles.sectionCard,
                    {
                      backgroundColor: theme.cardBackground + "F2",
                      borderColor: theme.cardBorder + "55",
                      borderTopColor: brand + "AA",
                      borderTopWidth: 2,
                    },
                  ]}
                  onLayout={(e) => registerSection("about", e.nativeEvent.layout.y)}
                >
                  <View style={styles.sectionHeaderRow}>
                    <View
                      style={[
                        styles.sectionIconBadge,
                        { borderColor: brand + "80", backgroundColor: brand + "1A" },
                      ]}
                    >
                      <Ionicons name="information-circle-outline" size={16} color={brand} />
                    </View>
                    <Text style={[styles.sectionTitle, { color: brand }]}>About Traktr</Text>
                  </View>

                  <TouchableOpacity style={styles.aboutRow} onPress={() => router.push("/app-info")} activeOpacity={0.8}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.rowTitle, { color: theme.textPrimary }]}>About this app</Text>
                      <Text style={[styles.rowSubtitle, { color: theme.textMuted }]}>
                        See version, purpose, and future plans.
                      </Text>
                    </View>
                    <Text style={[styles.rowValue, { color: brand }]}>Details</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.aboutRow} onPress={handleSendFeedback} activeOpacity={0.8}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.rowTitle, { color: theme.textPrimary }]}>Feedback</Text>
                      <Text style={[styles.rowSubtitle, { color: theme.textMuted }]}>
                        Share ideas or report issues.
                      </Text>
                    </View>
                    <Text style={[styles.rowValue, { color: brand }]}>Email</Text>
                  </TouchableOpacity>
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
  screen: { flex: 1, paddingTop: 48, paddingHorizontal: 16 },
  headerShell: { paddingBottom: 8 },
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
  headerLeft: { flexDirection: "row", alignItems: "center" },
  headerIconBadge: {
    width: 30,
    height: 30,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  headerTitle: { fontSize: 18, fontFamily: "Athiti-Bold" },

  scrollContent: { gap: 12 },

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
  sectionHeaderRow: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  sectionIconBadge: {
    width: 26,
    height: 26,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  sectionTitle: { fontSize: 14, fontFamily: "Athiti-Bold" },
  sectionSubtitle: { fontSize: 11, marginBottom: 6, fontFamily: "Athiti-Regular" },

  rowTitle: { fontSize: 13, fontFamily: "Athiti-SemiBold" },
  rowSubtitle: { fontSize: 11, marginTop: 2, fontFamily: "Athiti-Regular" },
  rowValue: { fontSize: 13, fontFamily: "Athiti-SemiBold", marginLeft: 12 },

  fieldBlock: { marginTop: 10 },
  fieldLabel: { fontSize: 12, fontFamily: "Athiti-SemiBold" },
  fieldHelp: { fontSize: 11, marginTop: 2, marginBottom: 4, fontFamily: "Athiti-Regular" },
  fieldInput: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    fontFamily: "Athiti-Regular",
  },
  notesInput: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    minHeight: 80,
    textAlignVertical: "top",
    fontFamily: "Athiti-Regular",
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
    fontFamily: "Athiti-Regular",
  },
  dataRow: { flexDirection: "row", alignItems: "flex-start", marginTop: 10 },

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
  linkButtonText: { fontSize: 12, fontFamily: "Athiti-SemiBold" },

  aboutRow: { flexDirection: "row", alignItems: "center", marginTop: 10, paddingVertical: 6 },

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
  logoutText: { fontSize: 14, fontFamily: "Athiti-Bold" },
});
