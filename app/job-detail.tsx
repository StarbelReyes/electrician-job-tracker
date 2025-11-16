// app/job-detail.tsx
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useJobs } from "../context/JobsContext";

export default function JobDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { jobs, deleteJob, toggleJobStatus } = useJobs();

  const job = jobs.find((j) => j.id === id);

  if (!job) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Job not found</Text>
        <TouchableOpacity style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonText}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleDelete = () => {
    Alert.alert("Delete Job", "Are you sure you want to delete this job?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteJob(job.id);
          router.back();
        },
      },
    ]);
  };

  const handleToggleStatus = async () => {
    await toggleJobStatus(job.id);
  };

  const createdDate = new Date(job.createdAt).toLocaleString();

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backLink}>
        <Text style={styles.backLinkText}>← Back to Jobs</Text>
      </TouchableOpacity>

      <Text style={styles.title}>{job.customerName}</Text>

      <Text style={styles.label}>Status:</Text>
      <Text
        style={[
          styles.value,
          job.status === "completed" && { color: "#4ade80" },
        ]}
      >
        {job.status === "completed" ? "Completed" : "Active"}
      </Text>

      <Text style={styles.label}>Address:</Text>
      <Text style={styles.value}>{job.jobAddress}</Text>

      <Text style={styles.label}>Description:</Text>
      <Text style={styles.value}>
        {job.jobDescription || "No description added."}
      </Text>

      <Text style={styles.label}>Created:</Text>
      <Text style={styles.value}>{createdDate}</Text>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() =>
            router.push({
              pathname: "/edit-job",
              params: { id: job.id },
            })
          }
        >
          <Text style={styles.editText}>Edit Job</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.statusButton} onPress={handleToggleStatus}>
          <Text style={styles.statusText}>
            {job.status === "completed" ? "Mark Active" : "Mark Completed"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <Text style={styles.deleteText}>Delete Job</Text>
        </TouchableOpacity>
      </View>
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
  backLink: {
    marginBottom: 10,
  },
  backLinkText: {
    color: "#60a5fa",
    fontSize: 16,
    fontWeight: "600",
  },
  title: {
    color: "white",
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
  label: {
    color: "#9ca3af",
    fontSize: 14,
    marginTop: 10,
  },
  value: {
    color: "white",
    fontSize: 16,
    marginTop: 4,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 40,
  },
  editButton: {
    padding: 14,
    borderRadius: 8,
    backgroundColor: "#1e90ff",
    flex: 1,
    marginRight: 6,
    alignItems: "center",
  },
  editText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  statusButton: {
    padding: 14,
    borderRadius: 8,
    backgroundColor: "#22c55e",
    flex: 1,
    marginHorizontal: 6,
    alignItems: "center",
  },
  statusText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  deleteButton: {
    padding: 14,
    borderRadius: 8,
    backgroundColor: "#b91c1c",
    flex: 1,
    marginLeft: 6,
    alignItems: "center",
  },
  deleteText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  button: {
    marginTop: 20,
    padding: 14,
    borderRadius: 8,
    backgroundColor: "#1e90ff",
    alignItems: "center",
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
});
