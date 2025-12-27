import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Print from "expo-print";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { collection, doc, getDoc, getDocs, orderBy, query } from "firebase/firestore";
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

type Job = { id: string; title: string; address: string; description: string };

type WorkTicket = {
  id: string;
  jobId: string;
  jobTitle: string;
  jobAddress: string;
  workPerformed: string;
  laborHours: number;
  materialsUsed: string;
  createdByUid: string | null;
  createdByName: string | null;
  createdByEmail: string | null;
  createdByRole: string | null;
  createdAt: any;
  dayKey: string;
  isFinal: true;
  isReviewed: boolean;
  reviewedAt?: any;
  reviewedByUid?: string | null;
};

function escapeHtml(s: string) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function ticketsToCSV(job: Job, tickets: WorkTicket[]) {
  const header = [
    "dayKey",
    "createdByName",
    "createdByEmail",
    "laborHours",
    "workPerformed",
    "materialsUsed",
    "isReviewed",
  ];

  const rows = tickets.map((t) => [
    t.dayKey,
    t.createdByName ?? "",
    t.createdByEmail ?? "",
    String(t.laborHours ?? 0),
    (t.workPerformed ?? "").replaceAll("\n", " "),
    (t.materialsUsed ?? "").replaceAll("\n", " "),
    t.isReviewed ? "true" : "false",
  ]);

  const csv = [[`Job Title: ${job.title}`], [`Job Address: ${job.address}`], [], header, ...rows]
    .map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(","))
    .join("\n");

  return csv;
}

function ticketsToHTML(job: Job, tickets: WorkTicket[]) {
  const rows = tickets
    .map(
      (t) => `
      <tr>
        <td>${escapeHtml(t.dayKey)}</td>
        <td>${escapeHtml(t.createdByName ?? t.createdByEmail ?? "Employee")}</td>
        <td>${escapeHtml(String(t.laborHours ?? 0))}</td>
        <td>${escapeHtml(t.workPerformed ?? "")}</td>
        <td>${escapeHtml(t.materialsUsed ?? "")}</td>
        <td>${t.isReviewed ? "Reviewed" : "New"}</td>
      </tr>
    `
    )
    .join("");

  return `
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: -apple-system, Helvetica, Arial, sans-serif; padding: 18px; }
        h1 { font-size: 18px; margin: 0 0 6px 0; }
        .meta { color: #555; font-size: 12px; margin-bottom: 14px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { border: 1px solid #ddd; padding: 8px; vertical-align: top; }
        th { background: #f6f6f6; text-align: left; }
      </style>
    </head>
    <body>
      <h1>Work Tickets</h1>
      <div class="meta">
        <div><b>Job:</b> ${escapeHtml(job.title)}</div>
        <div><b>Address:</b> ${escapeHtml(job.address)}</div>
        <div><b>Total tickets:</b> ${tickets.length}</div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Employee</th>
            <th>Hours</th>
            <th>Work Performed</th>
            <th>Materials</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </body>
  </html>
  `;
}

export default function JobWorkTicketsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ jobId?: string }>();
  const jobId = params?.jobId ? String(params.jobId) : "";

  const { isReady, theme, accentColor } = usePreferences();

  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);

  const isOwner = session?.role === "owner";
  const companyId = session?.companyId ?? null;

  const [job, setJob] = useState<Job | null>(null);
  const [tickets, setTickets] = useState<WorkTicket[]>([]);
  const [loading, setLoading] = useState(true);

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
    if (!companyId || !jobId) return;
    setLoading(true);
    try {
      const jobRef = doc(db, "companies", companyId, "jobs", jobId);
      const jobSnap = await getDoc(jobRef);
      if (!jobSnap.exists()) {
        setJob(null);
        setTickets([]);
        return;
      }

      const jd: any = jobSnap.data() ?? {};
      const j: Job = {
        id: jobSnap.id,
        title: String(jd.title ?? ""),
        address: String(jd.address ?? ""),
        description: String(jd.description ?? ""),
      };
      setJob(j);

      const ticketsRef = collection(db, "companies", companyId, "jobs", jobId, "workTickets");
      let tSnap;
      try {
        tSnap = await getDocs(query(ticketsRef, orderBy("createdAt", "desc")));
      } catch {
        tSnap = await getDocs(ticketsRef);
      }

      const list: WorkTicket[] = tSnap.docs.map((d) => {
        const data: any = d.data() ?? {};
        return {
          id: d.id,
          jobId: String(data.jobId ?? jobId),
          jobTitle: String(data.jobTitle ?? j.title),
          jobAddress: String(data.jobAddress ?? j.address),
          workPerformed: String(data.workPerformed ?? ""),
          laborHours: Number(data.laborHours ?? 0),
          materialsUsed: String(data.materialsUsed ?? ""),
          createdByUid: data.createdByUid ?? null,
          createdByName: data.createdByName ?? null,
          createdByEmail: data.createdByEmail ?? null,
          createdByRole: data.createdByRole ?? null,
          createdAt: data.createdAt ?? null,
          dayKey: String(data.dayKey ?? ""),
          isFinal: true,
          isReviewed: Boolean(data.isReviewed ?? false),
          reviewedAt: data.reviewedAt ?? null,
          reviewedByUid: data.reviewedByUid ?? null,
        };
      });

      list.sort((a, b) => {
        const aMs = a.createdAt?.toMillis?.() ?? 0;
        const bMs = b.createdAt?.toMillis?.() ?? 0;
        if (aMs !== bMs) return bMs - aMs;
        return String(b.dayKey).localeCompare(String(a.dayKey));
      });

      setTickets(list);
    } catch (e) {
      console.warn("Load job tickets failed:", e);
      Alert.alert("Error", "Could not load tickets for this job.");
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
  }, [sessionLoaded, isOwner, companyId, jobId]);

  const unreviewed = useMemo(() => tickets.filter((t) => !t.isReviewed).length, [tickets]);

  const exportCSV = async () => {
    if (!job) return;
    try {
      const csv = ticketsToCSV(job, tickets);
      const uri = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
      await Sharing.shareAsync(uri, {
        mimeType: "text/csv",
        dialogTitle: "Share CSV",
        UTI: "public.comma-separated-values-text",
      } as any);
    } catch (e) {
      console.warn("CSV export failed:", e);
      Alert.alert("Error", "Could not export CSV.");
    }
  };

  const exportPDF = async () => {
    if (!job) return;
    try {
      const html = ticketsToHTML(job, tickets);
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri);
    } catch (e) {
      console.warn("PDF export failed:", e);
      Alert.alert("Error", "Could not export PDF.");
    }
  };

  if (!isReady) return <View style={{ flex: 1, backgroundColor: "#0b0f1a" }} />;

  if (sessionLoaded && !isOwner) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.screenBackground }}>
        <View style={[styles.center, { paddingTop: 12 }]}>
          <Text style={[styles.title, { color: theme.textPrimary }]}>Not allowed</Text>
          <Text style={[styles.sub, { color: theme.textMuted }]}>
            This screen is for owners only.
          </Text>
          <TouchableOpacity style={[styles.btn, { backgroundColor: accentColor }]} onPress={safeBack}>
            <Text style={styles.btnText}>Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!jobId || !companyId) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.screenBackground }}>
        <View style={[styles.center, { paddingTop: 12 }]}>
          <Text style={[styles.title, { color: theme.textPrimary }]}>Missing job</Text>
          <Text style={[styles.sub, { color: theme.textMuted }]}>
            jobId param or companyId is missing.
          </Text>
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
        <View style={styles.topRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.h1, { color: theme.textPrimary }]}>
              {job?.title || "Job Tickets"}
            </Text>
            <Text style={[styles.h2, { color: theme.textMuted }]}>
              {loading ? "Loading…" : `${unreviewed} unreviewed • ${tickets.length} total`}
            </Text>
          </View>

          <TouchableOpacity
            onPress={safeBack}
            style={[styles.pill, { borderColor: theme.cardBorder }]}
            activeOpacity={0.85}
          >
            <Text style={[styles.pillText, { color: theme.textPrimary }]}>Back</Text>
          </TouchableOpacity>
        </View>

        {!!job?.address && (
          <Text style={[styles.addr, { color: theme.textMuted }]}>{job.address}</Text>
        )}

        <View style={styles.actions}>
          <TouchableOpacity
            onPress={exportPDF}
            style={[styles.actionBtn, { backgroundColor: accentColor }]}
            activeOpacity={0.9}
          >
            <Text style={styles.actionText}>Export PDF</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={exportCSV}
            style={[styles.actionBtnOutline, { borderColor: theme.cardBorder }]}
            activeOpacity={0.9}
          >
            <Text style={[styles.actionTextOutline, { color: theme.textPrimary }]}>Share CSV</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
          {tickets.length === 0 && !loading ? (
            <Text style={[styles.sub, { color: theme.textMuted }]}>
              No work tickets for this job yet.
            </Text>
          ) : null}

          {tickets.map((t) => (
            <TouchableOpacity
              key={t.id}
              onPress={() =>
                router.push(
                  (`/work-ticket-detail?jobId=${encodeURIComponent(jobId)}&ticketId=${encodeURIComponent(t.id)}` as any)
                )
              }
              style={[styles.row, { borderColor: theme.cardBorder }]}
              activeOpacity={0.85}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: theme.textPrimary }]}>
                  {t.dayKey} • {t.createdByName || t.createdByEmail || "Employee"}
                </Text>
                <Text style={[styles.rowSub, { color: theme.textMuted }]} numberOfLines={1}>
                  {t.workPerformed || "—"}
                </Text>
              </View>

              <Text style={[styles.status, { color: t.isReviewed ? theme.textMuted : theme.textPrimary }]}>
                {t.isReviewed ? "Reviewed" : "New"}
              </Text>
            </TouchableOpacity>
          ))}
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

  topRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  h1: { fontSize: 18, fontWeight: "900" },
  h2: { fontSize: 12, marginTop: 2 },
  addr: { fontSize: 12, marginBottom: 12 },

  pill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  pillText: { fontWeight: "900", fontSize: 12 },

  actions: { flexDirection: "row", gap: 10, marginBottom: 12 },
  actionBtn: { flex: 1, paddingVertical: 12, borderRadius: 14, alignItems: "center" },
  actionText: { color: "#F9FAFB", fontWeight: "900" },
  actionBtnOutline: { flex: 1, paddingVertical: 12, borderRadius: 14, alignItems: "center", borderWidth: 1 },
  actionTextOutline: { fontWeight: "900" },

  card: { borderWidth: 1, borderRadius: 16, padding: 14 },
  row: { paddingVertical: 10, borderTopWidth: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  rowTitle: { fontSize: 13, fontWeight: "900" },
  rowSub: { fontSize: 12, marginTop: 2 },
  status: { fontSize: 12, fontWeight: "900" },
});
