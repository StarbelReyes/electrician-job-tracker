import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { useJobs } from "../context/JobsContext";

export default function EditJobScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const id = params.id;
  const { jobs, editJob } = useJobs();

  const job = jobs.find((j) => j.id === id);

  const [customerName, setCustomerName] = useState(
    job?.customerName || ""
  );
  const [jobAddress, setJobAddress] = useState(job?.jobAddress || "");
  const [jobDescription, setJobDescription] = useState(
    job?.jobDescription || ""
  );

  const handleSave = async () => {
    if (!job) return;

    await editJob(job.id, {
      customerName,
      jobAddress,
      jobDescription,
    });

    router.back(); // go back to job details
  };

  if (!job) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Job not found</Text>
        <TouchableOpacity
          style={styles.saveButton}
          onPress={() => router.back()}
        >
          <Text style={styles.saveText}>Back</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Edit Job</Text>

      <TextInput
        style={styles.input}
        value={customerName}
        onChangeText={setCustomerName}
        placeholder="Customer Name"
        placeholderTextColor="#999"
      />

      <TextInput
        style={styles.input}
        value={jobAddress}
        onChangeText={setJobAddress}
        placeholder="Job Address"
        placeholderTextColor="#999"
      />

      <TextInput
        style={[styles.input, { height: 100 }]}
        value={jobDescription}
        onChangeText={setJobDescription}
        placeholder="Job Description"
        placeholderTextColor="#999"
        multiline
      />

      <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveText}>Save Changes</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.cancelButton}
        onPress={() => router.back()}
      >
        <Text style={styles.cancelText}>Cancel</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 80,
    backgroundColor: "#0f0f0f",
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  title: {
    color: "white",
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 30,
  },
  input: {
    backgroundColor: "#1a1a1a",
    color: "white",
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  saveButton: {
    backgroundColor: "#1e90ff",
    padding: 18,
    borderRadius: 10,
    alignItems: "center",
  },
  saveText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  cancelButton: {
    marginTop: 20,
    alignItems: "center",
  },
  cancelText: {
    color: "gray",
    fontSize: 16,
  },
});
