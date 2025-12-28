// app/employee-profile-setup.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
    Alert,
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

// Firestore
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db, firebaseAuth, storage } from "../firebaseConfig";

// Storage
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

import { fonts } from "../constants/appTheme";
import { usePreferences } from "../context/PreferencesContext";

const USER_STORAGE_KEY = "EJT_USER_SESSION";

type SessionShape = {
  uid?: string;
  email?: string;
  role?: "owner" | "employee";
  companyId?: string;
};

export default function EmployeeProfileSetupScreen() {
  const router = useRouter();
  const { theme, accentColor } = usePreferences();

  const [displayName, setDisplayName] = useState("");
  const [photoLocalUri, setPhotoLocalUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const dismissKeyboard = () => Keyboard.dismiss();

  const pickPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Allow photo access to pick a profile picture.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (!result.canceled) {
        const uri = result.assets?.[0]?.uri;
        if (uri) setPhotoLocalUri(uri);
      }
    } catch (e: any) {
      Alert.alert("Photo error", e?.message ?? "Could not pick photo.");
    }
  };

  const uploadProfilePhoto = async (
    companyId: string,
    uid: string,
    uri: string
  ): Promise<string> => {
    const response = await fetch(uri);
    const blob = await response.blob();

    const fileRef = ref(storage, `companies/${companyId}/users/${uid}/profile.jpg`);
    await uploadBytes(fileRef, blob);
    return await getDownloadURL(fileRef);
  };

  const saveProfile = async () => {
    if (saving) return;

    const name = displayName.trim();
    if (!name) {
      Alert.alert("Missing name", "Enter your real name.");
      return;
    }
    if (!photoLocalUri) {
      Alert.alert("Missing photo", "Upload a profile picture.");
      return;
    }

    try {
      setSaving(true);

      const authUser = firebaseAuth.currentUser;
      if (!authUser) {
        Alert.alert("Not logged in", "Please log in again.");
        return;
      }

      const sessionRaw = await AsyncStorage.getItem(USER_STORAGE_KEY);
      const session: SessionShape = sessionRaw ? JSON.parse(sessionRaw) : {};
      const companyId = session.companyId;

      if (!companyId) {
        Alert.alert(
          "Company not found",
          "No companyId in session. Make sure you store companyId when user logs in / joins."
        );
        return;
      }

      const uid = authUser.uid;
      const email = authUser.email ?? session.email ?? "";

      const photoURL = await uploadProfilePhoto(companyId, uid, photoLocalUri);

      await setDoc(
        doc(db, "companies", companyId, "users", uid),
        {
          uid,
          email,
          role: "employee",
          displayName: name,
          photoURL,
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );

      // Keep session updated so UI refreshes instantly
      const nextSession = {
        ...session,
        uid,
        email,
        role: "employee",
        companyId,
        displayName: name,
        photoURL,
        profileComplete: true,
      };
      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(nextSession));

      Alert.alert("Saved", "Profile setup complete.");
      router.replace("/home");
    } catch (e: any) {
      Alert.alert("Save failed", e?.message ?? "Could not save profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={dismissKeyboard}>
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: theme.screenBackground }]}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: theme.textPrimary }]}>
              Set up your profile
            </Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Add your real name and a profile picture so the owner assigns jobs correctly.
            </Text>
          </View>

          <View
            style={[
              styles.card,
              { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
            ]}
          >
            <Text style={[styles.label, { color: theme.textSecondary }]}>Profile photo</Text>

            <TouchableOpacity
              style={[
                styles.photoPick,
                { borderColor: theme.cardBorder, backgroundColor: theme.cardSecondaryBackground },
              ]}
              onPress={pickPhoto}
              activeOpacity={0.85}
            >
              {photoLocalUri ? (
                <Image source={{ uri: photoLocalUri }} style={styles.photo} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Ionicons name="person-circle-outline" size={54} color={theme.textSecondary} />
                  <Text style={[styles.photoText, { color: theme.textSecondary }]}>
                    Tap to upload
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {photoLocalUri ? (
              <TouchableOpacity
                onPress={pickPhoto}
                style={[
                  styles.changeBtn,
                  { borderColor: theme.cardBorder, backgroundColor: theme.cardSecondaryBackground },
                ]}
                activeOpacity={0.85}
              >
                <Ionicons name="image-outline" size={18} color={theme.textPrimary} />
                <Text style={[styles.changeBtnText, { color: theme.textPrimary }]}>
                  Change photo
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <View
            style={[
              styles.card,
              { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
            ]}
          >
            <Text style={[styles.label, { color: theme.textSecondary }]}>Real name</Text>

            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="e.g., Mike Johnson"
              placeholderTextColor={theme.textMuted}
              style={[
                styles.input,
                {
                  color: theme.inputText,
                  borderColor: theme.inputBorder,
                  backgroundColor: theme.inputBackground,
                },
              ]}
              returnKeyType="done"
              onSubmitEditing={dismissKeyboard}
            />
          </View>

          <TouchableOpacity
            onPress={saveProfile}
            disabled={saving}
            activeOpacity={0.9}
            style={[
              styles.primaryBtn,
              {
                opacity: saving ? 0.65 : 1,
                backgroundColor: accentColor, // ✅ controlled accent system
              },
            ]}
          >
            <Ionicons name="checkmark-circle-outline" size={20} color={theme.primaryButtonText} />
            <Text style={[styles.primaryBtnText, { color: theme.primaryButtonText }]}>
              {saving ? "Saving..." : "Save profile"}
            </Text>
          </TouchableOpacity>

          <Text style={[styles.footerHint, { color: theme.textMuted }]}>
            This info will be shown to the owner in the job assignment list.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 28 },

  headerRow: { marginTop: 6, marginBottom: 16 },
  title: {
    fontSize: 28,
    fontFamily: fonts.bold,
    letterSpacing: 0.2,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.regular,
  },

  card: {
    padding: 14,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  label: {
    fontSize: 12,
    marginBottom: 8,
    fontFamily: fonts.semibold,
    letterSpacing: 0.2,
  },

  photoPick: {
    width: "100%",
    height: 180,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  photo: { width: "100%", height: "100%" },
  photoPlaceholder: { alignItems: "center" },
  photoText: { marginTop: 8, fontSize: 13, fontFamily: fonts.semibold },

  changeBtn: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  changeBtnText: { fontSize: 13, fontFamily: fonts.bold },

  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: fonts.regular,
  },

  primaryBtn: {
    marginTop: 10,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
  },
  primaryBtnText: {
    fontSize: 16,
    fontFamily: fonts.bold,
  },

  footerHint: { marginTop: 10, fontSize: 12, textAlign: "center", fontFamily: fonts.regular },
});
