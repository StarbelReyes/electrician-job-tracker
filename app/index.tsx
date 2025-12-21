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
        role === "employee" && !companyId
          ? ("/join-company" as const)
          : ("/home" as const);

      console.log("[INDEX] routeBy =>", { role, companyId, next });
      safeReplace(next);
    };

    const checkSession = async () => {
      try {
        const stored = await AsyncStorage.getItem(USER_STORAGE_KEY);
        if (!isMounted) return;

        // If no local session → if auth exists, rebuild from Firestore; else login
        if (!stored) {
          const authed = firebaseAuth.currentUser;
          if (!authed) {
            console.log("[INDEX] no session + no auth => /login");
            safeReplace("/login" as const);
            return;
          }

          console.log("[INDEX] no session but auth exists => hydrate from Firestore");
          const userRef = doc(db, "users", authed.uid);
          const snap = await getDoc(userRef);

          if (snap.exists()) {
            const profile = snap.data() as UserProfile;
            const nextSession: Session = {
              uid: authed.uid,
              email: profile.email ?? authed.email ?? null,
              name: profile.name ?? "",
              role: (profile.role ?? "independent") as Role,
              companyId: typeof profile.companyId === "string" ? profile.companyId : null,
            };

            await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(nextSession));
            routeBy(nextSession.role, nextSession.companyId);
            return;
          }

          // If profile missing, still let them in (or you can force login)
          console.log("[INDEX] auth exists but no users/{uid} profile => /home");
          safeReplace("/home" as const);
          return;
        }

        // Local session exists
        let session: Session | null = null;
        try {
          session = JSON.parse(stored);
        } catch {
          session = null;
        }

        console.log("[INDEX] local session =>", session);

        // If session has role info, route immediately
        const role = session?.role;
        const companyId = session?.companyId ?? null;

        // ✅ If role is missing (old session), recover from Firestore
        if (!role && session?.uid) {
          console.log("[INDEX] role missing in local session => recovering from Firestore");
          const userRef = doc(db, "users", session.uid);
          const snap = await getDoc(userRef);

          if (snap.exists()) {
            const profile = snap.data() as UserProfile;

            const fixedRole = (profile.role ?? "independent") as Role;
            const fixedCompanyId =
              typeof profile.companyId === "string" ? profile.companyId : null;

            const repaired: Session = {
              ...session,
              role: fixedRole,
              companyId: fixedCompanyId,
              name: profile.name ?? session.name ?? "",
              email: profile.email ?? session.email ?? null,
            };

            await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(repaired));
            routeBy(repaired.role, repaired.companyId);
            return;
          }
        }

        // Normal path
        routeBy(role, companyId);
      } catch (err) {
        console.warn("[INDEX] Session check error:", err);
        safeReplace("/login" as const);
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
