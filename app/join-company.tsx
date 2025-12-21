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
    updateDoc,
    where,
} from "firebase/firestore";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    Alert,
    Animated,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
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
      if (!user) {
        // Not logged in → must authenticate first
        router.replace("/login");
      }
    });
    return () => unsub();
  }, [router]);

  const canSubmit = useMemo(() => {
    return normalizeJoinCode(joinCode).length >= 6 && !loading;
  }, [joinCode, loading]);

  const handleJoin = async () => {
    if (!uid) return;
    const code = normalizeJoinCode(joinCode);

    if (!code) return Alert.alert("Missing code", "Enter your company join code.");

    if (loading) return;
    setLoading(true);

    try {
      // Find company by joinCode
      const qref = query(collection(db, "companies"), where("joinCode", "==", code));
      const snap = await getDocs(qref);

      if (snap.empty) {
        setLoading(false);
        return Alert.alert("Not found", "That join code was not found. Check the code and try again.");
      }

      // If multiple match (shouldn’t happen), take the first
      const companyDoc = snap.docs[0];
      const companyId = companyDoc.id;
      const companyName = (companyDoc.data() as any)?.name ?? "Company";

      // Attach companyId to user profile
      const userRef = doc(db, "users", uid);
      await updateDoc(userRef, {
        companyId,
        updatedAt: serverTimestamp(),
      });

      // Update local session so index/home routing works immediately
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
        role: (session?.role ?? "employee") as any,
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

  const dismissKeyboard = () => Keyboard.dismiss();

  // Wait for theme + auth check (prevents flash)
  if (!isReady || !authReady) {
    return <View style={{ flex: 1, backgroundColor: theme?.screenBackground ?? "#0F1115" }} />;
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.screenBackground }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <TouchableWithoutFeedback onPress={dismissKeyboard} accessible={false}>
        <View style={[styles.screen, { backgroundColor: theme.screenBackground }]}>
          <View style={styles.headerRow}>
            <Text style={[styles.appTitle, { color: theme.headerText }]}>THE TRAKTR APP</Text>
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
            <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Join a company</Text>
            <Text style={[styles.cardSubtitle, { color: theme.textMuted }]}>
              Enter the join code your owner gave you (example: TRAKTR-5821).
            </Text>

            <Text style={[styles.label, { color: theme.textMuted }]}>Join code</Text>
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
                <Text style={[styles.primaryButtonText, { color: theme.primaryButtonText }]}>
                  {loading ? "Joining..." : "Join company"}
                </Text>
              </TouchableOpacity>
            </Animated.View>

            <TouchableOpacity onPress={() => router.replace("/home")} activeOpacity={0.8}>
              <Text style={[styles.footerLink, { color: theme.textMuted }]}>
                I’ll do this later
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
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
  footerLink: {
    textAlign: "center",
    marginTop: 10,
    fontSize: 13,
    fontWeight: "600",
  },
});
