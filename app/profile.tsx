// app/profile.tsx
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
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { usePreferences } from "../context/PreferencesContext";
import { db, firebaseAuth, storage } from "../firebaseConfig";

const USER_STORAGE_KEY = "EJT_USER_SESSION";

type Role = "owner" | "employee" | "independent";

type Session = {
  uid: string;
  email?: string | null;
  name?: string;
  role?: Role;
  companyId?: string | null;
  photoUrl?: string | null;
  profileComplete?: boolean;
  provider?: string;
  createdAt?: string;
  loggedInAt?: string;
};

function getErrMessage(err: any) {
  if (!err) return "Unknown error";
  if (typeof err === "string") return err;
  return err?.message || err?.code || "Unknown error";
}

export default function ProfileScreen() {
  const router = useRouter();
  const { isReady, theme, accentColor } = usePreferences();

  const [authReady, setAuthReady] = useState(false);
  const [uid, setUid] = useState<string | null>(null);

  const [session, setSession] = useState<Session | null>(null);
  const role = (session?.role ?? "employee") as Role;
  const companyId = session?.companyId ?? null;
  const email = session?.email ?? firebaseAuth.currentUser?.email ?? "";

  const [loadingProfile, setLoadingProfile] = useState(true);

  const [name, setName] = useState("");
  const [photoUri, setPhotoUri] = useState<string | null>(null); // local file OR https URL
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

  // 1) Load session + listen auth
  useEffect(() => {
    const unsub = onAuthStateChanged(firebaseAuth, async (user) => {
      setUid(user?.uid ?? null);
      setAuthReady(true);

      const stored = await AsyncStorage.getItem(USER_STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as Session;
          setSession(parsed);

          // hydrate local UI from session immediately
          if (parsed?.name) setName(String(parsed.name));
          if (parsed?.photoUrl) setPhotoUri(String(parsed.photoUrl));
        } catch {
          setSession(null);
        }
      }
    });

    return () => unsub();
  }, []);

  // 2) Load latest from Firestore (source of truth)
  useEffect(() => {
    const run = async () => {
      if (!uid) return;

      setLoadingProfile(true);
      try {
        const uref = doc(db, "users", uid);
        const snap = await getDoc(uref);

        if (snap.exists()) {
          const d: any = snap.data();
          const liveName = String(d?.name ?? "").trim();
          const livePhoto = String(d?.photoUrl ?? "").trim();

          if (liveName) setName(liveName);
          if (livePhoto) setPhotoUri(livePhoto);

          const nextSession: Session = {
            ...(session ?? ({ uid } as Session)),
            uid,
            email: (email ?? "") as any,
            role: (d?.role ?? session?.role ?? "employee") as Role,
            companyId:
              typeof d?.companyId === "string"
                ? String(d.companyId)
                : session?.companyId ?? null,
            name: liveName || session?.name,
            photoUrl: livePhoto || session?.photoUrl || null,
            profileComplete: Boolean(d?.profileComplete ?? session?.profileComplete ?? false),
            loggedInAt: session?.loggedInAt ?? new Date().toISOString(),
          };

          const changed =
            nextSession.name !== session?.name ||
            nextSession.photoUrl !== session?.photoUrl ||
            nextSession.companyId !== session?.companyId ||
            nextSession.role !== session?.role ||
            nextSession.profileComplete !== session?.profileComplete;

          if (changed) {
            await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(nextSession));
            setSession(nextSession);
          }
        }
      } catch (e) {
        console.warn("Profile load error:", e);
      } finally {
        setLoadingProfile(false);
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  const canSave = useMemo(() => {
    return !!uid && name.trim().length >= 2 && !!photoUri && !saving && !loadingProfile;
  }, [uid, name, photoUri, saving, loadingProfile]);

  const pickPhoto = async () => {
    if (saving) return;

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Please allow photo access to pick a profile picture.");
      return;
    }

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
    if (!uid) throw new Error("Missing uid");

    const isRemote =
      localUri.startsWith("https://") ||
      localUri.startsWith("http://") ||
      localUri.startsWith("gs://");

    if (isRemote) return localUri;

    const objectPath = `users/${uid}/profile.jpg`;
    const storageRef = ref(storage, objectPath);

    const resp = await fetch(localUri);
    const blob = await resp.blob();

    await uploadBytes(storageRef, blob, { contentType: "image/jpeg" });

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
    if (trimmedName.length < 2) {
      Alert.alert("Name required", "Please enter your name.");
      return;
    }
    if (!photoUri) {
      Alert.alert("Photo required", "Please choose a profile picture.");
      return;
    }
    if (saving) return;

    setSaving(true);

    try {
      // 1) Upload if needed
      const photoUrl = await uploadProfilePhoto(photoUri);

      // 2) Save user doc (source of truth) — if THIS succeeds, we consider profile saved.
      const userRef = doc(db, "users", uid);
      const profileComplete = Boolean(trimmedName && photoUrl);

      await setDoc(
        userRef,
        {
          uid,
          email: email ?? "",
          name: trimmedName,
          photoUrl,
          profileComplete,
          role: (session?.role ?? "employee") as Role,
          companyId: companyId ?? null,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // 3) Update session immediately (Home avatar updates from session)
      const nextSession: Session = {
        ...(session ?? ({ uid } as Session)),
        uid,
        email: email ?? "",
        name: trimmedName,
        companyId: companyId ?? null,
        role: (session?.role ?? "employee") as Role,
        photoUrl,
        profileComplete,
        loggedInAt: session?.loggedInAt ?? new Date().toISOString(),
      };

      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(nextSession));
      setSession(nextSession);

      // 4) Best-effort sync to companies/{companyId}/employees/{uid}
      // IMPORTANT: do NOT fail the whole save if this is blocked by rules.
      if (companyId) {
        try {
          const employeeRef = doc(db, "companies", companyId, "employees", uid);
          const empSnap = await getDoc(employeeRef);

          // Employee cannot create a full employee doc in your rules — only update existing
          if (empSnap.exists()) {
            await setDoc(
              employeeRef,
              {
                uid,
                email: email ?? "",
                name: trimmedName,
                photoUrl,
                profileComplete,
                updatedAt: serverTimestamp(),
              },
              { merge: true }
            );
          } else {
            console.warn(
              "SYNC SKIP: employee doc not created yet (join flow creates limited fields only)."
            );
          }
        } catch (e) {
          console.warn("SYNC WARN: employee mirror update blocked:", e);
          // Do NOT throw.
        }
      }

      // 5) Success
      Alert.alert("Saved", "Your profile was updated.", [
        { text: "OK", onPress: () => router.replace("/home" as any) },
      ]);
    } catch (err) {
      const msg = getErrMessage(err);
      console.warn("Profile save error:", err);
      Alert.alert("Could not save", msg || "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const subtitle = useMemo(() => {
    if (role === "employee") {
      return "Update your name and photo. This is what the owner sees in the assign list.";
    }
    if (role === "owner") {
      return "Update your name and photo. This helps your team recognize you.";
    }
    return "Update your name and photo for your Traktr profile.";
  }, [role]);

  if (!isReady || !authReady) {
    return <View style={{ flex: 1, backgroundColor: theme?.screenBackground ?? "#0F1115" }} />;
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.screenBackground }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={{ flex: 1, backgroundColor: theme.screenBackground }}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[styles.screen, { backgroundColor: theme.screenBackground }]}
            keyboardShouldPersistTaps="always"
          >
            <View style={styles.headerRow}>
              <Text style={[styles.appTitle, { color: theme.headerText }]}>THE TRAKTR APP</Text>

              <View style={styles.headerMeta}>
                <Text style={[styles.metaText, { color: theme.textMuted }]} numberOfLines={1}>
                  {email || " "}
                </Text>
                <Text style={[styles.metaText, { color: theme.textMuted }]}>
                  {role === "owner" ? "Company owner" : role === "employee" ? "Employee" : "Independent"}
                  {companyId ? "" : role === "employee" ? " • Not joined yet" : ""}
                </Text>
              </View>
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
              <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Your profile</Text>
              <Text style={[styles.cardSubtitle, { color: theme.textMuted }]}>{subtitle}</Text>

              <TouchableOpacity
                onPress={pickPhoto}
                activeOpacity={0.9}
                style={[
                  styles.photoButton,
                  {
                    borderColor: theme.cardBorder + "99",
                    backgroundColor: theme.cardBackground + "66",
                    opacity: saving ? 0.8 : 1,
                  },
                ]}
                disabled={saving}
              >
                {photoUri ? (
                  <Image source={{ uri: photoUri }} style={styles.photoPreview} />
                ) : (
                  <View style={styles.photoEmpty}>
                    <Text style={[styles.photoButtonText, { color: theme.textMuted }]}>
                      Tap to choose profile photo
                    </Text>
                    <Text style={[styles.photoHint, { color: theme.textMuted }]}>
                      Square works best (1:1)
                    </Text>
                  </View>
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
                  returnKeyType="done"
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
                    {saving ? "Saving..." : "Save changes"}
                  </Text>
                </TouchableOpacity>
              </Animated.View>

              <TouchableOpacity onPress={() => router.back()} activeOpacity={0.85} style={styles.backBtn}>
                <Text style={[styles.backText, { color: theme.textMuted }]}>Back</Text>
              </TouchableOpacity>
            </View>

            {loadingProfile && (
              <Text style={[styles.loadingText, { color: theme.textMuted }]}>Loading profile…</Text>
            )}
          </ScrollView>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flexGrow: 1, paddingTop: 48, paddingHorizontal: 18 },
  headerRow: { marginBottom: 12 },
  appTitle: {
    fontSize: 22,
    fontFamily: "Athiti-Bold",
    letterSpacing: 0.2,
  },
  headerMeta: {
    marginTop: 6,
  },
  metaText: {
    fontSize: 12,
    fontFamily: "Athiti-Medium",
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
    fontFamily: "Athiti-Bold",
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 12,
    fontFamily: "Athiti-Regular",
    marginBottom: 16,
  },

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
  photoEmpty: {
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  photoButtonText: {
    fontSize: 13,
    fontFamily: "Athiti-SemiBold",
    textDecorationLine: "underline",
  },
  photoHint: {
    fontSize: 12,
    fontFamily: "Athiti-Regular",
    opacity: 0.9,
  },
  photoPreview: { width: 120, height: 120, borderRadius: 999 },

  label: { fontSize: 12, fontFamily: "Athiti-SemiBold", marginBottom: 6 },
  inputShell: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  input: { flex: 1, fontSize: 14, fontFamily: "Athiti-Regular" },

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
  primaryButtonText: { fontSize: 15, fontFamily: "Athiti-Bold" },

  backBtn: {
    marginTop: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },
  backText: {
    fontSize: 13,
    fontFamily: "Athiti-SemiBold",
    textDecorationLine: "underline",
  },

  loadingText: {
    marginTop: 10,
    textAlign: "center",
    fontSize: 12,
    fontFamily: "Athiti-Medium",
  },
});
