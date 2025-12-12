// app/signup.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
} from "firebase/auth";
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
import { firebaseAuth } from "../firebaseConfig";

const USER_STORAGE_KEY = "EJT_USER_SESSION";

export default function SignupScreen() {
  const router = useRouter();

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
          savedTheme === "midnight"
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
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"owner" | "employee" | "independent">(
    "independent"
  );
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

  const handleSignup = async () => {
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    const trimmedName = name.trim();

    if (!trimmedName || !trimmedEmail || !trimmedPassword) {
      return Alert.alert("Error", "All fields are required.");
    }

    if (trimmedPassword.length < 6) {
      return Alert.alert(
        "Weak password",
        "Password must be at least 6 characters."
      );
    }

    if (loading) return;
    setLoading(true);

    try {
      const cred = await createUserWithEmailAndPassword(
        firebaseAuth,
        trimmedEmail,
        trimmedPassword
      );

      const user = cred.user;

      try {
        await sendEmailVerification(user);
      } catch (err) {
        console.warn("Email verification send error:", err);
      }

      const session = {
        uid: user.uid,
        email: user.email,
        name: trimmedName,
        role,
        provider: "firebase-email",
        createdAt: new Date().toISOString(),
      };

      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(session));

      setLoading(false);

      Alert.alert(
        "Account Created",
        `Welcome, ${trimmedName}!\n\nWe sent a verification link to ${trimmedEmail}. Please confirm your email before logging in on a new device.`,
        [{ text: "Continue", onPress: () => router.replace("/home") }]
      );
    } catch (err: any) {
      console.warn("Firebase signup error:", err);
      setLoading(false);

      let message = "Could not create your account. Please try again.";

      if (err?.code === "auth/email-already-in-use") {
        message = "That email is already in use. Try logging in instead.";
      } else if (err?.code === "auth/invalid-email") {
        message = "That email address looks invalid.";
      } else if (err?.code === "auth/weak-password") {
        message = "Password is too weak. Use at least 6 characters.";
      }

      Alert.alert("Signup Failed", message);
    }
  };

  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.screenBackground }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <TouchableWithoutFeedback onPress={dismissKeyboard} accessible={false}>
        <View
          style={[
            styles.screen,
            { backgroundColor: theme.screenBackground },
          ]}
        >
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
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
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
                  style={[
                    styles.rolePill,
                    {
                      borderColor:
                        role === option ? accentColor : theme.cardBorder,
                      backgroundColor:
                        role === option
                          ? accentColor + "1A"
                          : theme.cardBackground + "F2",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.rolePillText,
                      {
                        color:
                          role === option
                            ? accentColor
                            : theme.textPrimary,
                      },
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
            <TouchableOpacity onPress={() => router.back()} activeOpacity={0.8}>
              <Text
                style={[
                  styles.footerLink,
                  { color: theme.textMuted },
                ]}
              >
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
