// firebaseConfig.ts
// Centralized Firebase setup for Traktr (React Native)

import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// 🔑 Your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyDO7IKfkLwmve7n29VG05qSX7NWrOr-Jyw",
  authDomain: "traktr.firebaseapp.com",
  projectId: "traktr",
  storageBucket: "traktr.firebasestorage.app",
  messagingSenderId: "516809486278",
  appId: "1:516809486278:web:bfee15cbc9956034d8ccc7",
};

// ✅ Initialize Firebase app ONCE (Expo-safe)
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// ✅ Firebase services bound to the SAME app
export const firebaseAuth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Optional (only if you import app elsewhere)
export { app };
