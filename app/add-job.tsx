import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import { useJobs } from "../context/JobsContext";

export default function AddJobScreen() {
  const router = useRouter();
  const { addJob } = useJobs();

  const [customerName, setCustomerName] = useState("");
  const [jobAddress, setJobAddress] = useState("");
  const [jobDescription, setJobDescription] = useState("");

  const handleSave = async () => {
    if (!customerName.trim() && !jobAddress.trim()) {
      return;
    }

    await addJob({
      customerName: customerName.trim(),
      jobAddress: jobAddress.trim(),
      jobDescription: jobDescription.trim(),
    });

    router.back(); // back to Home
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.title}>Add New Job</Text>

          <TextInput
            style={styles.input}
            placeholder="Customer Name"
            placeholderTextColor="#999"
            value={customerName}
            onChangeText={setCustomerName}
          />

          <TextInput
            style={styles.input}
            placeholder="Job Address"
            placeholderTextColor="#999"
            value={jobAddress}
            onChangeText={setJobAddress}
          />

          <TextInput
            style={[styles.input, { height: 120 }]}
            placeholder="Job Description"
            placeholderTextColor="#999"
            value={jobDescription}
            onChangeText={setJobDescription}
            multiline
          />

          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveText}>Save Job</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => router.back()}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#0f0f0f",
    paddingTop: 80,
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  title: {
    color: "white",
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 40,
  },
  input: {
    backgroundColor: "#1a1a1a",
    color: "white",
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    marginBottom: 20,
  },
  saveButton: {
    backgroundColor: "#1e90ff",
    padding: 18,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
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
