// context/PreferencesContext.tsx
// ✅ DEFAULT: Traktr launches with Warm Graphite theme.
// ✅ Accent system remains active (no storage key changes).
// ✅ Default accent is now Brand Red (#FF0800) via appTheme accentSwatchColors.
// ✅ Public API shape stays the same so the rest of the app doesn’t break.

import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";
import {
    ACCENT_STORAGE_KEY,
    AccentName,
    THEME_STORAGE_KEY,
    ThemeName,
    getAccentColor,
    themes,
} from "../constants/appTheme";

type Prefs = {
  isReady: boolean;
  themeName: ThemeName;
  theme: (typeof themes)["light"]; // shape-compatible with all themes
  accentName: AccentName;
  accentColor: string;

  setThemeName: (name: ThemeName) => void;
  setAccentName: (name: AccentName) => void;
};

const PreferencesContext = createContext<Prefs | null>(null);

// ✅ Defaults (graphite + brand red accent)
const DEFAULT_THEME: ThemeName = "graphite";
const DEFAULT_ACCENT: AccentName = "jobsiteAmber"; // now maps to #FF0800

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);

  const [themeName, setThemeNameState] = useState<ThemeName>(DEFAULT_THEME);
  const [accentName, setAccentNameState] = useState<AccentName>(DEFAULT_ACCENT);

  // Load saved preferences once at app start
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const [savedTheme, savedAccent] = await Promise.all([
          AsyncStorage.getItem(THEME_STORAGE_KEY),
          AsyncStorage.getItem(ACCENT_STORAGE_KEY),
        ]);

        if (!alive) return;

        if (savedTheme) {
          const t = savedTheme as ThemeName;
          if (t in themes) setThemeNameState(t);
        }

        if (savedAccent) {
          const a = savedAccent as AccentName;
          if (a === "jobsiteAmber" || a === "electricBlue" || a === "safetyGreen") {
            setAccentNameState(a);
          }
        }
      } catch {
        // ignore; fall back to defaults
      } finally {
        if (!alive) return;
        setIsReady(true);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const setThemeName = useCallback((name: ThemeName) => {
    setThemeNameState(name);
    AsyncStorage.setItem(THEME_STORAGE_KEY, name).catch(() => {});
  }, []);

  const setAccentName = useCallback((name: AccentName) => {
    setAccentNameState(name);
    AsyncStorage.setItem(ACCENT_STORAGE_KEY, name).catch(() => {});
  }, []);

  const theme = useMemo(() => themes[themeName] ?? themes.graphite, [themeName]);
  const accentColor = useMemo(() => getAccentColor(accentName), [accentName]);

  const value = useMemo(
    () => ({
      isReady,
      themeName,
      theme,
      accentName,
      accentColor,
      setThemeName,
      setAccentName,
    }),
    [isReady, themeName, theme, accentName, accentColor, setThemeName, setAccentName]
  );

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error("usePreferences must be used inside PreferencesProvider");
  return ctx;
}
