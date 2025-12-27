// app/work-tickets-inbox.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import {
    collection,
    getDocs,
    limit,
    orderBy,
    query
} from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
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

type TicketRow = {
  jobId: string;
  ticketId: string;

  jobTitle: string;
  jobAddress: string;

  createdAt: any;
  dayKey?: string;

  createdByName?: string | null;
  createdByEmail?: string | null;
  createdByUid?: string | null;

  workPerformed?: string;
  laborHours?: number;
};

function tsToMillis(t: any): number {
  try {
    if (typeof t?.toMillis === "function") return t.toMillis();
    if (typeof t?.toDate === "function") return t.toDate().getTime();
    return 0;
  } catch {
    return 0;
  }
}

function fmt(t: any): string {
  try {
    if (typeof t?.toDate === "function") return t.toDate().toLocaleString();
    return "";
  } catch {
    return "";
  }
}

export default function WorkTicketsInboxScreen() {
  const router = useRouter();
  const { isReady, theme, accentColor } = usePreferences();

  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);

  const isOwner = session?.role === "owner";
  const companyId = session?.companyId ?? null;

  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<TicketRow[]>([]);

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

    const loadInbox = async () => {
      try {
        setLoading(true);

        if (!isOwner) {
          setTickets([]);
          return;
        }
        if (!companyId) {
          setTickets([]);
          return;
        }

        // 1) load jobs
        const jobsSnap = await getDocs(collection(db, "companies", companyId, "jobs"));
        const jobIds = jobsSnap.docs.map((d) => d.id);

        // 2) for each job, load last N tickets
        const rows: TicketRow[] = [];

        for (const jId of jobIds) {
          const jobDoc = jobsSnap.docs.find((d) => d.id === jId);
          const jd: any = jobDoc?.data() ?? {};

          const jobTitle = String(jd.title ?? "");
          const jobAddress = String(jd.address ?? "");

          const ticketsCol = collection(db, "companies", companyId, "jobs", jId, "workTickets");
          const qy = query(ticketsCol, orderBy("createdAt", "desc"), limit(20));
          const tSnap = await getDocs(qy);

          tSnap.docs.forEach((td) => {
            const t: any = td.data() ?? {};
            rows.push({
              jobId: jId,
              ticketId: td.id,
              jobTitle: String(t.jobTitle ?? jobTitle ?? ""),
              jobAddress: String(t.jobAddress ?? jobAddress ?? ""),
              createdAt: t.createdAt,
              dayKey: t.dayKey ? String(t.dayKey) : "",
              createdByName: t.createdByName ?? null,
              createdByEmail: t.createdByEmail ?? null,
              createdByUid: t.createdByUid ?? null,
              workPerformed: t.workPerformed ? String(t.workPerformed) : "",
              laborHours: typeof t.laborHours === "number" ? t.laborHours : 0,
            });
          });
        }

        // 3) sort newest first
        rows.sort((a, b) => tsToMillis(b.createdAt) - tsToMillis(a.createdAt));

        setTickets(rows);
      } catch (e) {
        console.warn("Failed to load inbox:", e);
        Alert.alert("Error", "Could not load tickets inbox.");
        setTickets([]);
      } finally {
        setLoading(false);
      }
    };

    loadInbox();
  }, [sessionLoaded, isOwner, companyId]);

  const count = tickets.length;

  const headerRight = useMemo(() => {
    if (!count) return "";
    return `${count}`;
  }, [count]);

  if (!isReady) return <View style={{ flex: 1, backgroundColor: "#0b0f1a" }} />;

  if (sessionLoaded && !isOwner) {
    return (
      <View style={[styles.center, { backgroundColor: theme.screenBackground }]}>
        <Text style={{ color: theme.textPrimary, fontFamily: "Athiti-Bold", fontSize: 18 }}>
          Not allowed
        </Text>
        <Text style={{ color: theme.textMuted, marginTop: 6, textAlign: "center" }}>
          Inbox is for owners only.
        </Text>
        <TouchableOpacity style={[styles.btn, { backgroundColor: accentColor }]} onPress={safeBack}>
          <Text style={styles.btnText}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.screenBackground }}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={safeBack} style={styles.backBtn} activeOpacity={0.8}>
          <Text style={{ color: theme.headerMuted, fontFamily: "Athiti-SemiBold" }}>← Back</Text>
        </TouchableOpacity>

        <Text style={{ color: theme.headerText, fontFamily: "Athiti-Bold", fontSize: 18 }}>
          Tickets Inbox
        </Text>

        <View style={styles.countPill}>
          <Text style={{ color: theme.headerText, fontFamily: "Athiti-Bold" }}>
            {headerRight || "0"}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={{ marginTop: 10, color: theme.textMuted }}>Loading…</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
          {tickets.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
              <Text style={{ color: theme.textPrimary, fontFamily: "Athiti-Bold" }}>No tickets yet</Text>
              <Text style={{ color: theme.textMuted, marginTop: 6 }}>
                Work tickets submitted by employees will appear here.
              </Text>
            </View>
          ) : (
            tickets.map((t) => {
              const who =
                (t.createdByName && String(t.createdByName).trim()) ||
                (t.createdByEmail && String(t.createdByEmail).trim()) ||
                (t.createdByUid ? String(t.createdByUid).slice(0, 6) + "…" : "Employee");

              const created = fmt(t.createdAt);
              const preview = (t.workPerformed || "").trim().slice(0, 90);

              return (
                <TouchableOpacity
                  key={`${t.jobId}_${t.ticketId}`}
                  style={[styles.rowCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}
                  activeOpacity={0.9}
                  onPress={() =>
                    router.push({
                      pathname: "/work-ticket-view",
                      params: { jobId: t.jobId, ticketId: t.ticketId },
                    } as any)
                  }
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
                    <Text numberOfLines={1} style={{ flex: 1, color: theme.textPrimary, fontFamily: "Athiti-Bold" }}>
                      {t.jobTitle || "Job"}
                    </Text>
                    <Text style={{ color: theme.textMuted, fontFamily: "Athiti-SemiBold", fontSize: 12 }}>
                      {created || t.dayKey || ""}
                    </Text>
                  </View>

                  <Text numberOfLines={1} style={{ color: theme.textSecondary, marginTop: 4 }}>
                    {t.jobAddress || ""}
                  </Text>

                  <Text style={{ color: theme.textMuted, marginTop: 8 }}>
                    <Text style={{ fontFamily: "Athiti-Bold" }}>{who}</Text>
                    {"  •  "}
                    {t.laborHours ?? 0}h
                  </Text>

                  {!!preview && (
                    <Text style={{ color: theme.textPrimary, marginTop: 8 }} numberOfLines={2}>
                      {preview}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 18 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingTop: 48, paddingBottom: 12 },
  backBtn: { paddingVertical: 6, paddingHorizontal: 6 },
  countPill: { minWidth: 46, alignItems: "center", justifyContent: "center" },

  btn: { marginTop: 12, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  btnText: { color: "#F9FAFB", fontWeight: "800" },

  emptyCard: { borderWidth: 1, borderRadius: 18, padding: 16 },
  rowCard: { borderWidth: 1, borderRadius: 18, padding: 14, marginBottom: 10 },
});
