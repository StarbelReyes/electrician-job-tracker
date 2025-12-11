// app/forgot-password.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { sendPasswordResetEmail } from "firebase/auth";
import React, { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
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
import {
    ACCENT_STORAGE_KEY,
    AccentName,
    THEME_STORAGE_KEY,
    ThemeName,
    accentSwatchColors,
    themes,
} from "../constants/appTheme";
import { firebaseAuth } from "../firebaseConfig";

export default function ForgotPasswordScreen() {
  const router = useRouter();

  // THEME
  const [themeName, setThemeName] = useState<ThemeName>("dark");
  const theme = themes[themeName];

  // ACCENT
  const [accentName, setAccentName] = useState<AccentName>("jobsiteAmber");
  const accentColor =
    accentSwatchColors[accentName] || theme.primaryButtonBackground;

  const [isBooting, setIsBooting] = useState(true);

  // FORM
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Screen zoom animation (match other screens vibe)
  const screenScale = useRef(new Animated.Value(1.04)).current;

  useEffect(() => {
    Animated.timing(screenScale, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [screenScale]);

  // Load theme + accent on mount
  useEffect(() => {
    const loadThemeAndAccent = async () => {
      try {
        const [themeSaved, accentSaved] = await Promise.all([
          AsyncStorage.getItem(THEME_STORAGE_KEY),
          AsyncStorage.getItem(ACCENT_STORAGE_KEY),
        ]);

        if (
          themeSaved === "light" ||
          themeSaved === "dark" ||
          themeSaved === "midnight"
        ) {
          setThemeName(themeSaved as ThemeName);
        }

        if (
          accentSaved === "jobsiteAmber" ||
          accentSaved === "electricBlue" ||
          accentSaved === "neonGreen"
        ) {
          setAccentName(accentSaved as AccentName);
        }
      } catch (err) {
        console.warn("Failed to load theme/accent for forgot-password:", err);
      } finally {
        setIsBooting(false);
      }
    };

    loadThemeAndAccent();
  }, []);

  const handleSubmit = async () => {
    const trimmed = email.trim().toLowerCase();

    if (!trimmed) {
      Alert.alert(
        "Email required",
        "Enter the email you use with Traktr so we can send a reset link."
      );
      return;
    }

    setIsSubmitting(true);

    try {
      // ✅ Use Firebase directly instead of Node server
      await sendPasswordResetEmail(firebaseAuth, trimmed);

      Alert.alert(
        "Reset link sent",
        `If an account exists for ${trimmed}, a password reset email has been sent.\n\nIf you don't see it, check your spam or junk folder.`,
        [
          {
            text: "OK",
            onPress: () => {
              router.replace("/login");
            },
          },
        ]
      );
    } catch (err: any) {
      console.warn("Forgot password error:", err);

      let message =
        "Could not send reset email. Please check the address and try again.";

      if (err?.code === "auth/invalid-email") {
        message = "That email address looks invalid.";
      } else if (err?.code === "auth/user-not-found") {
        message = "No account exists with that email.";
      }

      Alert.alert("Forgot password", message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackToLogin = () => {
    router.replace("/login");
  };

  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  if (isBooting) {
    return (
      <View
        style={[
          styles.loadingContainer,
          { backgroundColor: theme.screenBackground },
        ]}
      >
        <ActivityIndicator color={accentColor} />
        <Text style={[styles.loadingText, { color: theme.textMuted }]}>
          Loading…
        </Text>
      </View>
    );
  }

  const canSubmit = email.trim().length > 0 && !isSubmitting;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.screenBackground }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <TouchableWithoutFeedback onPress={dismissKeyboard}>
        <Animated.View
          style={[
            styles.screen,
            {
              backgroundColor: theme.screenBackground + "F2",
              transform: [{ scale: screenScale }],
            },
          ]}
        >
          {/* Header */}
          <View style={styles.headerShell}>
            <View
              style={[
                styles.headerRow,
                {
                  backgroundColor: theme.cardBackground + "E6",
                  borderColor: theme.cardBorder + "55",
                },
              ]}
            >
              <View style={styles.headerLeft}>
                <View
                  style={[
                    styles.headerIconBadge,
                    {
                      borderColor: accentColor + "80",
                      backgroundColor: accentColor + "1A",
                    },
                  ]}
                >
                  <Ionicons
                    name="key-outline"
                    size={18}
                    color={accentColor}
                  />
                </View>
                <Text
                  style={[
                    styles.headerTitle,
                    { color: theme.headerText },
                  ]}
                >
                  Reset password
                </Text>
              </View>
            </View>
          </View>

          {/* Body */}
          <View style={styles.body}>
            <Text
              style={[
                styles.subtitle,
                { color: theme.textMuted },
              ]}
            >
              Enter the email you use with Traktr and we’ll send you a link to
              reset your password.
            </Text>

            {/* Email input */}
            <View
              style={[
                styles.inputShell,
                {
                  backgroundColor: theme.cardBackground + "F2",
                  borderColor: theme.cardBorder + "66",
                },
              ]}
            >
              <View style={styles.inputRow}>
                <Ionicons
                  name="mail-outline"
                  size={18}
                  color={theme.textMuted}
                  style={{ marginRight: 8 }}
                />
                <TextInput
                  style={[
                    styles.textInput,
                    { color: theme.inputText },
                  ]}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor={theme.textMuted}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  returnKeyType="send"
                  onSubmitEditing={canSubmit ? handleSubmit : undefined}
                />
              </View>
            </View>

            {/* Send button */}
            <TouchableOpacity
              style={[
                styles.primaryButton,
                {
                  backgroundColor: canSubmit
                    ? accentColor
                    : accentColor + "55",
                  shadowColor: accentColor,
                },
              ]}
              onPress={handleSubmit}
              activeOpacity={0.85}
              disabled={!canSubmit}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  Send reset link
                </Text>
              )}
            </TouchableOpacity>

            {/* Info text */}
            <Text
              style={[
                styles.infoText,
                { color: theme.textMuted },
              ]}
            >
              If you don’t see the email, check your spam or junk folder. Make
              sure you’re using the same email you used when signing up.
            </Text>

            {/* Back to login */}
            <TouchableOpacity
              onPress={handleBackToLogin}
              style={styles.backRow}
              activeOpacity={0.8}
            >
              <Ionicons
                name="arrow-back-outline"
                size={16}
                color={accentColor}
                style={{ marginRight: 4 }}
              />
              <Text
                style={[
                  styles.backText,
                  { color: accentColor },
                ]}
              >
                Back to login
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingTop: 48,
    paddingHorizontal: 16,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
  },

  headerShell: {
    paddingBottom: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerIconBadge: {
    width: 30,
    height: 30,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },

  body: {
    marginTop: 16,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },

  inputShell: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  textInput: {
    flex: 1,
    fontSize: 14,
  },

  primaryButton: {
    marginTop: 8,
    borderRadius: 999,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#000",
  },

  infoText: {
    fontSize: 11,
    marginTop: 10,
    lineHeight: 15,
  },

  backRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 18,
  },
  backText: {
    fontSize: 13,
    fontWeight: "600",
  },
});
