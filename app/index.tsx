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
    let isMounted = true;

    const checkSession = async () => {
      try {
        const stored = await AsyncStorage.getItem(USER_STORAGE_KEY);

        if (!isMounted) return;

        if (stored) {
          // Saved session → go straight to home
          router.replace("/home");
        } else {
          // No session → go to login
          router.replace("/login");
        }
      } catch (err) {
        console.warn("Session check error:", err);
        if (isMounted) {
          router.replace("/login");
        }
      } finally {
        if (isMounted) {
          setChecking(false);
        }
      }
    };

    checkSession();

    return () => {
      isMounted = false;
    };
  }, [router]);

  if (checking) {
    return (
      <View style={styles.container}>
        <ActivityIndicator />
        <Text style={styles.text}>Loading Traktr…</Text>
      </View>
    );
  }

  // The router.replace call will move us off this screen.
  return null;
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  text: { marginTop: 8, fontSize: 16 },
});
