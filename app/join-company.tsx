// app/join-company.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { usePreferences } from "../context/PreferencesContext";
import { db, firebaseAuth } from "../firebaseConfig";

const USER_STORAGE_KEY = "EJT_USER_SESSION";

type Session = {
  uid: string;
  email?: string | null;
  name?: string;
  role?: "owner" | "employee" | "independent";
  companyId?: string | null;
  provider?: string;
  createdAt?: string;
};

function normalizeJoinCode(raw: string) {
  return raw.trim().toUpperCase();
}

export default function JoinCompanyScreen() {
  const router = useRouter();
  const { isReady, theme, accentColor } = usePreferences();

  const [authReady, setAuthReady] = useState(false);
  const [uid, setUid] = useState<string | null>(null);

  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState(false);

  const buttonScale = useRef(new Animated.Value(1)).current;
  const animateScale = (val: number) => {
    Animated.spring(buttonScale, {
      toValue: val,
      friction: 6,
      tension: 160,
      useNativeDriver: true,
    }).start();
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(firebaseAuth, (user) => {
      setUid(user?.uid ?? null);
      setAuthReady(true);
      // ✅ No auto-redirect here (avoid loops)
    });
    return () => unsub();
  }, []);

  const canSubmit = useMemo(() => {
    return normalizeJoinCode(joinCode).length >= 6 && !loading;
  }, [joinCode, loading]);

  const handleHelp = () => {
    Alert.alert(
      "Need help?",
      "The join code comes from your company owner.\n\n• Ask your owner for the join code\n• Make sure you typed it exactly (example: TRAKTR-5821)\n\nIf you don’t have a code yet, you can’t continue as an employee until you join a company.",
      [
        { text: "OK" },
        {
          text: "Go to Login",
          onPress: () => router.replace("/login"),
          style: "default",
        },
      ]
    );
  };

  const handleJoin = async () => {
    if (!uid) {
      Alert.alert("Not logged in", "Please log in first.");
      router.replace("/login");
      return;
    }

    const code = normalizeJoinCode(joinCode);
    if (!code)
      return Alert.alert("Missing code", "Enter your company join code.");
    if (loading) return;

    setLoading(true);

    try {
      const qref = query(
        collection(db, "companies"),
        where("joinCode", "==", code)
      );
      const snap = await getDocs(qref);

      if (snap.empty) {
        setLoading(false);
        return Alert.alert(
          "Not found",
          "That join code was not found. Check the code and try again."
        );
      }

      const companyDoc = snap.docs[0];
      const companyId = companyDoc.id;
      const companyName = (companyDoc.data() as any)?.name ?? "Company";

      // companies/{companyId}/employees/{uid}
      const employeeRef = doc(db, "companies", companyId, "employees", uid);
      await setDoc(employeeRef, { joinedAt: serverTimestamp() }, { merge: true });


      // users/{uid}
      const userRef = doc(db, "users", uid);
      await updateDoc(userRef, {
        companyId,
        updatedAt: serverTimestamp(),
      });

      // update local session
      const stored = await AsyncStorage.getItem(USER_STORAGE_KEY);
      let session: Session | null = null;
      if (stored) {
        try {
          session = JSON.parse(stored);
        } catch {
          session = null;
        }
      }

      const nextSession: Session = {
        ...(session ?? {}),
        uid,
        companyId,
        role: "employee",
      };

      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(nextSession));

      setLoading(false);

      Alert.alert("Joined", `You joined ${companyName}.`, [
        { text: "Continue", onPress: () => router.replace("/home") },
      ]);
    } catch (err) {
      console.warn("Join company error:", err);
      setLoading(false);
      Alert.alert("Error", "Could not join the company. Please try again.");
    }
  };

  if (!isReady || !authReady) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme?.screenBackground ?? "#0F1115",
        }}
      />
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.screenBackground }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <View style={{ flex: 1, backgroundColor: theme.screenBackground }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[
            styles.screen,
            { backgroundColor: theme.screenBackground },
          ]}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="on-drag"
        >
          <View style={styles.headerRow}>
            <Text style={[styles.appTitle, { color: theme.headerText }]}>
              THE TRAKTR APP
            </Text>
          </View>

          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.cardBackground + "F2",
                borderColor: theme.cardBorder + "77",
              },
            ]}
          >
            <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>
              Join a company
            </Text>
            <Text style={[styles.cardSubtitle, { color: theme.textMuted }]}>
              Enter the join code your owner gave you (example: TRAKTR-5821).
            </Text>

            <Text style={[styles.label, { color: theme.textMuted }]}>
              Join code
            </Text>
            <View
              style={[
                styles.inputShell,
                {
                  backgroundColor: theme.inputBackground + "F2",
                  borderColor: theme.inputBorder,
                },
              ]}
            >
              <TextInput
                style={[styles.input, { color: theme.inputText }]}
                placeholder="TRAKTR-5821"
                placeholderTextColor={theme.textMuted}
                value={joinCode}
                onChangeText={setJoinCode}
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!loading}
              />
            </View>

            <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  {
                    backgroundColor: accentColor,
                    opacity: canSubmit ? 1 : 0.6,
                    shadowColor: accentColor,
                  },
                ]}
                onPress={handleJoin}
                onPressIn={() => animateScale(0.96)}
                onPressOut={() => animateScale(1)}
                activeOpacity={0.9}
                disabled={!canSubmit}
              >
                <Text
                  style={[
                    styles.primaryButtonText,
                    { color: theme.primaryButtonText },
                  ]}
                >
                  {loading ? "Joining..." : "Join company"}
                </Text>
              </TouchableOpacity>
            </Animated.View>

            {/* ✅ Help action */}
            <TouchableOpacity
              onPress={handleHelp}
              activeOpacity={0.85}
              disabled={loading}
              style={[
                styles.helpButton,
                {
                  borderColor: theme.cardBorder + "99",
                  backgroundColor: theme.cardBackground + "66",
                },
              ]}
            >
              <Text style={[styles.helpText, { color: theme.textMuted }]}>
                Need help? I don’t have a join code
              </Text>
            </TouchableOpacity>

            {/* ✅ Back to Login (always available) */}
            <TouchableOpacity
              onPress={() => router.replace("/login")}
              activeOpacity={0.85}
              disabled={loading}
              style={styles.backToLoginButton}
            >
              <Text style={[styles.backToLoginText, { color: theme.textMuted }]}>
                Back to login
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flexGrow: 1,
    paddingTop: 48,
    paddingHorizontal: 18,
  },
  headerRow: {
    marginBottom: 12,
  },
  appTitle: {
    fontSize: 22,
    fontWeight: "700",
  },
  card: {
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 18,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 12,
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
  },
  inputShell: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    fontSize: 14,
  },
  primaryButton: {
    marginTop: 4,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: "700",
  },

  helpButton: {
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  helpText: {
    fontSize: 13,
    fontWeight: "700",
    textDecorationLine: "underline",
  },

  backToLoginButton: {
    marginTop: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },
  backToLoginText: {
    fontSize: 13,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
});
