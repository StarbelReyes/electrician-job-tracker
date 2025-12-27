import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    Alert,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
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

type Job = {
  id: string;
  title: string;
  address?: string;
};

type WorkTicket = {
  id: string; // ticketId
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

export default function WorkTicketsInboxScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isReady, theme, accentColor } = usePreferences();

  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [tickets, setTickets] = useState<WorkTicket[]>([]);
  const [jobsIndex, setJobsIndex] = useState<Record<string, Job>>({});

  const isOwner = session?.role === "owner";
  const companyId = session?.companyId ?? null;

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

  const safeBack = () => {
    try {
      // @ts-ignore
      if (router?.canGoBack?.()) return router.back();
    } catch {}
    router.replace("/home" as any);
  };

  const loadInbox = useCallback(async () => {
    if (!companyId) return;

    setLoading(true);
    try {
      // 1) load jobs
      const jobsRef = collection(db, "companies", companyId, "jobs");
      const jobsSnap = await getDocs(jobsRef);

      const jobs: Job[] = jobsSnap.docs.map((d) => {
        const data: any = d.data() ?? {};
        return {
          id: d.id,
          title: String(data.title ?? ""),
          address: String(data.address ?? ""),
        };
      });

      const idx: Record<string, Job> = {};
      jobs.forEach((j) => (idx[j.id] = j));
      setJobsIndex(idx);

      // 2) load tickets per job (parallel)
      const allTicketsNested = await Promise.all(
        jobs.map(async (job) => {
          const ticketsRef = collection(
            db,
            "companies",
            companyId,
            "jobs",
            job.id,
            "workTickets"
          );

          let snap;
          try {
            snap = await getDocs(query(ticketsRef, orderBy("createdAt", "desc")));
          } catch {
            snap = await getDocs(ticketsRef);
          }

          return snap.docs.map((t) => {
            const data: any = t.data() ?? {};
            const ticket: WorkTicket = {
              id: t.id,
              jobId: String(data.jobId ?? job.id),
              jobTitle: String(data.jobTitle ?? job.title),
              jobAddress: String(data.jobAddress ?? job.address ?? ""),
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
            return ticket;
          });
        })
      );

      const allTickets = allTicketsNested.flat();

      // 3) sort newest first (fallback: dayKey desc)
      allTickets.sort((a, b) => {
        const aMs = a.createdAt?.toMillis?.() ?? 0;
        const bMs = b.createdAt?.toMillis?.() ?? 0;
        if (aMs !== bMs) return bMs - aMs;
        return String(b.dayKey).localeCompare(String(a.dayKey));
      });

      setTickets(allTickets);
    } catch (e) {
      console.warn("Load inbox failed:", e);
      setTickets([]);
      Alert.alert("Error", "Could not load work tickets inbox.");
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    if (!sessionLoaded) return;
    if (!isOwner) return;
    if (!companyId) return;
    loadInbox();
  }, [sessionLoaded, isOwner, companyId, loadInbox]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadInbox();
    setRefreshing(false);
  };

  const grouped = useMemo(() => {
    const map: Record<string, WorkTicket[]> = {};
    for (const t of tickets) {
      const key = t.jobId || "unknown";
      if (!map[key]) map[key] = [];
      map[key].push(t);
    }
    return map;
  }, [tickets]);

  const unreviewedCount = useMemo(
    () => tickets.filter((t) => !t.isReviewed).length,
    [tickets]
  );

  if (!isReady) return <View style={{ flex: 1, backgroundColor: "#0b0f1a" }} />;

  if (sessionLoaded && !isOwner) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.screenBackground }}>
        <View style={[styles.center, { paddingTop: 12 }]}>
          <Text style={[styles.title, { color: theme.textPrimary }]}>Not allowed</Text>
          <Text style={[styles.sub, { color: theme.textMuted }]}>
            This screen is for owners only.
          </Text>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: accentColor }]}
            onPress={safeBack}
          >
            <Text style={styles.btnText}>Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!companyId) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.screenBackground }}>
        <View style={[styles.center, { paddingTop: 12 }]}>
          <Text style={[styles.title, { color: theme.textPrimary }]}>Missing company</Text>
          <Text style={[styles.sub, { color: theme.textMuted }]}>
            Your session has no companyId.
          </Text>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: accentColor }]}
            onPress={safeBack}
          >
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
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.h1, { color: theme.textPrimary }]}>Work Tickets</Text>
            <Text style={[styles.h2, { color: theme.textMuted }]}>
              {loading ? "Loading…" : `${unreviewedCount} unreviewed`}
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => router.replace("/home" as any)}
            style={[styles.pill, { borderColor: theme.cardBorder }]}
            activeOpacity={0.85}
          >
            <Text style={[styles.pillText, { color: theme.textPrimary }]}>Home</Text>
          </TouchableOpacity>
        </View>

        {Object.keys(grouped).length === 0 && !loading ? (
          <View
            style={[
              styles.card,
              { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
            ]}
          >
            <Text style={[styles.sub, { color: theme.textMuted }]}>
              No work tickets yet.
            </Text>
          </View>
        ) : null}

        {Object.entries(grouped).map(([jobId, list]) => {
          const job = jobsIndex[jobId];
          const jobTitle = job?.title || list?.[0]?.jobTitle || "Job";
          const jobAddress = job?.address || list?.[0]?.jobAddress || "";

          const unrev = list.filter((t) => !t.isReviewed).length;

          return (
            <View
              key={jobId}
              style={[
                styles.group,
                { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
              ]}
            >
              <View style={styles.groupHead}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.groupTitle, { color: theme.textPrimary }]}>
                    {jobTitle}
                  </Text>
                  {!!jobAddress && (
                    <Text
                      style={[styles.groupSub, { color: theme.textMuted }]}
                      numberOfLines={2}
                    >
                      {jobAddress}
                    </Text>
                  )}
                </View>

                {unrev > 0 && (
                  <View style={[styles.badge, { backgroundColor: accentColor }]}>
                    <Text style={styles.badgeText}>{unrev}</Text>
                  </View>
                )}

                <TouchableOpacity
                  onPress={() =>
                    router.push(
                      (`/job-work-tickets?jobId=${encodeURIComponent(jobId)}` as any)
                    )
                  }
                  style={[styles.smallBtn, { borderColor: theme.cardBorder }]}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.smallBtnText, { color: theme.textPrimary }]}>
                    Open
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={{ marginTop: 10 }}>
                {list.slice(0, 6).map((t) => (
                  <TouchableOpacity
                    key={t.id}
                    onPress={() =>
                      router.push(
                        (`/work-ticket-detail?jobId=${encodeURIComponent(
                          jobId
                        )}&ticketId=${encodeURIComponent(t.id)}` as any)
                      )
                    }
                    style={[styles.row, { borderColor: theme.cardBorder }]}
                    activeOpacity={0.85}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.rowTitle, { color: theme.textPrimary }]}>
                        {t.dayKey} • {t.createdByName || t.createdByEmail || "Employee"}
                      </Text>
                      <Text
                        style={[styles.rowSub, { color: theme.textMuted }]}
                        numberOfLines={1}
                      >
                        {t.workPerformed || "—"}
                      </Text>
                    </View>

                    <Text
                      style={[
                        styles.status,
                        { color: t.isReviewed ? theme.textMuted : theme.textPrimary },
                      ]}
                    >
                      {t.isReviewed ? "Reviewed" : "New"}
                    </Text>
                  </TouchableOpacity>
                ))}

                {list.length > 6 && (
                  <Text style={[styles.more, { color: theme.textMuted }]}>
                    + {list.length - 6} more…
                  </Text>
                )}
              </View>
            </View>
          );
        })}
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

  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  h1: { fontSize: 22, fontWeight: "900" },
  h2: { fontSize: 12, marginTop: 2 },

  pill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  pillText: { fontWeight: "800", fontSize: 13 },

  card: { borderWidth: 1, borderRadius: 16, padding: 14 },

  group: { borderWidth: 1, borderRadius: 18, padding: 14, marginTop: 12 },
  groupHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  groupTitle: { fontSize: 16, fontWeight: "900" },
  groupSub: { fontSize: 12, marginTop: 2 },

  badge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#F9FAFB", fontWeight: "900" },

  smallBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1 },
  smallBtnText: { fontWeight: "900", fontSize: 12 },

  row: {
    paddingVertical: 10,
    borderTopWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  rowTitle: { fontSize: 13, fontWeight: "900" },
  rowSub: { fontSize: 12, marginTop: 2 },
  status: { fontSize: 12, fontWeight: "900" },

  more: { marginTop: 8, fontSize: 12 },
});
