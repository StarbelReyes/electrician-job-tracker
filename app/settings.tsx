// app/settings.tsx
import { router } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

const SettingsScreen = () => {
  return (
    <View style={styles.container}>
      {/* Simple header */}
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.8}
        >
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 60 }} /> 
      </View>

      <View style={styles.content}>
        <Text style={styles.sectionTitle}>App Settings</Text>
        <Text style={styles.infoText}>
          Later we can add:
          {"\n"}• Default hourly rate
          {"\n"}• Your name / company
          {"\n"}• Theme / colors
          {"\n"}• Data backup / export
        </Text>

        <Text style={styles.infoText}>
          For now this screen just proves navigation works between Home and
          Settings using expo-router. 🚀
        </Text>

        {/* 🔹 New: App Info button */}
        <TouchableOpacity
  style={styles.infoButton}
  onPress={() => router.push("/app-info")}   // 👈 EXACTLY this
  activeOpacity={0.9}
>
  <Text style={styles.infoButtonText}>About this app</Text>
  <Text style={styles.infoButtonSubtext}>
    See version, purpose, and future plans.
  </Text>
</TouchableOpacity>
      </View>

    </View>
  );
};

export default SettingsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#020617",
    paddingTop: 56,
    paddingHorizontal: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  backText: {
    color: "#9CA3AF",
    fontSize: 14,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#F9FAFB",
    textAlign: "center",
  },
  content: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#E5E7EB",
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: "#9CA3AF",
    marginBottom: 8,
  },

  // 🔹 New styles for "About this app" button
  infoButton: {
    marginTop: 16,
    backgroundColor: "#111827",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#374151",
  },
  infoButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#F9FAFB",
    marginBottom: 4,
  },
  infoButtonSubtext: {
    fontSize: 12,
    color: "#9CA3AF",
  },

});
