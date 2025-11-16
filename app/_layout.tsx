// app/_layout.tsx
import { Slot } from "expo-router";
import { JobsProvider } from "../context/JobsContext";

export default function RootLayout() {
  return (
    <JobsProvider>
      {/* Slot = render whatever child layouts/screens belong here */}
      <Slot />
    </JobsProvider>
  );
}
