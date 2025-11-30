// app/_layout.tsx
import { Slot } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { JobsProvider } from "../context/JobsContext";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <JobsProvider>
        <StatusBar style="light" backgroundColor="#020617" />

        <Slot />
      </JobsProvider>
    </GestureHandlerRootView>
  );
}
