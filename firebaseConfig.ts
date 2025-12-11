// firebaseConfig.ts
// Centralized Firebase setup for Traktr (React Native)

import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Your actual Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyDO7IKfkLwmve7n29VG05qSX7NWrOr-Jyw",
  authDomain: "traktr.firebaseapp.com",
  projectId: "traktr",
  storageBucket: "traktr.firebasestorage.app",
  messagingSenderId: "516809486278",
  appId: "1:516809486278:web:bfee15cbc9956034d8ccc7",
};

// ✅ Initialize app only once (important for Expo fast refresh)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// ✅ Single Firebase Auth instance for the whole app
const firebaseAuth = getAuth(app);

export { app, firebaseAuth };
