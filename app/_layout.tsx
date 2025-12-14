// app/_layout.tsx
import { Slot, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import BottomNavBar from "../components/BottomNavBar";
import { JobsProvider } from "../context/JobsContext";
import {
  PreferencesProvider,
  usePreferences,
} from "../context/PreferencesContext";

type TabKey = "home" | "add" | "trash" | "settings";

function RootShell() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { theme } = usePreferences();

  const activeTab = useMemo<TabKey | null>(() => {
    // ✅ Your Home is /home (not /)
    if (pathname === "/home" || pathname === "/") return "home";
    if (pathname === "/add-job") return "add";
    if (pathname === "/trash") return "trash";
    if (pathname === "/settings") return "settings";
    return null;
  }, [pathname]);

  const TAB_BAR_HEIGHT = 56;
  const tabBarTotalHeight = activeTab ? TAB_BAR_HEIGHT + insets.bottom : 0;

  return (
    <View style={[styles.shell, { backgroundColor: theme.screenBackground }]}>
      {/* Give content space so it NEVER sits under the pinned nav */}
      <View style={{ flex: 1, paddingBottom: tabBarTotalHeight }}>
        <Slot />
      </View>

      {activeTab && <BottomNavBar active={activeTab} />}
    </View>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PreferencesProvider>
          <JobsProvider>
            <StatusBar style="light" backgroundColor="#020617" />
            <RootShell />
          </JobsProvider>
        </PreferencesProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
  },
});
