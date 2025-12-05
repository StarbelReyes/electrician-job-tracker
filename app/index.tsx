// app/index.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

const USER_STORAGE_KEY = "EJT_USER_SESSION";

export default function IndexScreen() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const stored = await AsyncStorage.getItem(USER_STORAGE_KEY);
        if (stored) {
          // user already logged in → go straight to home
          router.replace("/home");
        } else {
          // no session → go to login
          router.replace("/login");
        }
      } catch (err) {
        console.warn("Session check error:", err);
        router.replace("/login");
      } finally {
        setChecking(false);
      }
    };

    checkSession();
  }, [router]);

  if (checking) {
    return (
      <View style={styles.container}>
        <ActivityIndicator />
        <Text style={styles.text}>Loading Traktr…</Text>
      </View>
    );
  }

  // Router will replace this screen anyway
  return null;
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  text: { marginTop: 8, fontSize: 16 },
});
