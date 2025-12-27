import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
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

export default function WorkTicketDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ jobId?: string; ticketId?: string }>();
  const jobId = params?.jobId ? String(params.jobId) : "";
  const ticketId = params?.ticketId ? String(params.ticketId) : "";

  const { isReady, theme, accentColor } = usePreferences();

  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);

  const isOwner = session?.role === "owner";
  const companyId = session?.companyId ?? null;

  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);

  const safeBack = () => {
    try {
      // @ts-ignore
      if (router?.canGoBack?.()) return router.back();
    } catch {}
    router.replace("/work-tickets" as any);
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

  const load = async () => {
    if (!companyId || !jobId || !ticketId) return;
    setLoading(true);
    try {
      const ref = doc(db, "companies", companyId, "jobs", jobId, "workTickets", ticketId);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        setTicket(null);
        return;
      }
      setTicket({ id: snap.id, ...snap.data() });
    } catch (e) {
      console.warn("Load ticket failed:", e);
      setTicket(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!sessionLoaded) return;
    if (!isOwner) return;
    if (!companyId) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionLoaded, isOwner, companyId, jobId, ticketId]);

  const canMarkReviewed = useMemo(() => {
    if (!ticket) return false;
    if (ticket.isReviewed) return false;
    if (marking) return false;
    return true;
  }, [ticket, marking]);

  const markReviewed = async () => {
    if (!companyId || !jobId || !ticketId) return;
    if (!session?.uid) return;

    setMarking(true);
    try {
      const ref = doc(db, "companies", companyId, "jobs", jobId, "workTickets", ticketId);
      await updateDoc(ref, {
        isReviewed: true,
        reviewedAt: serverTimestamp(),
        reviewedByUid: session.uid,
      });

      Alert.alert("Reviewed", "Ticket marked as reviewed.");
      await load();
    } catch (e) {
      console.warn("Mark reviewed failed:", e);
      Alert.alert("Error", "Could not mark reviewed (check rules).");
    } finally {
      setMarking(false);
    }
  };

  if (!isReady) return <View style={{ flex: 1, backgroundColor: "#0b0f1a" }} />;

  if (sessionLoaded && !isOwner) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.screenBackground }}>
        <View style={[styles.center, { paddingTop: 12 }]}>
          <Text style={[styles.title, { color: theme.textPrimary }]}>Not allowed</Text>
          <Text style={[styles.sub, { color: theme.textMuted }]}>Owners only.</Text>
          <TouchableOpacity style={[styles.btn, { backgroundColor: accentColor }]} onPress={safeBack}>
            <Text style={styles.btnText}>Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!companyId || !jobId || !ticketId) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.screenBackground }}>
        <View style={[styles.center, { paddingTop: 12 }]}>
          <Text style={[styles.title, { color: theme.textPrimary }]}>Missing params</Text>
          <Text style={[styles.sub, { color: theme.textMuted }]}>
            companyId, jobId, or ticketId missing.
          </Text>
          <TouchableOpacity style={[styles.btn, { backgroundColor: accentColor }]} onPress={safeBack}>
            <Text style={styles.btnText}>Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.screenBackground }}>
        <View style={[styles.center, { paddingTop: 12 }]}>
          <Text style={[styles.sub, { color: theme.textPrimary }]}>Loading ticket…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!ticket) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.screenBackground }}>
        <View style={[styles.center, { paddingTop: 12 }]}>
          <Text style={[styles.title, { color: theme.textPrimary }]}>Not found</Text>
          <Text style={[styles.sub, { color: theme.textMuted }]}>Ticket doesn’t exist.</Text>
          <TouchableOpacity style={[styles.btn, { backgroundColor: accentColor }]} onPress={safeBack}>
            <Text style={styles.btnText}>Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.screenBackground }}>
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.screenBackground }}
        contentContainerStyle={{
          paddingTop: Math.max(10, insets.top * 0.25),
          paddingHorizontal: 16,
          paddingBottom: 28,
        }}
      >
        <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
          <Text style={[styles.h1, { color: theme.textPrimary }]}>
            {ticket.dayKey} • {ticket.createdByName || ticket.createdByEmail || "Employee"}
          </Text>

          <Text style={[styles.meta, { color: theme.textMuted }]}>Job: {ticket.jobTitle}</Text>
          <Text style={[styles.meta, { color: theme.textMuted }]}>Address: {ticket.jobAddress}</Text>

          <View style={styles.sep} />

          <Text style={[styles.label, { color: theme.textSecondary }]}>Work performed</Text>
          <Text style={[styles.body, { color: theme.textPrimary }]}>{ticket.workPerformed || "—"}</Text>

          <Text style={[styles.label, { color: theme.textSecondary, marginTop: 10 }]}>Labor hours</Text>
          <Text style={[styles.body, { color: theme.textPrimary }]}>{String(ticket.laborHours ?? 0)}</Text>

          <Text style={[styles.label, { color: theme.textSecondary, marginTop: 10 }]}>
            Supplies / Resources
          </Text>
          <Text style={[styles.body, { color: theme.textPrimary }]}>{ticket.materialsUsed || "—"}</Text>

          <View style={styles.sep} />

          <Text style={[styles.status, { color: ticket.isReviewed ? theme.textMuted : theme.textPrimary }]}>
            Status: {ticket.isReviewed ? "Reviewed" : "New"}
          </Text>

          <TouchableOpacity
            style={[styles.primary, { backgroundColor: accentColor, opacity: canMarkReviewed ? 1 : 0.55 }]}
            disabled={!canMarkReviewed}
            onPress={markReviewed}
            activeOpacity={0.9}
          >
            <Text style={styles.primaryText}>{marking ? "Marking…" : "Mark Reviewed"}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancel} onPress={safeBack} activeOpacity={0.85}>
            <Text style={[styles.cancelText, { color: theme.textMuted }]}>Back</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 18 },
  title: { fontSize: 20, fontWeight: "800", marginBottom: 6 },
  sub: { fontSize: 13, textAlign: "center", lineHeight: 18, marginBottom: 14 },
  btn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  btnText: { color: "#F9FAFB", fontWeight: "800" },

  card: { borderWidth: 1, borderRadius: 18, padding: 16 },
  h1: { fontSize: 16, fontWeight: "900" },
  meta: { fontSize: 12, marginTop: 6 },

  sep: { height: 1, marginVertical: 14, backgroundColor: "rgba(148,163,184,0.25)" },

  label: { fontSize: 13, fontWeight: "800", marginBottom: 6 },
  body: { fontSize: 13, lineHeight: 18 },

  status: { fontSize: 12, fontWeight: "900" },

  primary: { marginTop: 14, borderRadius: 14, paddingVertical: 12, alignItems: "center" },
  primaryText: { color: "#F9FAFB", fontWeight: "900" },

  cancel: { marginTop: 10, alignItems: "center", paddingVertical: 8 },
  cancelText: { fontSize: 13, fontWeight: "900" },
});
