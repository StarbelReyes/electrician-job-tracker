// app/settings.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
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

export default function SettingsScreen() {
  const router = useRouter();

  const [themeName, setThemeName] = useState<ThemeName>("dark");
  const [isThemeExpanded, setIsThemeExpanded] = useState(false);
  const theme = themes[themeName];

  // Backup / restore state
  const [isExportModalVisible, setIsExportModalVisible] = useState(false);
  const [isImportModalVisible, setIsImportModalVisible] = useState(false);
  const [exportJson, setExportJson] = useState("");
  const [importJson, setImportJson] = useState("");

  // Ref to force-blur the import TextInput
  const importInputRef = useRef<TextInput | null>(null);

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

  useEffect(() => {
    loadTheme();
  }, [loadTheme]);

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
      Alert.alert(
        "Copied",
        "Your backup JSON has been copied to the clipboard."
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
                "Your jobs backup has been restored."
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

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.screenBackground }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 20 : 0}
    >
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

        {/* Content */}
        <View style={styles.content}>
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
                  { color: "#3B82F6" },
                ]}
              >
                {themeLabels[themeName]}
              </Text>
            </TouchableOpacity>

            {isThemeExpanded && (
              <View style={styles.themeOptions}>
                {(["light", "dark", "midnight"] as ThemeName[]).map((value) => (
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
                          value === themeName && styles.themeOptionDotActive,
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
                ))}
              </View>
            )}

            {/* Accent color row (placeholder) */}
            <View style={styles.rowDivider} />
            <View style={styles.row}>
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
                  { color: theme.textMuted },
                ]}
              >
                Coming soon
              </Text>
            </View>
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
          >
            <View style={styles.row}>
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
                  Used when creating new jobs.
                </Text>
              </View>
              <Text
                style={[
                  styles.rowValue,
                  { color: theme.textMuted },
                ]}
              >
                Not set
              </Text>
            </View>

            <View style={styles.rowDivider} />
            <View style={styles.row}>
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
                  Optional default for repeat clients.
                </Text>
              </View>
              <Text
                style={[
                  styles.rowValue,
                  { color: theme.textMuted },
                ]}
              >
                None
              </Text>
            </View>

            <View style={styles.rowDivider} />
            <View style={styles.row}>
              <View style={styles.rowTextCol}>
                <Text
                  style={[
                    styles.rowTitle,
                    { color: theme.textPrimary },
                  ]}
                >
                  Default notes template
                </Text>
                <Text
                  style={[
                    styles.rowSubtitle,
                    { color: theme.textMuted },
                  ]}
                >
                  Pre-fill scope / notes on new jobs.
                </Text>
              </View>
              <Text
                style={[
                  styles.rowValue,
                  { color: theme.textMuted },
                ]}
              >
                Standard
              </Text>
            </View>
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
                  Open a backup screen and copy all jobs as JSON text.
                </Text>
              </View>
              <Text
                style={[
                  styles.rowValue,
                  { color: "#3B82F6" },
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
            <View style={styles.row}>
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
                  { color: "#3B82F6" },
                ]}
              >
                Details
              </Text>
            </View>

            <View style={styles.rowDivider} />
            <View style={styles.row}>
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
                  { color: theme.textMuted },
                ]}
              >
                Not set up
              </Text>
            </View>
          </View>
        </View>

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
                    { backgroundColor: "#3B82F6" },
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
            keyboardVerticalOffset={40}
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
    paddingBottom: 24,
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
