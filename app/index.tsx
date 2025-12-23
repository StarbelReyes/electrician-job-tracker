// app/index.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Href, useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { db, firebaseAuth } from "../firebaseConfig";

const USER_STORAGE_KEY = "EJT_USER_SESSION";

type Role = "owner" | "employee" | "independent";

type Session = {
  uid?: string;
  email?: string | null;
  name?: string;
  role?: Role;
  companyId?: string | null;
};

type UserProfile = {
  role?: Role;
  companyId?: string | null;
  name?: string;
  email?: string;
};

export default function IndexScreen() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const safeReplace = (href: Href) => {
      router.replace(href);
    };

    const routeBy = (role?: Role, companyId?: string | null) => {
      const next: Href =
        role === "owner" && !companyId
          ? ("/create-company" as any)
          : role === "employee" && !companyId
          ? ("/join-company" as const)
          : ("/home" as const);

      console.log("[INDEX] routeBy =>", { role, companyId, next });
      safeReplace(next);
    };

    const buildSessionFromProfile = (uid: string, profile: UserProfile, fallbackEmail: string | null) => {
      const nextSession: Session = {
        uid,
        email: profile.email ?? fallbackEmail ?? null,
        name: profile.name ?? "",
        role: (profile.role ?? "independent") as Role,
        companyId: typeof profile.companyId === "string" ? profile.companyId : null,
      };
      return nextSession;
    };

    const checkSession = async () => {
      try {
        const authed = firebaseAuth.currentUser;

        // If no auth at all -> login
        if (!authed) {
          console.log("[INDEX] no auth => /login");
          safeReplace("/login" as any);
          return;
        }

        // Always trust Firestore as source of truth when possible (PERMANENT FIX)
        const userRef = doc(db, "users", authed.uid);
        const snap = await getDoc(userRef);

        if (snap.exists()) {
          const profile = snap.data() as UserProfile;
          const fresh = buildSessionFromProfile(authed.uid, profile, authed.email ?? null);

          // Store fresh session
          await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(fresh));
          if (!isMounted) return;

          console.log("[INDEX] hydrated/verified session =>", fresh);
          routeBy(fresh.role, fresh.companyId);
          return;
        }

        // If profile missing, fallback to local session (or go home)
        const stored = await AsyncStorage.getItem(USER_STORAGE_KEY);
        if (!stored) {
          console.log("[INDEX] auth exists but no users/{uid} profile + no local => /home");
          safeReplace("/home" as const);
          return;
        }

        let session: Session | null = null;
        try {
          session = JSON.parse(stored);
        } catch {
          session = null;
        }

        console.log("[INDEX] fallback local session =>", session);
        routeBy(session?.role, session?.companyId ?? null);
      } catch (err) {
        console.warn("[INDEX] Session check error:", err);
        safeReplace("/login" as any);
      } finally {
        if (isMounted) setChecking(false);
      }
    };

    checkSession();

    return () => {
      isMounted = false;
    };
  }, [router]);

  if (checking) {
    return (
      <View style={styles.container}>
        <ActivityIndicator />
        <Text style={styles.text}>Loading Traktr…</Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  text: { marginTop: 8, fontSize: 16 },
});
