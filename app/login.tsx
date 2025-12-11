// app/login.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
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

export default function LoginScreen() {
  const router = useRouter();
  const [themeName] = useState<"dark" | "light" | "midnight">("dark");
  const theme = themes[themeName] ?? themes.dark;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

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
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      return Alert.alert("Error", "Please fill in all fields.");
    }
    if (loading) return;
    setLoading(true);

    try {
      // 🔐 Firebase email/password sign-in
      const cred = await signInWithEmailAndPassword(
        firebaseAuth,
        trimmedEmail,
        trimmedPassword
      );

      const user = cred.user;

      // Require verified email before letting them in
      if (!user.emailVerified) {
        setLoading(false);
        return Alert.alert(
          "Verify your email",
          "We sent a verification link to your email. Please confirm your email address, then try logging in again."
        );
      }

      const session = {
        uid: user.uid,
        email: user.email,
        provider: "firebase-email",
        loggedInAt: new Date().toISOString(),
      };

      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(session));
      setLoading(false);

      Alert.alert(
        "Success",
        `Welcome back, ${user.email ?? "electrician"}!`,
        [{ text: "Continue", onPress: () => router.replace("/home") }]
      );
    } catch (err: any) {
      console.warn("Firebase login error:", err);
      setLoading(false);

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
    }
  };

  const isBusy = loading;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.container, { backgroundColor: theme.screenBackground }]}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.inner}>
          <Text style={[styles.title, { color: theme.textPrimary }]}>
            Login
          </Text>

          {/* Email input */}
          <TextInput
            style={styles.input}
            placeholder="Email..."
            placeholderTextColor="#889"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          {/* Password input with eye toggle */}
          <View style={styles.passwordRow}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Password..."
              placeholderTextColor="#889"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowPassword((prev) => !prev)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={20}
                color="#cbd5f5"
              />
            </TouchableOpacity>
          </View>

          {/* Forgot password link → new screen */}
          <TouchableOpacity
            onPress={() => router.push("/forgot-password")}
            disabled={isBusy}
            activeOpacity={0.8}
          >
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>

          {/* Login button */}
          <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
            <TouchableOpacity
              style={[styles.button, { opacity: isBusy ? 0.7 : 1 }]}
              onPress={handleLoginPress}
              onPressIn={() => animate(0.95)}
              onPressOut={() => animate(1)}
              activeOpacity={0.8}
              disabled={isBusy}
            >
              <Text style={styles.buttonText}>
                {loading ? "Logging in..." : "Continue"}
              </Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Signup link */}
          <TouchableOpacity onPress={() => router.push("/signup")}>
            <Text style={styles.link}>No account? Create one</Text>
          </TouchableOpacity>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    gap: 14,
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 10,
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.06)",
    color: "#fff",
    padding: 14,
    fontSize: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#334155",
  },
  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#334155",
  },
  passwordInput: {
    flex: 1,
    color: "#fff",
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
  },
  eyeButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  forgotText: {
    color: "#cbd5f5",
    textAlign: "right",
    fontSize: 13,
    marginTop: 4,
    fontWeight: "600",
  },
  button: {
    backgroundColor: "#2563eb",
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: "center",
    marginTop: 6,
  },
  buttonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },
  link: {
    color: "#94a3b8",
    textAlign: "center",
    fontSize: 14,
    marginTop: 10,
    fontWeight: "600",
  },
});
