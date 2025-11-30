// components/BottomNavBar.tsx
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type TabKey = "home" | "add" | "trash" | "settings";

type Props = {
  active: TabKey;
  // theme is "any" to avoid TypeScript complaining – we'll just pass the same theme object we use in screens
  theme: any;
};

type TabConfig = {
  key: TabKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route?: "/add-job" | "/trash" | "/settings";
};

export default function BottomNavBar({ active, theme }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const tabs: TabConfig[] = [
    { key: "home", label: "Home", icon: "home-outline" },
    { key: "add", label: "Add", icon: "add-circle-outline", route: "/add-job" },
    { key: "trash", label: "Trash", icon: "trash-outline", route: "/trash" },
    {
      key: "settings",
      label: "Settings",
      icon: "settings-outline",
      route: "/settings",
    },
  ];

  return (
    <View
      style={[
        styles.navContainer,
        {
          backgroundColor: theme.cardBackground,
          borderTopColor: theme.cardBorder,
          paddingBottom: insets.bottom + 6, // 👈 sits above iPhone home bar
        },
      ]}
    >
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <TouchableOpacity
            key={tab.key}
            style={styles.navItem}
            activeOpacity={0.85}
            onPress={() => {
              if (tab.key === "home") {
                router.push("/");
              } else if (tab.route) {
                router.push(tab.route);
              }
            }}
          >
            <Ionicons
              name={tab.icon}
              size={tab.key === "add" ? 24 : 20}
              color={
                isActive
                  ? theme.primaryButtonBackground
                  : theme.textMuted
              }
            />
            <Text
              style={[
                styles.navLabel,
                {
                  color: isActive
                    ? theme.primaryButtonBackground
                    : theme.textMuted,
                  fontWeight: isActive ? "700" : "500",
                },
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  navContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 10, // base; overridden by safe area padding in component
    borderTopWidth: 1,
  },
  navItem: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  navLabel: {
    fontSize: 11,
    marginTop: 2,
  },
});
