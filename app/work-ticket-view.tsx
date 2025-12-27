// app/work-ticket-view.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
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

type Ticket = {
  id: string;
  jobId: string;
  jobTitle?: string;
  jobAddress?: string;

  workPerformed?: string;
  laborHours?: number;
  materialsUsed?: string;

  createdByUid?: string | null;
  createdByName?: string | null;
  createdByEmail?: string | null;

  createdAt?: any; // Timestamp
  dayKey?: string;

  isReviewed?: boolean;
};

function formatCreatedAt(value: any): string {
  try {
    const d =
      typeof value?.toDate === "function"
        ? value.toDate()
        : value instanceof Date
        ? value
        : null;
    if (!d) return "";
    return d.toLocaleString();
  } catch {
    return "";
  }
}

export default function WorkTicketViewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    jobId?: string;
    ticketId?: string;
  }>();

  const jobId = params?.jobId ? String(params.jobId) : "";
  const ticketId = params?.ticketId ? String(params.ticketId) : "";

  const { isReady, theme, accentColor } = usePreferences();

  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);

  const companyId = session?.companyId ?? null;

  const [loading, setLoading] = useState(true);
  const [ticket, setTicket] = useState<Ticket | null>(null);

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

    const loadTicket = async () => {
      try {
        setLoading(true);

        if (!companyId || !jobId || !ticketId) {
          setTicket(null);
          return;
        }

        const ref = doc(
          db,
          "companies",
          companyId,
          "jobs",
          jobId,
          "workTickets",
          ticketId
        );

        const snap = await getDoc(ref);
        if (!snap.exists()) {
          setTicket(null);
          return;
        }

        const data: any = snap.data() ?? {};
        setTicket({
          id: snap.id,
          jobId: String(data.jobId ?? jobId),
          jobTitle: data.jobTitle ? String(data.jobTitle) : "",
          jobAddress: data.jobAddress ? String(data.jobAddress) : "",
          workPerformed: data.workPerformed ? String(data.workPerformed) : "",
          laborHours: typeof data.laborHours === "number" ? data.laborHours : 0,
          materialsUsed: data.materialsUsed ? String(data.materialsUsed) : "",
          createdByUid: data.createdByUid ?? null,
          createdByName: data.createdByName ?? null,
          createdByEmail: data.createdByEmail ?? null,
          createdAt: data.createdAt,
          dayKey: data.dayKey ? String(data.dayKey) : "",
          isReviewed: Boolean(data.isReviewed ?? false),
        });
      } catch (e) {
        console.warn("Failed to load ticket:", e);
        setTicket(null);
      } finally {
        setLoading(false);
      }
    };

    loadTicket();
  }, [sessionLoaded, companyId, jobId, ticketId]);

  const createdLabel = useMemo(() => {
    if (!ticket?.createdAt) return "";
    return formatCreatedAt(ticket.createdAt);
  }, [ticket?.createdAt]);

  if (!isReady) return <View style={{ flex: 1, backgroundColor: "#0b0f1a" }} />;

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.screenBackground }]}>
        <Text style={{ color: theme.textPrimary }}>Loading ticket…</Text>
      </View>
    );
  }

  if (!ticket) {
    return (
      <View style={[styles.center, { backgroundColor: theme.screenBackground }]}>
        <Text style={[styles.title, { color: theme.textPrimary }]}>Ticket not found</Text>
        <TouchableOpacity style={[styles.btn, { backgroundColor: accentColor }]} onPress={safeBack}>
          <Text style={styles.btnText}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const createdBy =
    (ticket.createdByName && String(ticket.createdByName).trim()) ||
    (ticket.createdByEmail && String(ticket.createdByEmail).trim()) ||
    (ticket.createdByUid ? String(ticket.createdByUid).slice(0, 6) + "…" : "Employee");

  return (
    <View style={{ flex: 1, backgroundColor: theme.screenBackground }}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={safeBack} style={styles.backBtn} activeOpacity={0.8}>
          <Text style={{ color: theme.headerMuted, fontFamily: "Athiti-SemiBold" }}>← Back</Text>
        </TouchableOpacity>
        <Text style={{ color: theme.headerText, fontFamily: "Athiti-Bold", fontSize: 18 }}>
          Work Ticket
        </Text>
        <View style={{ width: 64 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
        <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
          <Text style={[styles.meta, { color: theme.textMuted }]}>Job</Text>
          <Text style={[styles.h1, { color: theme.textPrimary }]}>{ticket.jobTitle || "—"}</Text>
          <Text style={[styles.sub, { color: theme.textSecondary }]}>{ticket.jobAddress || "—"}</Text>

          <View style={styles.sep} />

          <Text style={[styles.meta, { color: theme.textMuted }]}>Submitted by</Text>
          <Text style={[styles.value, { color: theme.textPrimary }]}>{createdBy}</Text>
          {!!createdLabel && (
            <Text style={[styles.sub, { color: theme.textMuted }]}>Created: {createdLabel}</Text>
          )}
          {!!ticket.dayKey && (
            <Text style={[styles.sub, { color: theme.textMuted }]}>Day: {ticket.dayKey}</Text>
          )}

          <View style={styles.sep} />

          <Text style={[styles.meta, { color: theme.textMuted }]}>Work performed</Text>
          <Text style={[styles.value, { color: theme.textPrimary }]}>{ticket.workPerformed || "—"}</Text>

          <View style={styles.sep} />

          <Text style={[styles.meta, { color: theme.textMuted }]}>Labor hours</Text>
          <Text style={[styles.value, { color: theme.textPrimary }]}>{String(ticket.laborHours ?? 0)}</Text>

          <View style={styles.sep} />

          <Text style={[styles.meta, { color: theme.textMuted }]}>Supplies / Resources</Text>
          <Text style={[styles.value, { color: theme.textPrimary }]}>{ticket.materialsUsed || "—"}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 18 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingTop: 48, paddingBottom: 12 },
  backBtn: { paddingVertical: 6, paddingHorizontal: 6 },
  card: { borderWidth: 1, borderRadius: 18, padding: 16 },
  meta: { fontSize: 12, fontFamily: "Athiti-SemiBold", marginBottom: 4 },
  h1: { fontSize: 16, fontFamily: "Athiti-Bold" },
  sub: { fontSize: 12, fontFamily: "Athiti-SemiBold", marginTop: 3 },
  value: { fontSize: 14, fontFamily: "Athiti-Regular", lineHeight: 20 },
  sep: { height: 1, marginVertical: 14, backgroundColor: "rgba(148,163,184,0.25)" },
  title: { fontSize: 18, fontWeight: "800", marginBottom: 10 },
  btn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  btnText: { color: "#F9FAFB", fontWeight: "800" },
});
