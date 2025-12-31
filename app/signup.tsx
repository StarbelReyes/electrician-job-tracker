// app/signup.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
} from "firebase/auth";
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
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import {
  ACCENT_STORAGE_KEY,
  AccentName,
  getAccentColor,
  THEME_STORAGE_KEY,
  ThemeName,
  themes,
} from "../constants/appTheme";
import { db, firebaseAuth } from "../firebaseConfig";

const USER_STORAGE_KEY = "EJT_USER_SESSION";

type Role = "owner" | "employee" | "independent";

function pad4(n: number) {
  return String(n).padStart(4, "0");
}

function makeJoinCode(): string {
  // TRAKTR-1234 style
  const num = Math.floor(Math.random() * 10000);
  return `TRAKTR-${pad4(num)}`;
}

async function ensureUniqueJoinCode(maxAttempts = 6): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const code = makeJoinCode().toUpperCase();

    const qref = query(
      collection(db, "companies"),
      where("joinCode", "==", code)
    );

    const snap = await getDocs(qref);
    if (snap.empty) return code;
  }

  // Extremely unlikely fallback: include more digits
  const num = Math.floor(Math.random() * 1000000);
  return `TRAKTR-${String(num).padStart(6, "0")}`.toUpperCase();
}

function isValidEmail(e: string) {
  return /^\S+@\S+\.\S+$/.test(e);
}

export default function SignupScreen() {
  const router = useRouter();

  // ✅ Same as index.tsx: avoid typed-route errors if TS hasn't included a new route yet
  const go = (path: string) => router.replace(path as any);

  // THEME + ACCENT
  const [themeName, setThemeName] = useState<ThemeName>("dark");
  const [accentName, setAccentName] = useState<AccentName>("jobsiteAmber");
  const theme = themes[themeName] ?? themes.dark;
  const accentColor = getAccentColor(accentName);

  useEffect(() => {
    const loadThemeAndAccent = async () => {
      try {
        const [savedTheme, savedAccent] = await Promise.all([
          AsyncStorage.getItem(THEME_STORAGE_KEY),
          AsyncStorage.getItem(ACCENT_STORAGE_KEY),
        ]);

        if (
          savedTheme === "light" ||
          savedTheme === "dark" ||
          savedTheme === "midnight" ||
          savedTheme === "graphite"
        ) {
          setThemeName(savedTheme as ThemeName);
        }

        if (
          savedAccent === "jobsiteAmber" ||
          savedAccent === "electricBlue" ||
          savedAccent === "safetyGreen"
        ) {
          setAccentName(savedAccent as AccentName);
        }
      } catch (err) {
        console.warn("Failed to load theme/accent for signup:", err);
      }
    };

    loadThemeAndAccent();
  }, []);

  // FORM STATE
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(""); // ✅ do NOT trim passwords
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("independent");
  const [businessName, setBusinessName] = useState(""); // ✅ owners only
  const [loading, setLoading] = useState(false);

  const buttonScale = useRef(new Animated.Value(1)).current;
  const animateScale = (val: number) => {
    Animated.spring(buttonScale, {
      toValue: val,
      friction: 5,
      tension: 150,
      useNativeDriver: true,
    }).start();
  };

  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  const handleSignup = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim();
    const trimmedBusiness = businessName.trim();

    // ✅ validations (don’t trim password)
    if (!trimmedName || !trimmedEmail || !password) {
      return Alert.alert("Error", "All fields are required.");
    }

    if (!isValidEmail(trimmedEmail)) {
      return Alert.alert("Error", "That email address looks invalid.");
    }

    if (password.length < 6) {
      return Alert.alert("Weak password", "Password must be at least 6 characters.");
    }

    if (role === "owner" && !trimmedBusiness) {
      return Alert.alert("Error", "Business name is required for company owners.");
    }

    if (loading) return;
    setLoading(true);

    try {
      const cred = await createUserWithEmailAndPassword(
        firebaseAuth,
        trimmedEmail,
        password
      );

      const user = cred.user;

      // Fire and forget — don’t block signup if email send fails
      sendEmailVerification(user).catch((err) =>
        console.warn("Email verification send error:", err)
      );

      // ✅ Create user profile in Firestore (source of truth for role/company)
      const userRef = doc(db, "users", user.uid);

      // We'll set companyId below if owner creates one
      let companyId: string | null = null;

      await setDoc(
        userRef,
        {
          uid: user.uid,
          email: user.email ?? trimmedEmail,
          name: trimmedName,
          role,
          companyId: null,

          // ✅ NEW: first-time gating flag
          profileComplete: role === "owner" ? true : false,

          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // ✅ If owner: create company + join code, then attach to user profile
      if (role === "owner") {
        const joinCode = await ensureUniqueJoinCode();
        const companyRef = doc(collection(db, "companies"));
        companyId = companyRef.id;

        await setDoc(companyRef, {
          name: trimmedBusiness,
          ownerUid: user.uid,
          joinCode,
          createdAt: serverTimestamp(),
        });

        await updateDoc(userRef, {
          companyId,
          updatedAt: serverTimestamp(),
        });
      }

      // ✅ Store local session (includes role + companyId)
      const session = {
        uid: user.uid,
        email: user.email ?? trimmedEmail,
        name: trimmedName,
        role,
        companyId,
        provider: "firebase-email",
        createdAt: new Date().toISOString(),
      };

      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(session));

      // ✅ NEW: route rules after signup
      const nextRoute =
        role === "owner"
          ? "/home"
          : "/profile-setup"; // employee + independent must set name/photo

      Alert.alert(
        "Account Created",
        `Welcome, ${trimmedName}!\n\nWe sent a verification link to ${trimmedEmail}. Please confirm your email before logging in on a new device.`,
        [{ text: "Continue", onPress: () => go(nextRoute) }]
      );
    } catch (err: any) {
      console.warn("Firebase signup error:", err);

      let message = "Could not create your account. Please try again.";

      if (err?.code === "auth/email-already-in-use") {
        message = "That email is already in use. Try logging in instead.";
      } else if (err?.code === "auth/invalid-email") {
        message = "That email address looks invalid.";
      } else if (err?.code === "auth/weak-password") {
        message = "Password is too weak. Use at least 6 characters.";
      }

      Alert.alert("Signup Failed", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.screenBackground }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <TouchableWithoutFeedback onPress={dismissKeyboard} accessible={false}>
        <View style={[styles.screen, { backgroundColor: theme.screenBackground }]}>
          {/* App header */}
          <View style={styles.headerRow}>
            <Text style={[styles.appTitle, { color: theme.headerText }]}>
              THE TRAKTR APP
            </Text>
          </View>

          {/* Auth card */}
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
              Create account
            </Text>
            <Text style={[styles.cardSubtitle, { color: theme.textMuted }]}>
              Set up your Traktr account and choose how you work.
            </Text>

            {/* Name */}
            <View
              style={[
                styles.inputShell,
                {
                  backgroundColor: theme.inputBackground + "F2",
                  borderColor: theme.inputBorder,
                },
              ]}
            >
              <Ionicons
                name="person-outline"
                size={18}
                color={theme.textMuted}
                style={{ marginRight: 8 }}
              />
              <TextInput
                style={[styles.input, { color: theme.inputText }]}
                placeholder="Full name"
                placeholderTextColor={theme.textMuted}
                value={name}
                onChangeText={setName}
                editable={!loading}
              />
            </View>

            {/* Email */}
            <View
              style={[
                styles.inputShell,
                {
                  backgroundColor: theme.inputBackground + "F2",
                  borderColor: theme.inputBorder,
                },
              ]}
            >
              <Ionicons
                name="mail-outline"
                size={18}
                color={theme.textMuted}
                style={{ marginRight: 8 }}
              />
              <TextInput
                style={[styles.input, { color: theme.inputText }]}
                placeholder="Email"
                placeholderTextColor={theme.textMuted}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!loading}
              />
            </View>

            {/* Password */}
            <View
              style={[
                styles.inputShell,
                {
                  backgroundColor: theme.inputBackground + "F2",
                  borderColor: theme.inputBorder,
                },
              ]}
            >
              <Ionicons
                name="lock-closed-outline"
                size={18}
                color={theme.textMuted}
                style={{ marginRight: 8 }}
              />
              <TextInput
                style={[styles.input, { color: theme.inputText }]}
                placeholder="Password (min 6 chars)"
                placeholderTextColor={theme.textMuted}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                editable={!loading}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword((p) => !p)}
                activeOpacity={0.7}
                disabled={loading}
              >
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color={theme.textMuted}
                />
              </TouchableOpacity>
            </View>

            {/* Role selector */}
            <Text style={[styles.label, { color: theme.textMuted }]}>
              Select role
            </Text>
            <View style={styles.roleRow}>
              {(["owner", "employee", "independent"] as const).map((option) => (
                <TouchableOpacity
                  key={option}
                  onPress={() => setRole(option)}
                  activeOpacity={0.9}
                  disabled={loading}
                  style={[
                    styles.rolePill,
                    {
                      borderColor: role === option ? accentColor : theme.cardBorder,
                      backgroundColor:
                        role === option
                          ? accentColor + "1A"
                          : theme.cardBackground + "F2",
                      opacity: loading ? 0.8 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.rolePillText,
                      { color: role === option ? accentColor : theme.textPrimary },
                    ]}
                  >
                    {option === "owner"
                      ? "Company owner"
                      : option === "employee"
                      ? "Employee"
                      : "Independent"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* ✅ Business name (owners only) */}
            {role === "owner" && (
              <>
                <Text style={[styles.label, { color: theme.textMuted }]}>
                  Business name
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
                  <Ionicons
                    name="business-outline"
                    size={18}
                    color={theme.textMuted}
                    style={{ marginRight: 8 }}
                  />
                  <TextInput
                    style={[styles.input, { color: theme.inputText }]}
                    placeholder="Your business name"
                    placeholderTextColor={theme.textMuted}
                    value={businessName}
                    onChangeText={setBusinessName}
                    editable={!loading}
                  />
                </View>
              </>
            )}

            {/* Submit button */}
            <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  {
                    backgroundColor: accentColor,
                    opacity: loading ? 0.7 : 1,
                    shadowColor: accentColor,
                  },
                ]}
                onPress={handleSignup}
                onPressIn={() => animateScale(0.96)}
                onPressOut={() => animateScale(1)}
                activeOpacity={0.9}
                disabled={loading}
              >
                <Text
                  style={[
                    styles.primaryButtonText,
                    { color: theme.primaryButtonText },
                  ]}
                >
                  {loading ? "Creating..." : "Create account"}
                </Text>
              </TouchableOpacity>
            </Animated.View>

            {/* Back to login */}
            <TouchableOpacity onPress={() => router.back()} activeOpacity={0.8} disabled={loading}>
              <Text style={[styles.footerLink, { color: theme.textMuted }]}>
                Already have an account? Log in
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

  inputShell: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
  },
  eyeButton: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },

  label: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
  },
  roleRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  rolePill: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 9,
    alignItems: "center",
  },
  rolePillText: {
    fontSize: 12,
    fontWeight: "700",
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
