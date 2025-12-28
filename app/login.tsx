// app/login.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  ScrollView,
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

type UserProfile = {
  uid?: string;
  email?: string;
  name?: string;
  role?: Role;
  companyId?: string | null;
};

export default function LoginScreen() {
  const router = useRouter();

  // THEME + ACCENT (match Home + Settings)
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
        console.warn("Failed to load theme/accent for login:", err);
      }
    };

    loadThemeAndAccent();
  }, []);

  // FORM STATE
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Small button animation
  const buttonScale = useRef(new Animated.Value(1)).current;
  const animate = (v: number) => {
    Animated.spring(buttonScale, {
      toValue: v,
      tension: 160,
      friction: 5,
      useNativeDriver: true,
    }).start();
  };

  const handleLoginPress = async () => {
    const trimmedEmail = email.trim();
    const rawPassword = password; // ✅ DO NOT trim password

    if (!trimmedEmail || !rawPassword) {
      return Alert.alert("Error", "Please fill in all fields.");
    }
    if (loading) return;

    setLoading(true);

    try {
      const cred = await signInWithEmailAndPassword(
        firebaseAuth,
        trimmedEmail,
        rawPassword
      );

      const user = cred.user;

      // Fetch Firestore profile (source of truth for role + company)
      let profile: UserProfile | null = null;
      try {
        // ✅ This assumes user doc id == uid.
        // If your schema doesn't do that, this will NOT find the profile.
        const userRef = doc(db, "users", user.uid);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          profile = (snap.data() as UserProfile) ?? null;
        }
      } catch (err) {
        console.warn("Failed to fetch user profile:", err);
        profile = null;
      }

      const role = (profile?.role ?? "independent") as Role;
      const companyId =
        typeof profile?.companyId === "string" ? profile!.companyId : null;

      const session = {
        uid: user.uid,
        email: user.email ?? trimmedEmail,
        name: profile?.name ?? "",
        role,
        companyId,
        provider: "firebase-email",
        loggedInAt: new Date().toISOString(),
      };

      console.log("[LOGIN] saving session =>", session);

      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(session));

      const nextRoute =
        role === "employee" && !companyId ? "/join-company" : "/home";

      Alert.alert("Success", `Welcome back, ${user.email ?? "electrician"}!`, [
        { text: "Continue", onPress: () => router.replace(nextRoute) },
      ]);
    } catch (err: any) {
      console.warn("Firebase login error:", err);

      let message = "Could not log in. Please try again.";

      if (err?.code === "auth/invalid-email") {
        message = "That email address looks invalid.";
      } else if (err?.code === "auth/user-not-found") {
        message = "No account exists with that email.";
      } else if (err?.code === "auth/wrong-password") {
        message = "Incorrect password. Try again.";
      } else if (err?.code === "auth/too-many-requests") {
        message = "Too many attempts. Please wait a bit and try again.";
      }

      Alert.alert("Login failed", message);
    } finally {
      setLoading(false); // ✅ always stop loading
    }
  };

  const isBusy = loading;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: theme.screenBackground }}
      keyboardVerticalOffset={0}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={{ flex: 1, backgroundColor: theme.screenBackground }}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[
              styles.screen,
              { backgroundColor: theme.screenBackground },
            ]}
            keyboardShouldPersistTaps="handled"
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
                Welcome back
              </Text>
              <Text style={[styles.cardSubtitle, { color: theme.textMuted }]}>
                Log in to keep tracking your jobs, notes, and photos.
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
                  returnKeyType="next"
                  editable={!isBusy}
                />
              </View>

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
                  placeholder="Password"
                  placeholderTextColor={theme.textMuted}
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                  returnKeyType="done"
                  onSubmitEditing={handleLoginPress}
                  editable={!isBusy}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPassword((prev) => !prev)}
                  activeOpacity={0.7}
                  disabled={isBusy}
                >
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color={theme.textMuted}
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.linksRow}>
                <TouchableOpacity
                  onPress={() => router.push("/forgot-password")}
                  disabled={isBusy}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.linkTextSmall, { color: theme.textMuted }]}>
                    Forgot password?
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => router.push("/signup")}
                  disabled={isBusy}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.linkTextSmall, { color: theme.textMuted }]}>
                    Create an account
                  </Text>
                </TouchableOpacity>
              </View>

              <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    {
                      backgroundColor: accentColor,
                      opacity: isBusy ? 0.7 : 1,
                      shadowColor: accentColor,
                    },
                  ]}
                  onPress={handleLoginPress}
                  onPressIn={() => animate(0.96)}
                  onPressOut={() => animate(1)}
                  activeOpacity={0.9}
                  disabled={isBusy}
                >
                  <Text
                    style={[
                      styles.primaryButtonText,
                      { color: theme.primaryButtonText },
                    ]}
                  >
                    {loading ? "Logging in..." : "Continue"}
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
          </ScrollView>
        </View>
      </TouchableWithoutFeedback>
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
  linksRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
    marginBottom: 10,
  },
  linkTextSmall: {
    fontSize: 12,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  primaryButton: {
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: "700",
  },
});
