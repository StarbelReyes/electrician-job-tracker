// app/profile-setup.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    Alert,
    Animated,
    Image,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { usePreferences } from "../context/PreferencesContext";
import { db, firebaseAuth, storage } from "../firebaseConfig";

const USER_STORAGE_KEY = "EJT_USER_SESSION";

type Session = {
  uid: string;
  email?: string | null;
  name?: string;
  role?: "owner" | "employee" | "independent";
  companyId?: string | null;
  provider?: string;
  createdAt?: string;
  loggedInAt?: string;
};

export default function ProfileSetupScreen() {
  const router = useRouter();
  const { isReady, theme, accentColor } = usePreferences();

  const [authReady, setAuthReady] = useState(false);
  const [uid, setUid] = useState<string | null>(null);

  const [session, setSession] = useState<Session | null>(null);
  const companyId = session?.companyId ?? null;
  const email = session?.email ?? firebaseAuth.currentUser?.email ?? "";

  const [name, setName] = useState("");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const buttonScale = useRef(new Animated.Value(1)).current;
  const animateScale = (val: number) => {
    Animated.spring(buttonScale, {
      toValue: val,
      friction: 6,
      tension: 160,
      useNativeDriver: true,
    }).start();
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(firebaseAuth, async (user) => {
      setUid(user?.uid ?? null);
      setAuthReady(true);

      // load session from AsyncStorage
      const stored = await AsyncStorage.getItem(USER_STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setSession(parsed);
          if (parsed?.name) setName(String(parsed.name));
        } catch {
          setSession(null);
        }
      }
    });

    return () => unsub();
  }, []);

  // Optional: preload existing profile if already set in Firestore
  useEffect(() => {
    const run = async () => {
      if (!uid) return;
      try {
        const uref = doc(db, "users", uid);
        const snap = await getDoc(uref);
        if (snap.exists()) {
          const d: any = snap.data();
          if (!name && d?.name) setName(String(d.name));
          if (!photoUri && d?.photoUrl) setPhotoUri(String(d.photoUrl));
        }
      } catch {}
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  const canSave = useMemo(() => {
    return !!uid && !!companyId && name.trim().length >= 2 && !!photoUri && !saving;
  }, [uid, companyId, name, photoUri, saving]);

  const pickPhoto = async () => {
    if (saving) return;

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Please allow photo access to pick a profile picture.");
      return;
    }

    // ✅ Works across expo-image-picker versions (avoids MediaType TS issues)
    const mediaTypes =
      (ImagePicker as any).MediaType?.Images ??
      (ImagePicker as any).MediaTypeOptions?.Images;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    } as any);

    if (result.canceled) return;

    const uri = result.assets?.[0]?.uri;
    if (!uri) return;

    setPhotoUri(uri);
  };

  const uploadProfilePhoto = async (localUri: string) => {
    if (!uid || !companyId) throw new Error("Missing uid/companyId");

    // Make a stable path per user per company
    const objectPath = `companies/${companyId}/employees/${uid}/profile.jpg`;
    const storageRef = ref(storage, objectPath);

    const resp = await fetch(localUri);
    const blob = await resp.blob();

    await uploadBytes(storageRef, blob, {
      contentType: "image/jpeg",
    });

    const url = await getDownloadURL(storageRef);
    return url;
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!uid) {
      Alert.alert("Not logged in", "Please log in again.");
      router.replace("/login" as any);
      return;
    }
    if (!companyId) {
      Alert.alert("No company", "Join a company first.");
      router.replace("/join-company" as any);
      return;
    }
    if (trimmedName.length < 2) {
      Alert.alert("Name required", "Please enter your real name.");
      return;
    }
    if (!photoUri) {
      Alert.alert("Photo required", "Please choose a profile picture.");
      return;
    }
    if (saving) return;

    setSaving(true);

    try {
      // 1) Upload to Storage
      const photoUrl = await uploadProfilePhoto(photoUri);

      // 2) Write users/{uid}
      const userRef = doc(db, "users", uid);
      await setDoc(
        userRef,
        {
          uid,
          email: email ?? "",
          name: trimmedName,
          photoUrl,
          profileComplete: true,
      
          // ✅ REQUIRED for Firestore rules + job reads
          companyId: companyId,
          role: "employee",
      
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      

      // 3) Write companies/{companyId}/employees/{uid}
      const employeeRef = doc(db, "companies", companyId, "employees", uid);
      await setDoc(
        employeeRef,
        {
          uid,
          email: email ?? "",
          name: trimmedName,
          photoUrl,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // 4) Update AsyncStorage session
      const nextSession: Session = {
        ...(session ?? { uid }),
        uid,
        email: email ?? "",
        name: trimmedName,
        role: "employee",
        companyId,
      };

      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(nextSession));

      setSaving(false);

      Alert.alert("Saved", "Your profile is set.", [
        { text: "Continue", onPress: () => router.replace("/home" as any) },
      ]);
    } catch (err) {
      console.warn("Profile save error:", err);
      setSaving(false);
      Alert.alert("Could not save", "Please try again.");
    }
  };

  if (!isReady || !authReady) {
    return <View style={{ flex: 1, backgroundColor: theme?.screenBackground ?? "#0F1115" }} />;
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.screenBackground }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <View style={{ flex: 1, backgroundColor: theme.screenBackground }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.screen, { backgroundColor: theme.screenBackground }]}
          keyboardShouldPersistTaps="always"
        >
          <View style={styles.headerRow}>
            <Text style={[styles.appTitle, { color: theme.headerText }]}>THE TRAKTR APP</Text>
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
              Set up your profile
            </Text>
            <Text style={[styles.cardSubtitle, { color: theme.textMuted }]}>
              Add your real name and a profile photo so owners can assign jobs correctly.
            </Text>

            <TouchableOpacity
              onPress={pickPhoto}
              activeOpacity={0.9}
              style={[
                styles.photoButton,
                {
                  borderColor: theme.cardBorder + "99",
                  backgroundColor: theme.cardBackground + "66",
                },
              ]}
              disabled={saving}
            >
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.photoPreview} />
              ) : (
                <Text style={[styles.photoButtonText, { color: theme.textMuted }]}>
                  Tap to choose profile photo
                </Text>
              )}
            </TouchableOpacity>

            <Text style={[styles.label, { color: theme.textMuted }]}>Your name</Text>
            <View
              style={[
                styles.inputShell,
                {
                  backgroundColor: theme.inputBackground + "F2",
                  borderColor: theme.inputBorder,
                },
              ]}
            >
              <TextInput
                style={[styles.input, { color: theme.inputText }]}
                placeholder="Full name"
                placeholderTextColor={theme.textMuted}
                value={name}
                onChangeText={setName}
                editable={!saving}
              />
            </View>

            <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  {
                    backgroundColor: accentColor,
                    opacity: canSave ? 1 : 0.6,
                    shadowColor: accentColor,
                  },
                ]}
                onPress={handleSave}
                onPressIn={() => animateScale(0.96)}
                onPressOut={() => animateScale(1)}
                activeOpacity={0.9}
                disabled={!canSave}
              >
                <Text style={[styles.primaryButtonText, { color: theme.primaryButtonText }]}>
                  {saving ? "Saving..." : "Save profile"}
                </Text>
              </TouchableOpacity>
            </Animated.View>

          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flexGrow: 1, paddingTop: 48, paddingHorizontal: 18 },
  headerRow: { marginBottom: 12 },
  appTitle: { fontSize: 22, fontWeight: "700" },

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
  cardTitle: { fontSize: 20, fontWeight: "800", marginBottom: 4 },
  cardSubtitle: { fontSize: 12, marginBottom: 16 },

  photoButton: {
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    overflow: "hidden",
    minHeight: 130,
  },
  photoButtonText: { fontSize: 13, fontWeight: "700", textDecorationLine: "underline" },
  photoPreview: { width: 120, height: 120, borderRadius: 999 },

  label: { fontSize: 12, fontWeight: "700", marginBottom: 6 },
  inputShell: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  input: { flex: 1, fontSize: 14 },

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
  primaryButtonText: { fontSize: 15, fontWeight: "700" },

  skipBtn: { marginTop: 10, alignItems: "center", justifyContent: "center", paddingVertical: 10 },
  skipText: { fontSize: 13, fontWeight: "700", textDecorationLine: "underline" },
});
