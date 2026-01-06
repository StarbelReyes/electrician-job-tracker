// app/_layout.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFonts } from "expo-font";
import { Slot, usePathname, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useMemo, useState } from "react";
import { AppState, AppStateStatus, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import BottomNavBar from "../components/BottomNavBar";
import { JobsProvider } from "../context/JobsContext";
import { PreferencesProvider, usePreferences } from "../context/PreferencesContext";
import { firebaseAuth } from "../firebaseConfig";

const USER_STORAGE_KEY = "EJT_USER_SESSION";

type Role = "owner" | "employee" | "independent";

type Session = {
  uid?: string;
  email?: string | null;
  name?: string;
  role?: Role;
  companyId?: string | null;
};

type TabKey = "home" | "add" | "trash" | "settings";

function RootShell() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { theme } = usePreferences();

  const [session, setSession] = useState<Session | null>(null);
  const role: Role = (session?.role ?? "independent") as Role;

  /**
   * ✅ Never mount BottomNavBar on auth / index / join flows
   * (avoids any touch interception issues on those screens)
   */
  const isAuthOrIndexRoute = useMemo(() => {
    const p = pathname ?? "";

    const BLOCKED = [
      "/",
      "/login",
      "/signup",
      "/forgot-password",
      "/join-company",
    ];

    if (BLOCKED.includes(p)) return true;

    if (p.endsWith("/login")) return true;
    if (p.endsWith("/signup")) return true;
    if (p.endsWith("/forgot-password")) return true;
    if (p.endsWith("/join-company")) return true;

    if (p.startsWith("/login/")) return true;
    if (p.startsWith("/signup/")) return true;
    if (p.startsWith("/forgot-password/")) return true;
    if (p.startsWith("/join-company/")) return true;

    return false;
  }, [pathname]);

  /**
   * ✅ Read session whenever:
   * - app resumes
   * - route changes (keeps nav role accurate if user just updated profile/session)
   */
  useEffect(() => {
    let mounted = true;

    const loadSession = async () => {
      try {
        const stored = await AsyncStorage.getItem(USER_STORAGE_KEY);
        if (!mounted) return;

        if (!stored) {
          setSession(null);
          return;
        }

        try {
          const parsed = JSON.parse(stored) as Session;
          setSession(parsed);
        } catch {
          setSession(null);
        }
      } catch (err) {
        console.warn("[LAYOUT] loadSession error:", err);
        setSession(null);
      }
    };

    loadSession();

    const onChange = (state: AppStateStatus) => {
      if (state === "active") loadSession();
    };

    const sub = AppState.addEventListener("change", onChange);

    return () => {
      mounted = false;
      sub.remove();
    };
  }, [pathname]);

  /**
   * ✅ Employee should NEVER access /add-job
   * If they somehow navigate there, kick them to /home
   */
  useEffect(() => {
    if (!pathname) return;
    if (role !== "employee") return;

    if (pathname === "/add-job" || pathname.startsWith("/add-job/")) {
      router.replace("/home" as any);
    }
  }, [pathname, role, router]);

  const activeTab = useMemo<TabKey | null>(() => {
    if (pathname === "/home") return "home";
    if (pathname === "/add-job") return "add";
    if (pathname === "/trash") return "trash";
    if (pathname === "/settings") return "settings";
    return null;
  }, [pathname]);

  /**
   * ✅ Hide Add tab for employees (nav visibility rule)
   * NOTE: actual tab removal is done inside BottomNavBar too.
   */
  const isTabAllowedForRole = useMemo(() => {
    if (!activeTab) return false;
    if (isAuthOrIndexRoute) return false;

    if (role === "employee") {
      return activeTab !== "add";
    }
    return true; // owner + independent keep all tabs
  }, [activeTab, isAuthOrIndexRoute, role]);

  const showBottomNav = !!activeTab && isTabAllowedForRole;

  const TAB_BAR_HEIGHT = 56;
  const tabBarTotalHeight = showBottomNav ? TAB_BAR_HEIGHT + insets.bottom : 0;

  /**
   * ✅ Employee lock gate:
   * Only enforce join-company if:
   * - Firebase auth has a real logged-in user
   * - AND user is employee with no companyId
   * - AND we are NOT on auth/index routes (avoid redirect loops)
   */
  useEffect(() => {
    let mounted = true;

    const runGate = async () => {
      try {
        const p = pathname ?? "";

        // Never force-redirect while on auth/index routes
        if (
          p === "/" ||
          p.endsWith("/login") ||
          p.endsWith("/signup") ||
          p.endsWith("/forgot-password")
        ) {
          return;
        }

        // ✅ MUST have a real Firebase user before enforcing join-company
        const authed = firebaseAuth.currentUser;
        if (!authed) return;

        const stored = await AsyncStorage.getItem(USER_STORAGE_KEY);
        if (!mounted || !stored) return;

        let s: Session | null = null;
        try {
          s = JSON.parse(stored);
        } catch {
          s = null;
        }
        if (!s) return;

        const r = s.role;
        const companyId = s.companyId ?? null;

        const mustJoin = r === "employee" && !companyId;

        if (mustJoin && p !== "/join-company") {
          router.replace("/join-company" as any);
        }
      } catch (err) {
        console.warn("[LAYOUT] resume gate error:", err);
      }
    };

    runGate();

    const onChange = (state: AppStateStatus) => {
      if (state === "active") runGate();
    };

    const sub = AppState.addEventListener("change", onChange);

    return () => {
      mounted = false;
      sub.remove();
    };
  }, [router, pathname]);

  return (
    <View style={[styles.shell, { backgroundColor: theme.screenBackground }]}>
      <View style={{ flex: 1, paddingBottom: tabBarTotalHeight }}>
        <Slot />
      </View>

      {showBottomNav ? (
        <BottomNavBar active={activeTab as TabKey} role={role} />
      ) : null}
    </View>
  );
}

function ThemedStatusBar() {
  const { theme, themeName } = usePreferences();
  const barStyle = themeName === "light" ? "dark" : "light";

  return <StatusBar style={barStyle} backgroundColor={theme.screenBackground} />;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    "Athiti-Regular": require("../assets/fonts/Athiti-Regular.ttf"),
    "Athiti-Medium": require("../assets/fonts/Athiti-Medium.ttf"),
    "Athiti-SemiBold": require("../assets/fonts/Athiti-SemiBold.ttf"),
    "Athiti-Bold": require("../assets/fonts/Athiti-Bold.ttf"),
  });

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PreferencesProvider>
          <JobsProvider>
            <ThemedStatusBar />
            <RootShell />
          </JobsProvider>
        </PreferencesProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
});
