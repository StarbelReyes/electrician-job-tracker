// app/login.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import {
    Alert,
    Animated,
    KeyboardAvoidingView,
    Platform,
    Keyboard as RNKeyboard,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View
} from "react-native";

const USER_STORAGE_KEY = "EJT_USER_SESSION";
// 👇 your Mac IP + port
const API_BASE_URL = "http://192.168.1.199:4001";

type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: "owner" | "employee" | "independent";
  companyId: string;
};

export default function LoginScreen() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    if (!email.trim() || !password.trim()) {
      return Alert.alert("Error", "Please fill in both email and password.");
    }

    if (loading) return;
    setLoading(true);
    RNKeyboard.dismiss();

    try {
      const res = await fetch(`${API_BASE_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password: password.trim(),
        }),
      });

      let data: { ok: boolean; error?: string; user?: SessionUser };
      try {
        data = await res.json();
      } catch {
        setLoading(false);
        return Alert.alert(
          "Error",
          "Server response was not valid JSON. Check server.js."
        );
      }

      if (!data.ok || !data.user) {
        setLoading(false);
        return Alert.alert("Login failed", data.error || "Invalid email or password.");
      }

      const user = data.user;

      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));

      setLoading(false);

      Alert.alert("Success", `Welcome back, ${user.name}!`, [
        {
          text: "Continue",
          onPress: () => {
            // later: branch by role
            router.replace("/home");
          },
        },
      ]);
    } catch (err) {
      console.warn("Login error:", err);
      setLoading(false);
      return Alert.alert(
        "Error",
        "Could not reach the login server. Make sure server.js is running and IP is correct."
      );
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
    >
      <TouchableWithoutFeedback onPress={RNKeyboard.dismiss}>
        <View style={styles.inner}>
          <Text style={styles.title}>Login</Text>

          <TextInput
            style={styles.input}
            placeholder="Email..."
            placeholderTextColor="#889"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <TextInput
            style={styles.input}
            placeholder="Password..."
            placeholderTextColor="#889"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
            <TouchableOpacity
              style={[styles.button, loading && { opacity: 0.7 }]}
              onPress={handleLoginPress}
              onPressIn={() => animate(0.95)}
              onPressOut={() => animate(1)}
              activeOpacity={0.8}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? "Logging in..." : "Continue"}
              </Text>
            </TouchableOpacity>
          </Animated.View>

          <TouchableOpacity onPress={() => router.push("/signup")}>
            <Text style={styles.link}>No account? Create one</Text>
          </TouchableOpacity>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#020617" },
  inner: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    gap: 14,
  },
  title: {
    color: "#fff",
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
