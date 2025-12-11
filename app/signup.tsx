// app/signup.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import {
    createUserWithEmailAndPassword,
    sendEmailVerification,
} from "firebase/auth";
import React, { useRef, useState } from "react";
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
import { themes } from "../constants/appTheme";
import { firebaseAuth } from "../firebaseConfig";

const USER_STORAGE_KEY = "EJT_USER_SESSION";

export default function SignupScreen() {
  const router = useRouter();
  const [themeName] = useState<"dark" | "light" | "midnight">("dark");
  const theme = themes[themeName] ?? themes.dark;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"owner" | "employee" | "independent">(
    "independent"
  );
  const [loading, setLoading] = useState(false);

  const accentColor = theme.tagOpenBorder;
  const buttonScale = useRef(new Animated.Value(1)).current;

  const animateScale = (val: number) => {
    Animated.spring(buttonScale, {
      toValue: val,
      friction: 5,
      tension: 150,
      useNativeDriver: true,
    }).start();
  };

  /* -------------------------------------------------------- */
  /* SIGNUP WITH FIREBASE AUTH + EMAIL VERIFICATION           */
  /* -------------------------------------------------------- */
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

      // Try sending verification email
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

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.screenBackground }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.inner}>
          <Text style={[styles.headerText, { color: theme.textPrimary }]}>
            Create Account
          </Text>

          {/* Name */}
          <View style={[styles.inputBlock, { borderColor: theme.inputBorder }]}>
            <Ionicons name="person-outline" size={18} color={theme.textMuted} />
            <TextInput
              style={[styles.input, { color: theme.textPrimary }]}
              placeholder="Full name..."
              placeholderTextColor={theme.textMuted}
              value={name}
              onChangeText={setName}
            />
          </View>

          {/* Email */}
          <View style={[styles.inputBlock, { borderColor: theme.inputBorder }]}>
            <Ionicons name="mail-outline" size={18} color={theme.textMuted} />
            <TextInput
              style={[styles.input, { color: theme.textPrimary }]}
              placeholder="Email..."
              placeholderTextColor={theme.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          {/* Password */}
          <View style={[styles.inputBlock, { borderColor: theme.inputBorder }]}>
            <Ionicons
              name="lock-closed-outline"
              size={18}
              color={theme.textMuted}
            />
            <TextInput
              style={[styles.input, { color: theme.textPrimary }]}
              placeholder="Password..."
              placeholderTextColor={theme.textMuted}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>

          {/* Roles */}
          <Text style={[styles.label, { color: theme.textMuted }]}>
            Select Role
          </Text>

          <View style={styles.roleRow}>
            {(["owner", "employee", "independent"] as const).map((option) => (
              <TouchableOpacity
                key={option}
                onPress={() => setRole(option)}
                activeOpacity={0.9}
                style={[
                  styles.rolePill,
                  role === option && {
                    borderColor: accentColor,
                    borderWidth: 2,
                  },
                ]}
              >
                <Text
                  style={{
                    color: theme.textPrimary,
                    fontSize: 14,
                    fontWeight: "700",
                  }}
                >
                  {option === "owner"
                    ? "Company Owner"
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
                styles.signupButton,
                { backgroundColor: accentColor, opacity: loading ? 0.7 : 1 },
              ]}
              onPress={handleSignup}
              onPressIn={() => animateScale(0.95)}
              onPressOut={() => animateScale(1)}
              disabled={loading}
            >
              <Text
                style={[
                  styles.signupButtonText,
                  { color: theme.primaryButtonText },
                ]}
              >
                {loading ? "Creating..." : "Create Now"}
              </Text>
            </TouchableOpacity>
          </Animated.View>

          <TouchableOpacity onPress={() => router.back()}>
            <Text style={[styles.footerLink, { color: theme.textMuted }]}>
              ← Back to Login
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  inner: { width: "100%", gap: 12 },
  headerText: {
    fontSize: 26,
    fontWeight: "900",
    marginBottom: 6,
    textAlign: "center",
  },
  inputBlock: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(31,41,55,0.3)",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
    borderWidth: 1,
  },
  input: { flex: 1, fontSize: 15 },
  label: { fontSize: 13, fontWeight: "700", textAlign: "center" },
  roleRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  rolePill: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: "center",
  },
  signupButton: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: "center",
  },
  signupButtonText: { fontSize: 16, fontWeight: "800" },
  footerLink: {
    textAlign: "center",
    marginTop: 6,
    fontSize: 14,
    fontWeight: "700",
  },
});
