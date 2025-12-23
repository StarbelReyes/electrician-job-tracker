// app/create-company.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import {
    collection,
    doc,
    getDocs,
    query,
    serverTimestamp,
    setDoc,
    where,
} from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import {
    Alert,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    Share,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from "react-native";
import { themes } from "../constants/appTheme";
import { usePreferences } from "../context/PreferencesContext";
import { db, firebaseAuth } from "../firebaseConfig";

const USER_STORAGE_KEY = "EJT_USER_SESSION";

type Role = "owner" | "employee" | "independent";

type Session = {
  uid?: string;
  email?: string | null;
  name?: string;
  role?: Role;
  companyId?: string | null;
  provider?: string;
  loggedInAt?: string;
  // optional
  joinCode?: string | null;
};

function makeJoinCode() {
  const digits = Math.floor(1000 + Math.random() * 9000); // 1000-9999
  return `TRAKTR-${digits}`;
}

async function generateUniqueJoinCode(): Promise<string> {
  // Try a few times; collisions are very unlikely, but we guard anyway.
  for (let i = 0; i < 10; i++) {
    const code = makeJoinCode();
    const qref = query(collection(db, "companies"), where("joinCode", "==", code));
    const snap = await getDocs(qref);
    if (snap.empty) return code;
  }
  // Fallback: if something is weird, add more randomness
  const fallback = `TRAKTR-${Math.floor(100000 + Math.random() * 900000)}`;
  return fallback;
}

export default function CreateCompanyScreen() {
  const router = useRouter();
  const { isReady, theme, accentColor } = usePreferences();

  const [session, setSession] = useState<Session | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const authed = firebaseAuth.currentUser;
  const authedUid = authed?.uid ?? null;

  const isOwner = session?.role === "owner";
  const hasCompany = !!session?.companyId;

  const canCreate = useMemo(() => {
    const nameOk = companyName.trim().length >= 2;
    return !!authedUid && nameOk && !isSaving;
  }, [companyName, authedUid, isSaving]);

  // Load local session
  useEffect(() => {
    const load = async () => {
      try {
        const stored = await AsyncStorage.getItem(USER_STORAGE_KEY);
        if (!stored) {
          setSession(null);
          return;
        }
        try {
          setSession(JSON.parse(stored));
        } catch {
          setSession(null);
        }
      } catch {
        setSession(null);
      }
    };
    load();
  }, []);

  // Guard rails
  useEffect(() => {
    if (!isReady) return;

    if (!authedUid) {
      router.replace("/login" as any);
      return;
    }

    if (session?.role === "employee" && !session?.companyId) {
      router.replace("/join-company" as any);
      return;
    }

    if (session?.role === "owner" && session?.companyId) {
      router.replace("/home" as any);
      return;
    }
  }, [isReady, authedUid, session, router]);

  const showOwnerCodePopup = async (companyNameSafe: string, joinCode: string) => {
    Alert.alert(
      "Company created ✅",
      `Company: ${companyNameSafe}\nJoin code: ${joinCode}\n\nSend this code to employees so they can join.`,
      [
        {
          text: "Copy code",
          onPress: async () => {
            await Clipboard.setStringAsync(joinCode);
            Alert.alert("Copied", "Join code copied to clipboard.");
          },
        },
        {
          text: "Share",
          onPress: async () => {
            try {
              await Share.share({
                message: `Join my company on Traktr.\n\nJoin code: ${joinCode}`,
              });
            } catch {}
          },
        },
        { text: "Go to Home", onPress: () => router.replace("/home" as any) },
      ]
    );
  };

  const handleCreateCompany = async () => {
    const authedNow = firebaseAuth.currentUser;
    const uid = authedNow?.uid ?? null;
    const email = authedNow?.email ?? null;

    if (!uid) {
      Alert.alert("Not logged in", "Please log in again.");
      router.replace("/login" as any);
      return;
    }

    const name = companyName.trim();
    if (name.length < 2) {
      Alert.alert("Company name", "Please enter a company name.");
      return;
    }

    setIsSaving(true);

    try {
      const userRef = doc(db, "users", uid);

      // ✅ STEP 1: Upgrade role first so /companies create is allowed by rules
      await setDoc(
        userRef,
        {
          role: "owner",
          companyId: null,
          name: session?.name ?? "",
          email: session?.email ?? email ?? null,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // ✅ Create company + joinCode
      const companyRef = doc(collection(db, "companies"));
      const companyId = companyRef.id;

      const joinCode = await generateUniqueJoinCode();

      await setDoc(companyRef, {
        name,
        joinCode, // ✅ REQUIRED for employee join
        ownerUid: uid,
        createdByUid: uid,
        createdAt: serverTimestamp(),
      });

      // ✅ STEP 2: Set companyId BEFORE writing employees (your rules require this)
      await setDoc(
        userRef,
        { companyId, role: "owner", updatedAt: serverTimestamp() },
        { merge: true }
      );

      // ✅ Owner also exists in employees subcollection
      const ownerEmpRef = doc(db, "companies", companyId, "employees", uid);
      await setDoc(
        ownerEmpRef,
        {
          uid,
          role: "owner",
          email: session?.email ?? email ?? null,
          name: session?.name ?? "",
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );

      // ✅ Update local session
      const nextSession: Session = {
        uid,
        email: session?.email ?? email ?? null,
        name: session?.name ?? "",
        role: "owner",
        companyId,
        joinCode,
      };

      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(nextSession));
      setSession(nextSession);

      // ✅ Show join code immediately so owner can send it
      await showOwnerCodePopup(name, joinCode);
    } catch (e) {
      console.warn("Create company failed:", e);
      Alert.alert("Error", "Could not create company. Check rules + auth.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isReady) {
    return (
      <View style={{ flex: 1, backgroundColor: themes.graphite.screenBackground }} />
    );
  }

  if (hasCompany && isOwner) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.screenBackground }]}>
        <Text style={[styles.title, { color: theme.headerText }]}>Company already set</Text>
        <Text style={[styles.sub, { color: theme.textMuted }]}>Redirecting you to Home…</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.screenBackground }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={[styles.screen, { backgroundColor: theme.screenBackground }]}>
          <Text style={[styles.title, { color: theme.headerText }]}>Create Company</Text>
          <Text style={[styles.sub, { color: theme.textMuted }]}>
            Owner setup — this enables assigning jobs to employees.
          </Text>

          <View
            style={[
              styles.card,
              { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
            ]}
          >
            <Text style={[styles.label, { color: theme.textSecondary }]}>Company name</Text>
            <TextInput
              value={companyName}
              onChangeText={setCompanyName}
              placeholder="e.g. Starbel Electric"
              placeholderTextColor={theme.textMuted}
              style={[
                styles.input,
                {
                  backgroundColor: theme.inputBackground,
                  color: theme.inputText,
                  borderColor: theme.inputBorder,
                },
              ]}
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={handleCreateCompany}
              editable={!isSaving}
            />

            <TouchableOpacity
              activeOpacity={0.9}
              onPress={handleCreateCompany}
              disabled={!canCreate}
              style={[
                styles.primaryBtn,
                {
                  backgroundColor: accentColor,
                  opacity: canCreate ? 1 : 0.6,
                },
              ]}
            >
              <Text style={styles.primaryBtnText}>
                {isSaving ? "Creating…" : "Create Company"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => router.replace("/home" as any)}
              disabled={isSaving}
              style={[
                styles.secondaryBtn,
                {
                  backgroundColor: theme.secondaryButtonBackground,
                  borderColor: theme.cardBorder,
                  opacity: isSaving ? 0.6 : 1,
                },
              ]}
            >
              <Text style={[styles.secondaryBtnText, { color: theme.secondaryButtonText }]}>
                Back to Home
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.hint, { color: theme.textMuted }]}>
            This will update:
            {"\n"}• users/{`{uid}`} → role: owner + companyId
            {"\n"}• companies/{`{companyId}`} → joinCode
            {"\n"}• companies/{`{companyId}`}/employees/{`{uid}`}
          </Text>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingTop: 56, paddingHorizontal: 18 },
  title: { fontSize: 22, fontFamily: "Athiti-Bold", letterSpacing: 0.2 },
  sub: { marginTop: 6, fontSize: 13, fontFamily: "Athiti-Regular", lineHeight: 18 },
  card: { marginTop: 14, borderWidth: 1, borderRadius: 18, padding: 14 },
  label: { fontSize: 12, fontFamily: "Athiti-SemiBold", marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
    fontSize: 14,
    fontFamily: "Athiti-Regular",
    marginBottom: 12,
  },
  primaryBtn: { borderRadius: 999, paddingVertical: 12, alignItems: "center", marginBottom: 10 },
  primaryBtnText: { color: "#F9FAFB", fontSize: 14, fontFamily: "Athiti-Bold", letterSpacing: 0.2 },
  secondaryBtn: { borderRadius: 999, paddingVertical: 12, alignItems: "center", borderWidth: 1 },
  secondaryBtnText: { fontSize: 14, fontFamily: "Athiti-Bold", letterSpacing: 0.2 },
  hint: { marginTop: 14, fontSize: 11, fontFamily: "Athiti-Regular", lineHeight: 16 },
});
