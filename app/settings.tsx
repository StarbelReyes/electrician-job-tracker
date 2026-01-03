// app/settings.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { usePreferences } from "../context/PreferencesContext";
import { db, firebaseAuth } from "../firebaseConfig";

const USER_STORAGE_KEY = "EJT_USER_SESSION";

const STORAGE_KEYS = {
  BACKUP_LAST_EXPORT: "EJT_BACKUP_LAST_EXPORT",

  COMPANY_NAME: "EJT_COMPANY_NAME",
  COMPANY_PHONE: "EJT_COMPANY_PHONE",
  COMPANY_EMAIL: "EJT_COMPANY_EMAIL",
  COMPANY_LICENSE: "EJT_COMPANY_LICENSE",
};

type Role = "owner" | "employee" | "independent";
type Session = {
  uid?: string;
  email?: string | null;
  name?: string;
  role?: Role;
  companyId?: string | null;
};

function makeJoinCode() {
  const digits = Math.floor(1000 + Math.random() * 9000);
  return `TRAKTR-${digits}`;
}

// ✅ Uniqueness via joinCodes mapping (no /companies queries)
async function generateUniqueJoinCode(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = makeJoinCode();
    const joinRef = doc(db, "joinCodes", code);
    const snap = await getDoc(joinRef);
    if (!snap.exists()) return code;
  }

  for (let i = 0; i < 10; i++) {
    const code = `TRAKTR-${Math.floor(100000 + Math.random() * 900000)}`;
    const joinRef = doc(db, "joinCodes", code);
    const snap = await getDoc(joinRef);
    if (!snap.exists()) return code;
  }

  return `TRAKTR-${Date.now()}`;
}

export default function SettingsScreen() {
  const router = useRouter();
  const { theme } = usePreferences();

  // 🔒 Brand from locked theme
  const brand = theme.primaryButtonBackground;

  // SESSION
  const [session, setSession] = useState<Session | null>(null);
  const role: Role = (session?.role ?? "independent") as Role;

  const isOwner = role === "owner";
  const isEmployee = role === "employee";
  const isIndependent = role === "independent";

  const companyId = session?.companyId ?? null;

  // ✅ Company Invites should be OWNER-only (employees shouldn’t see/share invites)
  const canShowJoinCode = !!companyId && isOwner;

  // COMPANY JOIN CODE
  const [joinCode, setJoinCode] = useState<string | null>(null);
  const [joinCodeLoading, setJoinCodeLoading] = useState(false);

  // COMPANY BRANDING (Hidden for employee)
  const [companyName, setCompanyName] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [companyLicense, setCompanyLicense] = useState("");

  // BACKUP
  const [lastExport, setLastExport] = useState<string | null>(null);

  // Are we typing in any TextInput?
  const [isEditing, setIsEditing] = useState(false);

  // Screen zoom animation
  const screenScale = useRef(new Animated.Value(1.04)).current;
  useEffect(() => {
    Animated.timing(screenScale, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [screenScale]);

  const scrollRef = useRef<ScrollView | null>(null);
  const sectionPositions = useRef<Record<string, number>>({});

  const registerSection = (key: string, y: number) => {
    sectionPositions.current[key] = y;
  };

  const scrollToSection = (key: string) => {
    const y = sectionPositions.current[key];
    if (scrollRef.current != null && y !== undefined) {
      scrollRef.current.scrollTo({
        y: Math.max(y - 80, 0),
        animated: true,
      });
    }
  };

  const loadSession = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(USER_STORAGE_KEY);
      if (!stored) {
        setSession(null);
        return;
      }
      try {
        setSession(JSON.parse(stored));
      } catch {
        setSession(null);
      }
    } catch {
      setSession(null);
    }
  }, []);

  // ✅ Job Defaults REMOVED for ALL roles (owner/employee/independent)
  // Only loading: backup + branding
  const loadSettings = useCallback(async () => {
    try {
      const [lastExportSaved, companyNameSaved, companyPhoneSaved, companyEmailSaved, companyLicenseSaved] =
        await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.BACKUP_LAST_EXPORT),
          AsyncStorage.getItem(STORAGE_KEYS.COMPANY_NAME),
          AsyncStorage.getItem(STORAGE_KEYS.COMPANY_PHONE),
          AsyncStorage.getItem(STORAGE_KEYS.COMPANY_EMAIL),
          AsyncStorage.getItem(STORAGE_KEYS.COMPANY_LICENSE),
        ]);

      if (lastExportSaved) setLastExport(lastExportSaved);

      if (companyNameSaved) setCompanyName(companyNameSaved);
      if (companyPhoneSaved) setCompanyPhone(companyPhoneSaved);
      if (companyEmailSaved) setCompanyEmail(companyEmailSaved);
      if (companyLicenseSaved) setCompanyLicense(companyLicenseSaved);
    } catch (err) {
      console.warn("Failed to load settings:", err);
    }
  }, []);

  const loadJoinCodeFromFirestore = useCallback(async () => {
    // Owner-only join code display; otherwise keep it empty
    if (!companyId || !isOwner) {
      setJoinCode(null);
      return;
    }

    setJoinCodeLoading(true);
    try {
      const companyRef = doc(db, "companies", companyId);
      const snap = await getDoc(companyRef);
      if (!snap.exists()) {
        setJoinCode(null);
        return;
      }
      const data = snap.data() as any;
      setJoinCode(data?.joinCode ?? null);
    } catch (err) {
      console.warn("Failed to load join code:", err);
      setJoinCode(null);
    } finally {
      setJoinCodeLoading(false);
    }
  }, [companyId, isOwner]);

  useEffect(() => {
    loadSession();
    loadSettings();
  }, [loadSession, loadSettings]);

  useEffect(() => {
    loadJoinCodeFromFirestore();
  }, [loadJoinCodeFromFirestore]);

  const saveBranding = async (name: string, phone: string, email: string, license: string) => {
    try {
      await AsyncStorage.multiSet([
        [STORAGE_KEYS.COMPANY_NAME, name],
        [STORAGE_KEYS.COMPANY_PHONE, phone],
        [STORAGE_KEYS.COMPANY_EMAIL, email],
        [STORAGE_KEYS.COMPANY_LICENSE, license],
      ]);
    } catch (err) {
      console.warn("Failed to save branding:", err);
    }
  };

  useEffect(() => {
    // ✅ Branding only matters for owner/independent; employees don’t need these fields
    if (isEmployee) return;
    saveBranding(companyName.trim(), companyPhone.trim(), companyEmail.trim(), companyLicense.trim());
  }, [companyName, companyPhone, companyEmail, companyLicense, isEmployee]);

  const handleExportJobs = async () => {
    try {
      const jobsJson = await AsyncStorage.getItem("EJT_JOBS");
      const exportText = jobsJson || "[]";

      await Clipboard.setStringAsync(exportText);

      const timestamp = new Date().toISOString();
      setLastExport(timestamp);
      await AsyncStorage.setItem(STORAGE_KEYS.BACKUP_LAST_EXPORT, timestamp);

      Alert.alert(
        "Backup copied ✅",
        "Your jobs are now saved to the clipboard.\n\n" +
          "Next:\n" +
          "1) Open Notes, email, or Files\n" +
          "2) Long-press and tap Paste\n" +
          "3) Save that note/file somewhere safe\n\n" +
          "To restore later: open that backup, copy ALL the text, then come back here and tap “Restore backup”."
      );
    } catch (err) {
      console.warn("Failed to export jobs:", err);
      Alert.alert("Error", "Could not create backup. Try again.");
    }
  };

  const handleImportJobs = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (!text.trim()) {
        Alert.alert(
          "No backup found 📋",
          "Clipboard is empty.\n\n" +
            "Do this:\n" +
            "1) Open your backup in Notes or email\n" +
            "2) Select ALL the backup text and tap Copy\n" +
            "3) Return to Traktr and tap “Restore backup” again."
        );
        return;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        Alert.alert(
          "Backup not recognized ❌",
          "The copied text doesn’t look like a Traktr backup.\n\n" +
            "Make sure you copied the full backup exactly (from the first [ to the last ]) and try again."
        );
        return;
      }

      if (!Array.isArray(parsed)) {
        Alert.alert(
          "Invalid backup format ❌",
          "The copied data is not a valid Traktr job backup.\n\n" +
            "Copy the entire backup text again and try once more."
        );
        return;
      }

      const jobCount = (parsed as any[])?.length ?? 0;

      Alert.alert(
        "Confirm restore",
        `This will replace ALL jobs currently in Traktr with the backup (${jobCount} job${
          jobCount === 1 ? "" : "s"
        }).\n\nThis cannot be undone.\n\nDo you want to continue?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Replace jobs",
            style: "destructive",
            onPress: async () => {
              try {
                await AsyncStorage.setItem("EJT_JOBS", JSON.stringify(parsed));
                Alert.alert("Restored ✅", "Your jobs were restored successfully from backup.");
              } catch (err) {
                console.warn("Failed to import jobs:", err);
                Alert.alert("Error", "Restore failed. Try again.");
              }
            },
          },
        ]
      );
    } catch (err) {
      console.warn("Failed to prepare import:", err);
      Alert.alert("Error", "Could not read backup from clipboard. Try again.");
    }
  };

  const formatLastExport = () => {
    if (!lastExport) return "Never";
    try {
      const d = new Date(lastExport);
      return d.toLocaleString();
    } catch {
      return lastExport;
    }
  };

  const handleSendFeedback = () => {
    const email = "support@example.com";
    const subject = encodeURIComponent("Traktr feedback");
    const body = encodeURIComponent("");
    Linking.openURL(`mailto:${email}?subject=${subject}&body=${body}`).catch(() => {
      Alert.alert("Error", "Could not open email app.");
    });
  };

  const handleLogout = () => {
    Alert.alert("Log out", "This will sign you out of Traktr on this device.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: async () => {
          try {
            await AsyncStorage.removeItem(USER_STORAGE_KEY);
            router.replace("/login");
          } catch (err) {
            console.warn("Failed to log out:", err);
            Alert.alert("Error", "Could not log out. Try again.");
          }
        },
      },
    ]);
  };

  const handleFocus = (sectionKey: string) => {
    setIsEditing(true);
    scrollToSection(sectionKey);
  };

  const handleBlur = () => setIsEditing(false);

  const dismissKeyboardAndEditing = () => {
    Keyboard.dismiss();
    setIsEditing(false);
  };

  const handleCopyJoinCode = async () => {
    if (!joinCode) return;
    await Clipboard.setStringAsync(joinCode);
    Alert.alert("Copied ✅", "Join code copied to clipboard.");
  };

  const handleShareJoinCode = async () => {
    if (!joinCode) return;
    try {
      await Share.share({
        message: `Join my company on Traktr.\n\nJoin code: ${joinCode}`,
      });
    } catch {}
  };

  // ✅ FIXED: rotates mapping and cleans old joinCodes doc
  // Stores companyName in joinCodes mapping so Join screen can display it without reading /companies.
  const handleGenerateJoinCode = async () => {
    const authed = firebaseAuth.currentUser;
    if (!authed) {
      Alert.alert("Session expired", "Please log in again.");
      router.replace("/login" as any);
      return;
    }

    if (!companyId || !isOwner) {
      Alert.alert("Not allowed", "Only the company owner can generate a join code.");
      return;
    }

    setJoinCodeLoading(true);
    try {
      const companyRef = doc(db, "companies", companyId);

      // Read old joinCode + (optional) Firestore company name
      const companySnap = await getDoc(companyRef);
      const oldCode = companySnap.exists()
        ? ((companySnap.data() as any)?.joinCode as string | undefined)
        : undefined;

      const firestoreCompanyName = companySnap.exists()
        ? ((companySnap.data() as any)?.name as string | undefined)
        : undefined;

      const nameForInvite =
        (firestoreCompanyName && firestoreCompanyName.trim()) ||
        (companyName && companyName.trim()) ||
        "Company";

      const newCode = await generateUniqueJoinCode();

      // 1) Write new joinCode onto company doc
      await setDoc(companyRef, { joinCode: newCode, updatedAt: serverTimestamp() }, { merge: true });

      // 2) Write mapping joinCodes/{newCode} -> companyId (+ companyName)
      const joinCodeRef = doc(db, "joinCodes", newCode);
      await setDoc(
        joinCodeRef,
        {
          companyId,
          companyName: nameForInvite,
          createdAt: serverTimestamp(),
          createdByUid: authed.uid,
        },
        { merge: true }
      );

      // 3) Delete old mapping joinCodes/{oldCode} if it exists and differs
      if (oldCode && oldCode !== newCode) {
        try {
          const oldJoinRef = doc(db, "joinCodes", oldCode);
          const oldSnap = await getDoc(oldJoinRef);
          if (oldSnap.exists()) {
            await deleteDoc(oldJoinRef);
          }
        } catch (cleanupErr) {
          console.warn("Old join code cleanup failed:", cleanupErr);
        }
      }

      setJoinCode(newCode);
      Alert.alert("Join code created ✅", `New join code: ${newCode}`);
    } catch (err) {
      console.warn("Generate join code failed:", err);
      Alert.alert("Error", "Could not generate join code. Try again.");
    } finally {
      setJoinCodeLoading(false);
    }
  };

  // ---------- VISUAL HELPERS (to stop the “mashed up” look) ----------
  const cardBg = useMemo(() => theme.cardBackground + "F2", [theme.cardBackground]);
  const cardBorder = useMemo(() => theme.cardBorder + "66", [theme.cardBorder]);
  const divider = useMemo(() => theme.cardBorder + "33", [theme.cardBorder]);

  const SectionHeader = ({
    icon,
    title,
    metaRight,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    metaRight?: string;
  }) => {
    return (
      <View style={styles.sectionHeaderShell}>
        <View style={styles.sectionHeaderLeft}>
          <View
            style={[
              styles.sectionIconBadge,
              { borderColor: brand + "85", backgroundColor: brand + "1A" },
            ]}
          >
            <Ionicons name={icon} size={16} color={brand} />
          </View>

          <Text style={[styles.sectionTitleStrong, { color: theme.textPrimary }]}>{title}</Text>
        </View>

        {metaRight ? (
          <Text style={[styles.sectionMetaRight, { color: theme.textMuted }]} numberOfLines={2}>
            {metaRight}
          </Text>
        ) : null}
      </View>
    );
  };

  const RowDivider = () => <View style={[styles.rowDivider, { backgroundColor: divider }]} />;

  const SettingsRow = ({
    title,
    subtitle,
    rightLabel,
    rightIcon,
    rightButtonText,
    onPressRow,
    onPressButton,
    danger,
    disabled,
  }: {
    title: string;
    subtitle?: string;
    rightLabel?: string;
    rightIcon?: keyof typeof Ionicons.glyphMap;
    rightButtonText?: string;
    onPressRow?: () => void;
    onPressButton?: () => void;
    danger?: boolean;
    disabled?: boolean;
  }) => {
    const isRowPressable = !!onPressRow && !disabled;

    return (
      <TouchableOpacity
        activeOpacity={isRowPressable ? 0.85 : 1}
        onPress={onPressRow}
        disabled={!isRowPressable}
        style={[
          styles.settingsRow,
          {
            opacity: disabled ? 0.55 : 1,
          },
        ]}
      >
        <View style={styles.rowTextWrap}>
          <Text style={[styles.rowTitleStrong, { color: theme.textPrimary }]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.rowSubtitle, { color: theme.textMuted }]} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        {/* RIGHT SIDE: either a pill button OR (label + chevron/icon) */}
        {rightButtonText ? (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={onPressButton}
            disabled={disabled}
            style={[
              styles.rowPillBtn,
              {
                backgroundColor: (danger ? "#FF3B30" : brand) + "1F",
                borderColor: (danger ? "#FF3B30" : brand) + "AA",
              },
            ]}
          >
            <Text style={[styles.rowPillBtnText, { color: danger ? "#FF3B30" : brand }]}>
              {rightButtonText}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.rowRight}>
            {rightLabel ? (
              <Text style={[styles.rowRightLabel, { color: brand }]} numberOfLines={1}>
                {rightLabel}
              </Text>
            ) : null}

            {rightIcon ? (
              <Ionicons name={rightIcon} size={16} color={theme.textMuted} />
            ) : onPressRow ? (
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            ) : null}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // -------------------------------------------------------------------

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.screenBackground }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <Animated.View
        style={[
          styles.screen,
          {
            backgroundColor: theme.screenBackground + "F2",
            transform: [{ scale: screenScale }],
          },
        ]}
      >
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
                    borderColor: brand + "80",
                    backgroundColor: brand + "1A",
                  },
                ]}
              >
                <Ionicons name="settings-outline" size={18} color={brand} />
              </View>
              <Text style={[styles.headerTitle, { color: theme.headerText }]}>Settings</Text>
            </View>
            <View style={{ width: 24 }} />
          </View>
        </View>

        <View style={{ flex: 1 }}>
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1, backgroundColor: theme.screenBackground }}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: isEditing ? 8 : 24 }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="always"
            onScrollBeginDrag={dismissKeyboardAndEditing}
          >
            <TouchableWithoutFeedback onPress={dismissKeyboardAndEditing} accessible={false}>
              <View>
                {/* ✅ COMPANY INVITES (OWNER ONLY) */}
                {canShowJoinCode ? (
                  <View
                    style={[
                      styles.sectionCard,
                      {
                        backgroundColor: cardBg,
                        borderColor: cardBorder,
                        borderTopColor: brand + "AA",
                        borderTopWidth: 2,
                      },
                    ]}
                    onLayout={(e) => registerSection("companyInvites", e.nativeEvent.layout.y)}
                  >
                    <SectionHeader
                      icon="key-outline"
                      title="Company Invites"
                      metaRight={joinCodeLoading ? "Loading…" : undefined}
                    />

                    <Text style={[styles.sectionSubtitle, { color: theme.textMuted }]}>
                      Share this join code with employees so they can join your company.
                    </Text>

                    <View style={styles.fieldBlock}>
                      <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Join code</Text>
                      <Text style={[styles.joinCodeText, { color: theme.textPrimary }]} selectable>
                        {joinCodeLoading ? "Loading…" : joinCode ? joinCode : "No join code set"}
                      </Text>
                      <Text style={[styles.fieldHelp, { color: theme.textMuted }]}>
                        Employees enter this in “Join a company”.
                      </Text>
                    </View>

                    <View style={styles.inviteActionsRow}>
                      <TouchableOpacity
                        style={[
                          styles.pillBtn,
                          {
                            backgroundColor: brand + "22",
                            borderColor: brand + "AA",
                            opacity: joinCode && !joinCodeLoading ? 1 : 0.5,
                          },
                        ]}
                        onPress={handleCopyJoinCode}
                        activeOpacity={0.85}
                        disabled={!joinCode || joinCodeLoading}
                      >
                        <Ionicons name="copy-outline" size={16} color={brand} />
                        <Text style={[styles.pillBtnText, { color: brand }]}>Copy</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.pillBtn,
                          {
                            backgroundColor: brand + "22",
                            borderColor: brand + "AA",
                            opacity: joinCode && !joinCodeLoading ? 1 : 0.5,
                          },
                        ]}
                        onPress={handleShareJoinCode}
                        activeOpacity={0.85}
                        disabled={!joinCode || joinCodeLoading}
                      >
                        <Ionicons name="share-social-outline" size={16} color={brand} />
                        <Text style={[styles.pillBtnText, { color: brand }]}>Share</Text>
                      </TouchableOpacity>

                      {!joinCode ? (
                        <TouchableOpacity
                          style={[
                            styles.pillBtn,
                            {
                              backgroundColor: brand + "22",
                              borderColor: brand + "AA",
                              opacity: joinCodeLoading ? 0.6 : 1,
                            },
                          ]}
                          onPress={handleGenerateJoinCode}
                          activeOpacity={0.85}
                          disabled={joinCodeLoading}
                        >
                          <Ionicons name="sparkles-outline" size={16} color={brand} />
                          <Text style={[styles.pillBtnText, { color: brand }]}>Generate</Text>
                        </TouchableOpacity>
                      ) : null}

                      <TouchableOpacity
                        style={[
                          styles.pillBtn,
                          {
                            backgroundColor: theme.inputBackground + "55",
                            borderColor: theme.cardBorder + "55",
                            opacity: joinCodeLoading ? 0.6 : 1,
                          },
                        ]}
                        onPress={loadJoinCodeFromFirestore}
                        activeOpacity={0.85}
                        disabled={joinCodeLoading}
                      >
                        <Ionicons name="refresh-outline" size={16} color={theme.textMuted} />
                        <Text style={[styles.pillBtnText, { color: theme.textMuted }]}>Refresh</Text>
                      </TouchableOpacity>
                    </View>

                    <Text style={[styles.inviteHint, { color: theme.textMuted }]}>
                      Tip: Changing the join code later does NOT remove existing employees — it only affects new joins.
                    </Text>
                  </View>
                ) : null}

                {/* ✅ COMPANY / BRANDING (HIDDEN FOR EMPLOYEE) */}
                {!isEmployee ? (
                  <View
                    style={[
                      styles.sectionCard,
                      {
                        backgroundColor: cardBg,
                        borderColor: cardBorder,
                        borderTopColor: brand + "AA",
                        borderTopWidth: 2,
                      },
                    ]}
                    onLayout={(e) => registerSection("branding", e.nativeEvent.layout.y)}
                  >
                    <SectionHeader icon="briefcase-outline" title="Company / Branding" />
                    <Text style={[styles.sectionSubtitle, { color: theme.textMuted }]}>
                      Shown on PDF reports for clients and your boss.
                    </Text>

                    <View style={styles.fieldBlock}>
                      <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Company name</Text>
                      <TextInput
                        style={[
                          styles.fieldInput,
                          {
                            backgroundColor: theme.inputBackground + "F2",
                            color: theme.inputText,
                            borderColor: theme.inputBorder,
                          },
                        ]}
                        value={companyName}
                        onChangeText={setCompanyName}
                        placeholder="e.g. Reyes Electrical LLC"
                        placeholderTextColor={theme.textMuted}
                        onFocus={() => handleFocus("branding")}
                        onBlur={handleBlur}
                      />
                    </View>

                    <View style={styles.fieldBlock}>
                      <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Company phone</Text>
                      <TextInput
                        style={[
                          styles.fieldInput,
                          {
                            backgroundColor: theme.inputBackground + "F2",
                            color: theme.inputText,
                            borderColor: theme.inputBorder,
                          },
                        ]}
                        value={companyPhone}
                        onChangeText={setCompanyPhone}
                        keyboardType="phone-pad"
                        placeholder="(xxx) xxx-xxxx"
                        placeholderTextColor={theme.textMuted}
                        onFocus={() => handleFocus("branding")}
                        onBlur={handleBlur}
                      />
                    </View>

                    <View style={styles.fieldBlock}>
                      <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Company email</Text>
                      <TextInput
                        style={[
                          styles.fieldInput,
                          {
                            backgroundColor: theme.inputBackground + "F2",
                            color: theme.inputText,
                            borderColor: theme.inputBorder,
                          },
                        ]}
                        value={companyEmail}
                        onChangeText={setCompanyEmail}
                        keyboardType="email-address"
                        placeholder="you@example.com"
                        placeholderTextColor={theme.textMuted}
                        autoCapitalize="none"
                        onFocus={() => handleFocus("branding")}
                        onBlur={handleBlur}
                      />
                    </View>

                    <View style={styles.fieldBlock}>
                      <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                        License / ID / tagline
                      </Text>
                      <TextInput
                        style={[
                          styles.fieldInput,
                          {
                            backgroundColor: theme.inputBackground + "F2",
                            color: theme.inputText,
                            borderColor: theme.inputBorder,
                          },
                        ]}
                        value={companyLicense}
                        onChangeText={setCompanyLicense}
                        placeholder="e.g. NYC Master License #12345"
                        placeholderTextColor={theme.textMuted}
                        onFocus={() => handleFocus("branding")}
                        onBlur={handleBlur}
                      />
                    </View>
                  </View>
                ) : null}

                {/* ✅ DATA & BACKUP (redesigned into clean rows) */}
                <View
                  style={[
                    styles.sectionCard,
                    {
                      backgroundColor: cardBg,
                      borderColor: cardBorder,
                      borderTopColor: brand + "AA",
                      borderTopWidth: 2,
                      paddingHorizontal: 12,
                      paddingVertical: 12,
                    },
                  ]}
                  onLayout={(e) => registerSection("backup", e.nativeEvent.layout.y)}
                >
                  <SectionHeader
                    icon="shield-checkmark-outline"
                    title="Data & Backup"
                    metaRight={`Last backup: ${formatLastExport()}`}
                  />

                  <View style={{ marginTop: 6 }}>
                    <SettingsRow
                      title="Copy backup"
                      subtitle="Copies all jobs to your clipboard"
                      rightButtonText="Copy"
                      onPressButton={handleExportJobs}
                    />
                    <RowDivider />
                    <SettingsRow
                      title="Restore backup"
                      subtitle="Replaces jobs using your clipboard backup"
                      rightButtonText="Restore"
                      onPressButton={handleImportJobs}
                    />
                  </View>

                  <Text style={[styles.smallHint, { color: theme.textMuted }]}>
                    Tip: Paste your backup into Notes/Files so it’s saved outside the clipboard.
                  </Text>
                </View>

                {/* ✅ ACCOUNT (clean row) */}
                <View
                  style={[
                    styles.sectionCard,
                    {
                      backgroundColor: cardBg,
                      borderColor: cardBorder,
                      borderTopColor: brand + "AA",
                      borderTopWidth: 2,
                      paddingHorizontal: 12,
                      paddingVertical: 12,
                    },
                  ]}
                  onLayout={(e) => registerSection("account", e.nativeEvent.layout.y)}
                >
                  <SectionHeader
                    icon="person-circle-outline"
                    title={`Account${isEmployee ? " (Employee)" : isOwner ? " (Owner)" : isIndependent ? " (Independent)" : ""}`}
                  />

                  <View style={{ marginTop: 6 }}>
                    <SettingsRow
                      title="Log out"
                      subtitle="Sign out of Traktr on this device"
                      rightButtonText="Log out"
                      danger
                      onPressButton={handleLogout}
                    />
                  </View>
                </View>

                {/* ✅ ABOUT (rows + chevrons) */}
                <View
                  style={[
                    styles.sectionCard,
                    {
                      backgroundColor: cardBg,
                      borderColor: cardBorder,
                      borderTopColor: brand + "AA",
                      borderTopWidth: 2,
                      paddingHorizontal: 12,
                      paddingVertical: 12,
                    },
                  ]}
                  onLayout={(e) => registerSection("about", e.nativeEvent.layout.y)}
                >
                  <SectionHeader icon="information-circle-outline" title="About" />

                  <View style={{ marginTop: 6 }}>
                    <SettingsRow
                      title="About this app"
                      subtitle="Version, purpose, and future plans"
                      rightLabel="Details"
                      onPressRow={() => router.push("/app-info")}
                    />
                    <RowDivider />
                    <SettingsRow
                      title="Feedback"
                      subtitle="Share ideas or report issues"
                      rightLabel="Email"
                      onPressRow={handleSendFeedback}
                    />
                  </View>
                </View>

                {/* Spacer so bottom nav doesn’t feel cramped */}
                <View style={{ height: 10 }} />
              </View>
            </TouchableWithoutFeedback>
          </ScrollView>
        </View>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingTop: 48, paddingHorizontal: 16 },
  headerShell: { paddingBottom: 8 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  headerLeft: { flexDirection: "row", alignItems: "center" },
  headerIconBadge: {
    width: 30,
    height: 30,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  headerTitle: { fontSize: 18, fontFamily: "Athiti-Bold" },

  scrollContent: {
    paddingBottom: 24,
  },
  
  

  sectionCard: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
  
    // ✅ spacing between cards (works on ALL RN versions)
    marginBottom: 14,
  
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  

  // New: strong section header (fixes “disabled headers” look)
  sectionHeaderShell: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  sectionHeaderLeft: { flexDirection: "row", alignItems: "center", flexShrink: 1 },
  sectionIconBadge: {
    width: 26,
    height: 26,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  sectionTitleStrong: { fontSize: 15, fontFamily: "Athiti-Bold", flexShrink: 1 },
  sectionMetaRight: {
    fontSize: 10.5,
    textAlign: "right",
    maxWidth: "46%",
    fontFamily: "Athiti-Regular",
  },

  sectionSubtitle: { fontSize: 11, marginTop: 6, marginBottom: 6, fontFamily: "Athiti-Regular" },

  fieldBlock: { marginTop: 10 },
  fieldLabel: { fontSize: 12, fontFamily: "Athiti-SemiBold" },
  fieldHelp: { fontSize: 11, marginTop: 2, marginBottom: 4, fontFamily: "Athiti-Regular" },
  fieldInput: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 13,
    fontFamily: "Athiti-Regular",
  },

  // Row-based settings layout (this is what fixes the “mashed together” look)
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 2,
  },
  rowTextWrap: { flex: 1, paddingRight: 10 },
  rowTitleStrong: { fontSize: 13.5, fontFamily: "Athiti-SemiBold" },
  rowSubtitle: { fontSize: 11, marginTop: 2, fontFamily: "Athiti-Regular", lineHeight: 14 },

  rowRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  rowRightLabel: { fontSize: 12.5, fontFamily: "Athiti-SemiBold" },

  rowDivider: {
    height: 1,
    width: "100%",
    marginLeft: 2,
  },

  rowPillBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 34,
  },
  rowPillBtnText: { fontSize: 12, fontFamily: "Athiti-SemiBold" },

  smallHint: { marginTop: 10, fontSize: 10.5, fontFamily: "Athiti-Regular", lineHeight: 14 },

  // Company invites existing styling (kept, but headers now stronger)
  inviteActionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 10,
  },
  pillBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillBtnText: { fontSize: 12, fontFamily: "Athiti-SemiBold" },
  joinCodeText: { fontSize: 18, fontFamily: "Athiti-Bold", letterSpacing: 1.2 },
  inviteHint: { marginTop: 10, fontSize: 10.5, fontFamily: "Athiti-Regular", lineHeight: 14 },
});
