// constants/appTheme.ts
// Central place for Traktr theme + accent system
// ✅ NEW DIRECTION: App-wide Warm Graphite theme (no blue/white look)
// ✅ Accent default is now #FF0800 (tightly controlled)
// We keep legacy types/exports for compatibility while we migrate screens.

export type ThemeName = "light" | "dark" | "midnight" | "graphite";
export const THEME_STORAGE_KEY = "EJT_THEME";

// ✅ global font tokens (used across the app)
export const fonts = {
  regular: "Athiti-Regular",
  medium: "Athiti-Medium",
  semibold: "Athiti-SemiBold",
  bold: "Athiti-Bold",
};

export type Theme = {
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

/**
 * 🔒 Warm Graphite Palette (locked)
 */
export const GRAPHITE_COLORS = {
  screenBackground: "#0F1115",
  cardBackground: "#1A1D23",
  cardSecondaryBackground: "#15181E",
  cardBorder: "#2A2F38",
  inputBackground: "#12151B",
  inputBorder: "#2A2F38",
  textPrimary: "#E5E7EB",
  textSecondary: "#A1A7B3",
  textMuted: "#6B7280",
} as const;

/**
 * ✅ Brand + supporting secondaries for #FF0800 (tightly controlled)
 * Use these for meaning/status only — not big surfaces.
 */
export const BRAND_COLORS = {
  // Brand accent
  brand: "#FF0800",

  // Secondary support colors (small usage)
  amber: "#F5A524", // warm contrast, warnings / subtle highlights
  success: "#2FAE67", // muted green, readable on graphite
  info: "#4FA3C6", // muted cyan/steel (links/info chips), keep subtle

  // Danger should be readable but not harsh neon red on black
  dangerText: "#F2A3A3",
  dangerBorder: "#4B2A2A",
} as const;

/**
 * Legacy palette (kept for compatibility; screens may still reference this)
 * NOTE: Not used as the default anymore.
 */
export const TRAKTR_COLORS = {
  // Brand (Warm Steel Blue) - legacy
  brand: "#3A6EA5",
  brandDeep: "#2F5D8A",
  brandSoft: "#6F93B8",

  // Neutrals (warm + clean)
  bg: "#F7F8FA",
  surface: "#FFFFFF",
  text: "#2E2E2E",
  textMuted: "#6B7280",
  divider: "#E5E7EB",

  // Surface tint
  panel: "#EEF3F8",

  // Meaning colors
  success: "#16A34A",
  warning: "#F59E0B",
  error: "#DC2626",
} as const;

// --- Accent system (kept; do NOT change storage key) ---
export type AccentName = "jobsiteAmber" | "electricBlue" | "safetyGreen";
export const ACCENT_STORAGE_KEY = "EJT_ACCENT";

export const accentLabels: Record<AccentName, string> = {
  jobsiteAmber: "Brand Red",
  electricBlue: "Muted Cyan",
  safetyGreen: "Safety Green",
};

/**
 * ✅ Accent stays controlled by our accent system.
 * ✅ Default should complement graphite and be tightly controlled.
 * We’re repurposing the options to keep Settings stable while you migrate UI.
 */
export const accentSwatchColors: Record<AccentName, string> = {
  // Default: Brand Red
  jobsiteAmber: BRAND_COLORS.brand, // #FF0800

  // Support accents (keep subtle in UI)
  electricBlue: BRAND_COLORS.info, // muted cyan/steel
  safetyGreen: BRAND_COLORS.success,
};

export const getAccentColor = (accent: AccentName): string =>
  accentSwatchColors[accent] ?? BRAND_COLORS.brand;

/**
 * Themes used across the app
 * ✅ graphite is now the new default (PreferencesContext sets it).
 * ✅ Keep legacy themes so nothing breaks during migration.
 */
export const themes: Record<ThemeName, Theme> = {
  /**
   * ✅ NEW DEFAULT: Graphite (Warm Graphite locked palette)
   * Accent is handled separately by accent system.
   */
  graphite: {
    screenBackground: GRAPHITE_COLORS.screenBackground,
    cardBackground: GRAPHITE_COLORS.cardBackground,
    cardSecondaryBackground: GRAPHITE_COLORS.cardSecondaryBackground,
    cardBorder: GRAPHITE_COLORS.cardBorder,

    headerText: GRAPHITE_COLORS.textPrimary,
    headerMuted: GRAPHITE_COLORS.textSecondary,

    textPrimary: GRAPHITE_COLORS.textPrimary,
    textSecondary: GRAPHITE_COLORS.textSecondary,
    textMuted: GRAPHITE_COLORS.textMuted,

    inputBackground: GRAPHITE_COLORS.inputBackground,
    inputText: GRAPHITE_COLORS.textPrimary,
    inputBorder: GRAPHITE_COLORS.inputBorder,

    // Buttons: neutral defaults.
    // Screens should apply `accentColor` for true CTAs.
    primaryButtonBackground: GRAPHITE_COLORS.cardBorder,
    primaryButtonText: GRAPHITE_COLORS.textPrimary,
    secondaryButtonBackground: GRAPHITE_COLORS.cardSecondaryBackground,
    secondaryButtonText: GRAPHITE_COLORS.textPrimary,

    // Tags: neutral by default (avoid screaming red everywhere).
    tagOpenBg: GRAPHITE_COLORS.cardSecondaryBackground,
    tagOpenBorder: GRAPHITE_COLORS.cardBorder,
    tagOpenText: GRAPHITE_COLORS.textSecondary,

    tagDoneBg: GRAPHITE_COLORS.cardSecondaryBackground,
    tagDoneBorder: GRAPHITE_COLORS.cardBorder,
    tagDoneText: GRAPHITE_COLORS.textSecondary,

    tagArchivedBg: GRAPHITE_COLORS.cardSecondaryBackground,
    tagArchivedBorder: GRAPHITE_COLORS.cardBorder,
    tagArchivedText: GRAPHITE_COLORS.textMuted,

    summaryCardBackground: GRAPHITE_COLORS.cardBackground,
    summaryCardBorder: GRAPHITE_COLORS.cardBorder,

    // Danger: readable, not harsh neon on black
    dangerBorder: BRAND_COLORS.dangerBorder,
    dangerText: BRAND_COLORS.dangerText,
  },

  /**
   * Legacy light theme (kept temporarily so the app doesn’t break while we migrate).
   * Not the default anymore.
   */
  light: {
    screenBackground: TRAKTR_COLORS.bg,
    cardBackground: TRAKTR_COLORS.surface,
    cardSecondaryBackground: TRAKTR_COLORS.panel,
    cardBorder: TRAKTR_COLORS.divider,

    headerText: TRAKTR_COLORS.text,
    headerMuted: TRAKTR_COLORS.textMuted,

    textPrimary: TRAKTR_COLORS.text,
    textSecondary: TRAKTR_COLORS.textMuted,
    textMuted: "#9CA3AF",

    inputBackground: TRAKTR_COLORS.surface,
    inputText: TRAKTR_COLORS.text,
    inputBorder: TRAKTR_COLORS.divider,

    primaryButtonBackground: TRAKTR_COLORS.brand,
    primaryButtonText: "#FFFFFF",
    secondaryButtonBackground: TRAKTR_COLORS.panel,
    secondaryButtonText: TRAKTR_COLORS.brandDeep,

    tagOpenBg: "#EFF6FF",
    tagOpenBorder: TRAKTR_COLORS.brandSoft,
    tagOpenText: TRAKTR_COLORS.brandDeep,

    tagDoneBg: "#ECFDF5",
    tagDoneBorder: TRAKTR_COLORS.success,
    tagDoneText: "#15803D",

    tagArchivedBg: "#F9FAFB",
    tagArchivedBorder: TRAKTR_COLORS.divider,
    tagArchivedText: TRAKTR_COLORS.textMuted,

    summaryCardBackground: TRAKTR_COLORS.surface,
    summaryCardBorder: TRAKTR_COLORS.divider,

    dangerBorder: TRAKTR_COLORS.error,
    dangerText: "#991B1B",
  },

  /**
   * Legacy themes (kept temporarily so the app doesn’t break while we migrate).
   */
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

    dangerBorder: BRAND_COLORS.dangerBorder,
    dangerText: BRAND_COLORS.dangerText,
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

    dangerBorder: BRAND_COLORS.dangerBorder,
    dangerText: BRAND_COLORS.dangerText,
  },
};
