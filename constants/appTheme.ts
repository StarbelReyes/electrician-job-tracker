// constants/appTheme.ts
// Central place for Traktr theme + accent system

export type ThemeName = "light" | "dark" | "midnight";

export const THEME_STORAGE_KEY = "EJT_THEME";

type Theme = {
  // Screen + cards
  screenBackground: string;
  cardBackground: string;
  cardSecondaryBackground: string;
  cardBorder: string;

  // Header
  headerText: string;
  headerMuted: string;

  // Text
  textPrimary: string;
  textSecondary: string;
  textMuted: string;

  // Inputs
  inputBackground: string;
  inputText: string;
  inputBorder: string;

  // Buttons
  primaryButtonBackground: string;
  primaryButtonText: string;
  secondaryButtonBackground: string;
  secondaryButtonText: string;

  // Status / tags / badges
  tagOpenBg: string;
  tagOpenBorder: string;
  tagOpenText: string;

  tagDoneBg: string;
  tagDoneBorder: string;
  tagDoneText: string;

  tagArchivedBg: string;
  tagArchivedBorder: string;
  tagArchivedText: string;

  // Summary cards
  summaryCardBackground: string;
  summaryCardBorder: string;

  // Danger / destructive actions
  dangerBorder: string;
  dangerText: string;
};

export type AccentName = "jobsiteAmber" | "electricBlue" | "safetyGreen";

export const ACCENT_STORAGE_KEY = "EJT_ACCENT";

export const accentLabels: Record<AccentName, string> = {
  jobsiteAmber: "Jobsite Amber",
  electricBlue: "Electric Blue",
  safetyGreen: "Safety Green",
};

export const accentSwatchColors: Record<AccentName, string> = {
  jobsiteAmber: "#F59E0B", // amber / jobsite
  electricBlue: "#3B82F6", // bright electric blue
  safetyGreen: "#22C55E", // safety green
};

export const getAccentColor = (accent: AccentName): string =>
  accentSwatchColors[accent] ?? accentSwatchColors.jobsiteAmber;

// Themes used across the app
export const themes: Record<ThemeName, Theme> = {
  light: {
    screenBackground: "#F3F4F6",
    cardBackground: "#FFFFFF",
    cardSecondaryBackground: "#E5E7EB",
    cardBorder: "#D1D5DB",

    headerText: "#111827",
    headerMuted: "#6B7280",

    textPrimary: "#111827",
    textSecondary: "#4B5563",
    textMuted: "#9CA3AF",

    inputBackground: "#FFFFFF",
    inputText: "#111827",
    inputBorder: "#D1D5DB",

    primaryButtonBackground: "#111827",
    primaryButtonText: "#F9FAFB",
    secondaryButtonBackground: "#E5E7EB",
    secondaryButtonText: "#111827",

    tagOpenBg: "#ECFEFF",
    tagOpenBorder: "#06B6D4",
    tagOpenText: "#0E7490",

    tagDoneBg: "#ECFDF5",
    tagDoneBorder: "#22C55E",
    tagDoneText: "#15803D",

    tagArchivedBg: "#F9FAFB",
    tagArchivedBorder: "#D1D5DB",
    tagArchivedText: "#6B7280",

    summaryCardBackground: "#FFFFFF",
    summaryCardBorder: "#E5E7EB",

    dangerBorder: "#EF4444",
    dangerText: "#B91C1C",
  },
  dark: {
    screenBackground: "#020617",
    cardBackground: "#020617",
    cardSecondaryBackground: "#0B1120",
    cardBorder: "#1F2937",

    headerText: "#F9FAFB",
    headerMuted: "#9CA3AF",

    textPrimary: "#F9FAFB",
    textSecondary: "#E5E7EB",
    textMuted: "#6B7280",

    inputBackground: "#020617",
    inputText: "#F9FAFB",
    inputBorder: "#334155",

    primaryButtonBackground: "#F59E0B",
    primaryButtonText: "#020617",
    secondaryButtonBackground: "#0B1120",
    secondaryButtonText: "#F9FAFB",

    tagOpenBg: "#0F172A",
    tagOpenBorder: "#06B6D4",
    tagOpenText: "#22D3EE",

    tagDoneBg: "#052E16",
    tagDoneBorder: "#22C55E",
    tagDoneText: "#4ADE80",

    tagArchivedBg: "#020617",
    tagArchivedBorder: "#1F2937",
    tagArchivedText: "#9CA3AF",

    summaryCardBackground: "#020617",
    summaryCardBorder: "#1F2937",

    dangerBorder: "#F87171",
    dangerText: "#FCA5A5",
  },
  midnight: {
    screenBackground: "#020617",
    cardBackground: "#020617",
    cardSecondaryBackground: "#020617",
    cardBorder: "#1E293B",

    headerText: "#E5E7EB",
    headerMuted: "#64748B",

    textPrimary: "#F9FAFB",
    textSecondary: "#CBD5F5",
    textMuted: "#64748B",

    inputBackground: "#020617",
    inputText: "#E5E7EB",
    inputBorder: "#1E293B",

    primaryButtonBackground: "#6366F1",
    primaryButtonText: "#F9FAFB",
    secondaryButtonBackground: "#0F172A",
    secondaryButtonText: "#E5E7EB",

    tagOpenBg: "#0B1120",
    tagOpenBorder: "#38BDF8",
    tagOpenText: "#7DD3FC",

    tagDoneBg: "#022C22",
    tagDoneBorder: "#22C55E",
    tagDoneText: "#6EE7B7",

    tagArchivedBg: "#020617",
    tagArchivedBorder: "#1E293B",
    tagArchivedText: "#64748B",

    summaryCardBackground: "#020617",
    summaryCardBorder: "#1E293B",

    dangerBorder: "#FB7185",
    dangerText: "#FDA4AF",
  },
};
