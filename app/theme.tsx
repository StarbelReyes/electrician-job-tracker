// app/theme.ts

export type ThemeName = "light" | "dark" | "midnight";

export const THEME_STORAGE_KEY = "EJT_THEME";

type Theme = {
  // Existing fields (your original)
  screenBackground: string;
  cardBackground: string;
  cardSecondaryBackground: string;
  cardBorder: string;

  headerText: string;
  headerMuted: string;

  textPrimary: string;
  textSecondary: string;
  textMuted: string;

  inputBackground: string;
  inputText: string;
  inputBorder: string;

  primaryButtonBackground: string;
  primaryButtonText: string;

  secondaryButtonBackground: string;
  secondaryButtonText: string;

  dangerBorder: string;
  dangerText: string;

  // 🔹 New fields used by Home / Settings
  // Status tags (Open / Done)
  tagOpenBg: string;
  tagOpenBorder: string;
  tagOpenText: string;

  tagDoneBg: string;
  tagDoneBorder: string;
  tagDoneText: string;

  // Badges (trash count, etc.)
  badgeBackground: string;
  badgeText: string;

  // Summary cards (Open / Done / Total)
  summaryCardBackground: string;
  summaryCardBorder: string;

  // Section headers + pills (used in Settings screen)
  sectionHeaderBackground: string;
  sectionHeaderText: string;
  pillBackground: string;
  pillText: string;
};

export const themes: Record<ThemeName, Theme> = {
  light: {
    screenBackground: "#F3F4F6",
    cardBackground: "#FFFFFF",
    cardSecondaryBackground: "#FFFFFF",
    cardBorder: "#E5E7EB",

    headerText: "#111827",
    headerMuted: "#6B7280",

    textPrimary: "#111827",
    textSecondary: "#374151",
    textMuted: "#9CA3AF",

    inputBackground: "#FFFFFF",
    inputText: "#111827",
    inputBorder: "#D1D5DB",

    primaryButtonBackground: "#2563EB",
    primaryButtonText: "#FFFFFF",

    secondaryButtonBackground: "#E5E7EB",
    secondaryButtonText: "#111827",

    dangerBorder: "#DC2626",
    dangerText: "#B91C1C",

    // 🔹 New fields
    tagOpenBg: "rgba(59,130,246,0.12)",
    tagOpenBorder: "#3B82F6",
    tagOpenText: "#1D4ED8",

    tagDoneBg: "rgba(22,163,74,0.12)",
    tagDoneBorder: "#16A34A",
    tagDoneText: "#15803D",

    badgeBackground: "#DC2626",
    badgeText: "#F9FAFB",

    summaryCardBackground: "#FFFFFF",
    summaryCardBorder: "#E5E7EB",

    sectionHeaderBackground: "#F9FAFB",
    sectionHeaderText: "#111827",
    pillBackground: "#E5E7EB",
    pillText: "#111827",
  },

  dark: {
    screenBackground: "#020617",
    cardBackground: "#111827",
    cardSecondaryBackground: "#020617",
    cardBorder: "#1F2937",

    headerText: "#F9FAFB",
    headerMuted: "#9CA3AF",

    textPrimary: "#F9FAFB",
    textSecondary: "#E5E7EB",
    textMuted: "#6B7280",

    inputBackground: "#020617",
    inputText: "#F9FAFB",
    inputBorder: "#374151",

    primaryButtonBackground: "#2563EB",
    primaryButtonText: "#FFFFFF",

    secondaryButtonBackground: "#374151",
    secondaryButtonText: "#E5E7EB",

    dangerBorder: "#DC2626",
    dangerText: "#FCA5A5",

    // 🔹 New fields
    tagOpenBg: "rgba(59,130,246,0.12)",
    tagOpenBorder: "#3B82F6",
    tagOpenText: "#BFDBFE",

    tagDoneBg: "rgba(22,163,74,0.16)",
    tagDoneBorder: "#16A34A",
    tagDoneText: "#BBF7D0",

    badgeBackground: "#DC2626",
    badgeText: "#F9FAFB",

    summaryCardBackground: "#020617",
    summaryCardBorder: "#1F2937",

    sectionHeaderBackground: "#020617",
    sectionHeaderText: "#F9FAFB",
    pillBackground: "#111827",
    pillText: "#E5E7EB",
  },

  midnight: {
    screenBackground: "#020617",
    cardBackground: "#02081E",
    cardSecondaryBackground: "#02081E",
    cardBorder: "#1E293B",

    headerText: "#E5E7EB",
    headerMuted: "#64748B",

    textPrimary: "#E5E7EB",
    textSecondary: "#CBD5F5",
    textMuted: "#64748B",

    inputBackground: "#020617",
    inputText: "#E5E7EB",
    inputBorder: "#1D4ED8",

    primaryButtonBackground: "#1D4ED8",
    primaryButtonText: "#E5E7EB",

    secondaryButtonBackground: "#020617",
    secondaryButtonText: "#E5E7EB",

    dangerBorder: "#F97373",
    dangerText: "#FCA5A5",

    // 🔹 New fields
    tagOpenBg: "rgba(79,70,229,0.18)",
    tagOpenBorder: "#4F46E5",
    tagOpenText: "#C7D2FE",

    tagDoneBg: "rgba(34,197,94,0.18)",
    tagDoneBorder: "#22C55E",
    tagDoneText: "#BBF7D0",

    badgeBackground: "#DC2626",
    badgeText: "#F9FAFB",

    summaryCardBackground: "#02081E",
    summaryCardBorder: "#1E293B",

    sectionHeaderBackground: "#020617",
    sectionHeaderText: "#E5E7EB",
    pillBackground: "#020617",
    pillText: "#E5E7EB",
  },
};
