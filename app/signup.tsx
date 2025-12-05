// app/signup.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
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

const USER_STORAGE_KEY = "EJT_USER_SESSION";
// 👇 IMPORTANT: use your Mac’s LAN IP here, not localhost
const API_BASE_URL = "http://192.168.1.199:4001";

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

  const animateScale = (toValue: number) => {
    Animated.spring(buttonScale, {
      toValue,
      friction: 5,
      tension: 150,
      useNativeDriver: true,
    }).start();
  };

  const handleBlur = () => {
    // placeholder for future validation
  };

  const handleSignup = async () => {
    if (!email.trim() || !password.trim() || !name.trim()) {
      return Alert.alert("Error", "All fields are required.");
    }

    if (loading) return;
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password: password.trim(),
          name: name.trim(),
          role,
        }),
      });

      let data: any;
      try {
        data = await response.json();
      } catch {
        setLoading(false);
        return Alert.alert(
          "Error",
          "Server response was not valid JSON. Check the API server."
        );
      }

      if (!data.ok || !data.user) {
        setLoading(false);
        return Alert.alert(
          "Signup Failed",
          data?.error || "Could not create account."
        );
      }

      const user = data.user;

      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));

      setLoading(false);

      Alert.alert("Account Created", `Welcome, ${user.name}!`, [
        {
          text: "Continue",
          onPress: () => {
            // later: if (user.role === "employee") router.replace("/employee-home");
            router.replace("/home");
          },
        },
      ]);
    } catch (err) {
      console.warn("Signup error:", err);
      setLoading(false);
      return Alert.alert(
        "Error",
        "Could not reach the signup server. Make sure server.js is running on port 4001."
      );
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

          <View style={[styles.inputBlock, { borderColor: theme.inputBorder }]}>
            <Ionicons name="person-outline" size={18} color={theme.textMuted} />
            <TextInput
              style={[styles.input, { color: theme.textPrimary }]}
              placeholder="Full name..."
              placeholderTextColor={theme.textMuted}
              value={name}
              onChangeText={setName}
              onBlur={handleBlur}
            />
          </View>

          <View style={[styles.inputBlock, { borderColor: theme.inputBorder }]}>
            <Ionicons name="mail-outline" size={18} color={theme.textMuted} />
            <TextInput
              style={[styles.input, { color: theme.textPrimary }]}
              placeholder="Email..."
              placeholderTextColor={theme.textMuted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              onBlur={handleBlur}
            />
          </View>

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
              onBlur={handleBlur}
            />
          </View>

          <Text style={[styles.label, { color: theme.textMuted }]}>
            Select Role
          </Text>

          <View style={styles.roleRow}>
            {(["owner", "employee", "independent"] as const).map((option) => (
              <TouchableOpacity
                key={option}
                style={[
                  styles.rolePill,
                  role === option && { borderColor: accentColor, borderWidth: 2 },
                ]}
                onPress={() => setRole(option)}
                activeOpacity={0.9}
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

          <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
            <TouchableOpacity
              style={[
                styles.signupButton,
                { backgroundColor: accentColor, opacity: loading ? 0.7 : 1 },
              ]}
              onPress={handleSignup}
              onPressIn={() => animateScale(0.95)}
              onPressOut={() => animateScale(1)}
              activeOpacity={0.9}
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
  input: {
    flex: 1,
    fontSize: 15,
  },
  label: { fontSize: 13, fontWeight: "700", textAlign: "center" },
  roleRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  rolePill: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  signupButton: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: "center",
  },
  signupButtonText: {
    fontSize: 16,
    fontWeight: "800",
  },
  footerLink: {
    textAlign: "center",
    marginTop: 6,
    fontSize: 14,
    fontWeight: "700",
  },
});
