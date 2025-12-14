// context/PreferencesContext.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
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
  theme: (typeof themes)["dark"];
  accentName: AccentName;
  accentColor: string;

  setThemeName: (name: ThemeName) => void;
  setAccentName: (name: AccentName) => void;
};

const PreferencesContext = createContext<Prefs | null>(null);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);

  const [themeName, setThemeNameState] = useState<ThemeName>("dark");
  const [accentName, setAccentNameState] = useState<AccentName>("jobsiteAmber");

  // Load once at app start (prevents “accent swap flash” on every screen)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [savedTheme, savedAccent] = await Promise.all([
          AsyncStorage.getItem(THEME_STORAGE_KEY),
          AsyncStorage.getItem(ACCENT_STORAGE_KEY),
        ]);

        if (!alive) return;

        if (savedTheme === "light" || savedTheme === "dark" || savedTheme === "midnight") {
          setThemeNameState(savedTheme as ThemeName);
        }

        if (
          savedAccent === "jobsiteAmber" ||
          savedAccent === "electricBlue" ||
          savedAccent === "safetyGreen"
        ) {
          setAccentNameState(savedAccent as AccentName);
        }
      } catch {
        // keep defaults
      } finally {
        if (alive) setIsReady(true);
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

  const theme = useMemo(() => themes[themeName] ?? themes.dark, [themeName]);
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

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error("usePreferences must be used inside PreferencesProvider");
  return ctx;
}
