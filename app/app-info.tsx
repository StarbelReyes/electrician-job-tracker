// app/app-info.tsx
import { router } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

const AppInfoScreen = () => {
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.8}
        >
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>About This App</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.content}>
        <Text style={styles.sectionTitle}>Electrician Job Tracker</Text>
        <Text style={styles.infoText}>
          Version: 0.1.0 (Day 11 build)
        </Text>

        <Text style={styles.infoText}>
          This app is designed for working electricians to:
          {"\n"}• Track jobs, clients, and addresses
          {"\n"}• Attach photos from site work
          {"\n"}• Add pricing (labor + materials)
          {"\n"}• Keep a simple job history
        </Text>

        <Text style={styles.infoText}>
          Future ideas:
          {"\n"}• Sync across devices
          {"\n"}• Export to PDF or email
          {"\n"}• Cloud backup
          {"\n"}• Better reports / analytics
        </Text>
      </View>
    </View>
  );
};

export default AppInfoScreen;

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
});
