import { useRouter } from "expo-router";
import { useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useJobs } from "../context/JobsContext";

export default function HomeScreen() {
  const router = useRouter();
  const { jobs } = useJobs();
  const [search, setSearch] = useState("");

  const filteredJobs = jobs.filter((job) => {
    const needle = search.toLowerCase();
    if (!needle) return true;

    return (
      (job.customerName || "").toLowerCase().includes(needle) ||
      (job.jobAddress || "").toLowerCase().includes(needle) ||
      (job.jobDescription || "").toLowerCase().includes(needle)
    );
  });

  const renderJob = ({ item }) => (
    <TouchableOpacity
      style={styles.jobCard}
      onPress={() =>
        router.push({
          pathname: "/job-detail",
          params: { id: item.id },
        })
      }
    >
      <Text style={styles.jobName}>{item.customerName}</Text>
      <Text style={styles.jobAddress}>{item.jobAddress}</Text>
      {item.jobDescription ? (
        <Text style={styles.jobDescription} numberOfLines={2}>
          {item.jobDescription}
        </Text>
      ) : null}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Electrician Job Tracker</Text>

      <TextInput
        style={styles.searchBar}
        placeholder="Search jobs..."
        placeholderTextColor="#777"
        value={search}
        onChangeText={setSearch}
      />

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => router.push("/add-job")}
      >
        <Text style={styles.addButtonText}>Add New Job</Text>
      </TouchableOpacity>

      {filteredJobs.length === 0 ? (
        <Text style={styles.emptyText}>
          {jobs.length === 0 ? "No jobs yet..." : "No jobs found..."}
        </Text>
      ) : (
        <FlatList
          style={{ marginTop: 20 }}
          data={filteredJobs}
          keyExtractor={(item) => item.id}
          renderItem={renderJob}
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f0f0f",
    paddingTop: 80,
    paddingHorizontal: 20,
  },
  title: {
    color: "white",
    fontSize: 30,
    fontWeight: "bold",
    marginBottom: 20,
  },
  searchBar: {
    backgroundColor: "#1a1a1a",
    color: "white",
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    fontSize: 16,
  },
  addButton: {
    backgroundColor: "#1e90ff",
    padding: 20,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 20,
  },
  addButtonText: {
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
  },
  emptyText: {
    color: "gray",
    fontSize: 16,
    marginTop: 20,
  },
  jobCard: {
    backgroundColor: "#1a1a1a",
    padding: 16,
    borderRadius: 10,
    marginBottom: 12,
  },
  jobName: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  jobAddress: {
    color: "#aaa",
    marginTop: 4,
  },
  jobDescription: {
    color: "#ccc",
    marginTop: 6,
    fontSize: 14,
  },
});
