// app/work-ticket-create.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
    addDoc,
    collection,
    doc,
    getDoc,
    serverTimestamp,
} from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import {
    Alert,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from "react-native";
import { usePreferences } from "../context/PreferencesContext";
import { db } from "../firebaseConfig";

const USER_STORAGE_KEY = "EJT_USER_SESSION";

type Role = "owner" | "employee" | "independent";
type Session = {
  uid?: string;
  email?: string | null;
  name?: string;
  role?: Role;
  companyId?: string | null;
};

type Job = {
  id: string;
  title: string;
  address: string;
  description: string;
  assignedToUid?: string | null;
};

export default function WorkTicketCreateScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ jobId?: string }>();
  const jobId = params?.jobId ? String(params.jobId) : "";

  const { isReady, theme, accentColor } = usePreferences();

  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);

  const isEmployee = session?.role === "employee";
  const companyId = session?.companyId ?? null;

  const [loadingJob, setLoadingJob] = useState(true);
  const [job, setJob] = useState<Job | null>(null);

  const [workPerformed, setWorkPerformed] = useState("");
  const [laborHours, setLaborHours] = useState("");
  const [materialsUsed, setMaterialsUsed] = useState("");

  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  const safeBack = () => {
    try {
      // @ts-ignore
      if (router?.canGoBack?.()) return router.back();
    } catch {}
    router.replace("/home" as any);
  };

  useEffect(() => {
    const loadSession = async () => {
      try {
        const stored = await AsyncStorage.getItem(USER_STORAGE_KEY);
        if (!stored) {
          setSession(null);
          setSessionLoaded(true);
          return;
        }
        try {
          setSession(JSON.parse(stored));
        } catch {
          setSession(null);
        } finally {
          setSessionLoaded(true);
        }
      } catch {
        setSession(null);
        setSessionLoaded(true);
      }
    };
    loadSession();
  }, []);

  useEffect(() => {
    if (!sessionLoaded) return;

    const loadJob = async () => {
      try {
        setLoadingJob(true);

        if (!jobId) {
          setJob(null);
          return;
        }

        if (!companyId) {
          setJob(null);
          return;
        }

        const jobRef = doc(db, "companies", companyId, "jobs", jobId);
        const snap = await getDoc(jobRef);

        if (!snap.exists()) {
          setJob(null);
          return;
        }

        const data: any = snap.data() ?? {};
        const found: Job = {
          id: snap.id,
          title: String(data.title ?? ""),
          address: String(data.address ?? ""),
          description: String(data.description ?? ""),
          assignedToUid:
            data.assignedToUid === null || data.assignedToUid === undefined
              ? null
              : String(data.assignedToUid),
        };

        setJob(found);
      } catch (e) {
        console.warn("Failed to load job:", e);
        setJob(null);
      } finally {
        setLoadingJob(false);
      }
    };

    loadJob();
  }, [sessionLoaded, companyId, jobId]);

  const canSubmit = useMemo(() => {
    if (!isEmployee) return false;
    if (!companyId) return false;
    if (!job) return false;
    if (!workPerformed.trim()) return false;
    return true;
  }, [isEmployee, companyId, job, workPerformed]);

  const parseNumber = (v: string) => {
    const n = Number(String(v).replace(/[^0-9.]/g, ""));
    return Number.isNaN(n) ? 0 : n;
  };

  const submitTicket = async () => {
    dismissKeyboard();

    if (!isEmployee) {
      Alert.alert("Not allowed", "Only employees can create work tickets.");
      return;
    }
    if (!companyId) {
      Alert.alert(
        "Missing company",
        "Your session has no companyId. The employee must join a company first."
      );
      return;
    }
    if (!job) {
      Alert.alert("Job not found", "This job could not be loaded.");
      return;
    }

    try {
      const ticketsCol = collection(
        db,
        "companies",
        companyId,
        "jobs",
        job.id,
        "workTickets"
      );

      const payload = {
        jobId: job.id,
        jobTitle: job.title,
        jobAddress: job.address,

        // ticket content
        workPerformed: workPerformed.trim(),
        laborHours: parseNumber(laborHours),
        materialsUsed: materialsUsed.trim(),

        // created by
        createdByUid: session?.uid ?? null,
        createdByName: session?.name ?? null,
        createdByEmail: session?.email ?? null,
        createdByRole: session?.role ?? null,

        createdAt: serverTimestamp(),

        // immutable flag
        isFinal: true,
      };

      await addDoc(ticketsCol, payload);

      Alert.alert("Submitted", "Work ticket submitted. It cannot be edited.", [
        { text: "OK", onPress: safeBack },
      ]);
    } catch (e) {
      console.warn("Submit ticket failed:", e);
      Alert.alert("Error", "Could not submit work ticket. Try again.");
    }
  };

  if (!isReady) {
    return <View style={{ flex: 1, backgroundColor: "#0b0f1a" }} />;
  }

  if (sessionLoaded && !isEmployee) {
    return (
      <View style={[styles.center, { backgroundColor: theme.screenBackground }]}>
        <Text style={[styles.title, { color: theme.textPrimary }]}>Not allowed</Text>
        <Text style={[styles.sub, { color: theme.textMuted }]}>
          This screen is for employees only.
        </Text>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: accentColor }]}
          onPress={safeBack}
        >
          <Text style={styles.btnText}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loadingJob) {
    return (
      <View style={[styles.center, { backgroundColor: theme.screenBackground }]}>
        <Text style={[styles.sub, { color: theme.textPrimary }]}>Loading job…</Text>
      </View>
    );
  }

  if (!job) {
    const reason =
      !jobId
        ? "Missing jobId param."
        : !companyId
        ? "Missing companyId in session (employee must join a company)."
        : "Job document not found in Firestore.";

    return (
      <View style={[styles.center, { backgroundColor: theme.screenBackground }]}>
        <Text style={[styles.title, { color: theme.textPrimary }]}>Job not found</Text>
        <Text style={[styles.sub, { color: theme.textMuted }]}>{reason}</Text>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: accentColor }]}
          onPress={safeBack}
        >
          <Text style={styles.btnText}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.screenBackground }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <TouchableWithoutFeedback onPress={dismissKeyboard} accessible={false}>
        <View style={{ flex: 1 }}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[styles.wrap, { paddingBottom: 28 }]}
            keyboardShouldPersistTaps="handled"
          >
            <View
              style={[
                styles.card,
                { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
              ]}
            >
              <Text style={[styles.header, { color: theme.textPrimary }]}>
                Create Work Ticket
              </Text>

              <Text style={[styles.meta, { color: theme.textMuted }]}>Job</Text>
              <Text style={[styles.jobTitle, { color: theme.textPrimary }]} numberOfLines={1}>
                {job.title}
              </Text>
              <Text style={[styles.jobAddress, { color: theme.textSecondary }]} numberOfLines={2}>
                {job.address}
              </Text>

              <View style={styles.sep} />

              <Text style={[styles.label, { color: theme.textSecondary }]}>Work performed *</Text>
              <TextInput
                style={[
                  styles.inputMulti,
                  {
                    backgroundColor: theme.inputBackground,
                    borderColor: theme.inputBorder,
                    color: theme.inputText,
                  },
                ]}
                value={workPerformed}
                onChangeText={setWorkPerformed}
                placeholder="Describe what you did today…"
                placeholderTextColor={theme.textMuted}
                multiline
              />

              <Text style={[styles.label, { color: theme.textSecondary }]}>Labor hours</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.inputBackground,
                    borderColor: theme.inputBorder,
                    color: theme.inputText,
                  },
                ]}
                value={laborHours}
                onChangeText={setLaborHours}
                placeholder="e.g. 4"
                placeholderTextColor={theme.textMuted}
                keyboardType="numeric"
              />

              <Text style={[styles.label, { color: theme.textSecondary }]}>
                Supplies / Resources
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.inputBackground,
                    borderColor: theme.inputBorder,
                    color: theme.inputText,
                  },
                ]}
                value={materialsUsed}
                onChangeText={setMaterialsUsed}
                placeholder="e.g. 3/4 EMT, straps, connectors…"
                placeholderTextColor={theme.textMuted}
              />

              <Text style={[styles.hint, { color: theme.textMuted }]}>
                Submitting is final. Work tickets are immutable after submit.
              </Text>

              <TouchableOpacity
                style={[
                  styles.submit,
                  { backgroundColor: accentColor, opacity: canSubmit ? 1 : 0.55 },
                ]}
                disabled={!canSubmit}
                onPress={submitTicket}
                activeOpacity={0.9}
              >
                <Text style={styles.submitText}>Submit Work Ticket</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.cancel} onPress={safeBack} activeOpacity={0.8}>
                <Text style={[styles.cancelText, { color: theme.textMuted }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 18 },
  wrap: {
    paddingHorizontal: 16,
    paddingVertical: 32,
    flexGrow: 1,
    justifyContent: "center",
  },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    maxWidth: 520,
    alignSelf: "center",
  },
  header: { fontSize: 20, fontWeight: "700", marginBottom: 12 },
  meta: { fontSize: 12, marginBottom: 4 },
  jobTitle: { fontSize: 16, fontWeight: "700" },
  jobAddress: { fontSize: 13, marginTop: 2 },
  sep: { height: 1, marginVertical: 14, backgroundColor: "rgba(148,163,184,0.25)" },
  label: { fontSize: 13, marginTop: 12, marginBottom: 6, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  inputMulti: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 110,
    textAlignVertical: "top",
  },
  hint: { fontSize: 12, marginTop: 12, lineHeight: 16 },
  submit: { marginTop: 14, borderRadius: 14, paddingVertical: 12, alignItems: "center" },
  submitText: { color: "#F9FAFB", fontWeight: "800", fontSize: 14 },
  cancel: { marginTop: 10, alignItems: "center", paddingVertical: 8 },
  cancelText: { fontSize: 13 },
  title: { fontSize: 20, fontWeight: "800", marginBottom: 6 },
  sub: { fontSize: 13, textAlign: "center", lineHeight: 18, marginBottom: 14 },
  btn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  btnText: { color: "#F9FAFB", fontWeight: "800" },
});
