// components/BottomNavBar.tsx
import { Ionicons } from "@expo/vector-icons";
import { Href, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePreferences } from "../context/PreferencesContext";

type TabKey = "home" | "add" | "trash" | "settings";

export type BottomNavBarProps = {
  active: TabKey;
};

const ORDER: TabKey[] = ["home", "add", "trash", "settings"] as const;

const ROUTES = {
  home: "/home",
  add: "/add-job",
  trash: "/trash",
  settings: "/settings",
} as const satisfies Record<TabKey, Href>;

const ICONS: Record<TabKey, keyof typeof Ionicons.glyphMap> = {
  home: "home-outline",
  add: "add-circle-outline",
  trash: "trash-outline",
  settings: "settings-outline",
};

const LABELS: Record<TabKey, string> = {
  home: "Home",
  add: "Add",
  trash: "Trash",
  settings: "Settings",
};

type Layout = { x: number; width: number };

const TAB_BAR_HEIGHT = 56;

export default function BottomNavBar({ active }: BottomNavBarProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme, accentColor } = usePreferences();

  // ✅ Brand should come from accent system (your #FF0800)
  const brand = accentColor;

  const layoutsRef = useRef<Record<TabKey, Layout | null>>({
    home: null,
    add: null,
    trash: null,
    settings: null,
  });

  const [isReady, setIsReady] = useState(false);

  const pillX = useRef(new Animated.Value(0)).current;
  const pillW = useRef(new Animated.Value(56)).current;
  const pillOpacity = useRef(new Animated.Value(0)).current;

  const computeTarget = useCallback((tab: TabKey) => {
    const l = layoutsRef.current[tab];
    if (!l) return null;

    const targetW = Math.max(56, Math.min(l.width, 92));
    const centerX = l.x + l.width / 2;
    const targetX = centerX - targetW / 2;

    return { x: targetX, w: targetW };
  }, []);

  const setToActiveInstant = useCallback(() => {
    const t = computeTarget(active);
    if (!t) return;
    pillX.setValue(t.x);
    pillW.setValue(t.w);
    pillOpacity.setValue(1);
  }, [active, computeTarget, pillOpacity, pillW, pillX]);

  const animateToActive = useCallback(() => {
    const t = computeTarget(active);
    if (!t) return;

    Animated.parallel([
      Animated.timing(pillX, {
        toValue: t.x,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(pillW, {
        toValue: t.w,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(pillOpacity, {
        toValue: 1,
        duration: 120,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start();
  }, [active, computeTarget, pillOpacity, pillW, pillX]);

  const onTabLayout = (key: TabKey) => (e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    layoutsRef.current[key] = { x, width };

    const allMeasured = ORDER.every((k) => layoutsRef.current[k] != null);
    if (allMeasured && !isReady) {
      setIsReady(true);
      requestAnimationFrame(setToActiveInstant);
    }
  };

  useEffect(() => {
    if (!isReady) return;
    animateToActive();
  }, [active, isReady, animateToActive]);

  const handlePress = (tab: TabKey) => {
    if (tab === active) return;
    router.replace(ROUTES[tab]);
  };

  const tintFor = useCallback(
    (isActive: boolean) => (isActive ? brand : theme.textMuted),
    [brand, theme.textMuted]
  );

  const totalHeight = TAB_BAR_HEIGHT + insets.bottom;

  return (
    <View
      style={[
        styles.wrap,
        {
          height: totalHeight,
          paddingBottom: insets.bottom,
          backgroundColor: theme.cardBackground,
          borderTopColor: theme.cardBorder,
        },
      ]}
    >
      <View style={styles.inner}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.pill,
            {
              opacity: pillOpacity,
              transform: [{ translateX: pillX }],
              width: pillW,
              borderColor: brand,
              backgroundColor: brand + "14",
            },
          ]}
        />

        {ORDER.map((tab) => {
          const isTabActive = tab === active;
          const tint = tintFor(isTabActive);

          return (
            <Pressable
              key={tab}
              onPress={() => handlePress(tab)}
              onLayout={onTabLayout(tab)}
              style={styles.item}
              hitSlop={10}
            >
              <Ionicons name={ICONS[tab]} size={22} color={tint} />
              <Text style={[styles.label, { color: tint }]}>{LABELS[tab]}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
  },
  inner: {
    height: TAB_BAR_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  item: {
    flex: 1,
    height: TAB_BAR_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  label: {
    fontSize: 11,
    fontFamily: "Athiti-SemiBold",
  },
  pill: {
    position: "absolute",
    left: 0,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    top: (TAB_BAR_HEIGHT - 40) / 2,
  },
});
