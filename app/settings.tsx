// app/settings.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { THEME_STORAGE_KEY, ThemeName, themes } from "./theme";

const themeLabels: Record<ThemeName, string> = {
  light: "Light",
  dark: "Dark",
  midnight: "Midnight Blue",
};

export default function SettingsScreen() {
  const router = useRouter();

  const [themeName, setThemeName] = useState<ThemeName>("dark");
  const [isThemeExpanded, setIsThemeExpanded] = useState(false);
  const theme = themes[themeName];

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
            onPress={() => router.back()}
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
              onPress={() => setIsThemeExpanded((prev) => !prev)}
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
            <View style={styles.row}>
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
                  Copy all jobs as JSON text for backup.
                </Text>
              </View>
              <Text
                style={[
                  styles.rowValue,
                  { color: "#3B82F6" },
                ]}
              >
                Planned
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
                  Import from JSON
                </Text>
                <Text
                  style={[
                    styles.rowSubtitle,
                    { color: theme.textMuted },
                  ]}
                >
                  Restore jobs from a JSON backup.
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
});
