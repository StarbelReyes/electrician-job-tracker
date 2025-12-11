// hooks/useJobChatStore.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

export type ChatIntent = "progress" | "issue" | "materials" | "other";

export type ChatMessage = {
  id: string;
  authorLabel: string; // "You", "Vic", etc.
  role: "you" | "boss" | "employee";
  text: string;
  createdAt: number;
  intent: ChatIntent | null;
  imageUri?: string | null;
};

type UseJobChatStoreArgs = {
  jobId: string;
  seedMessages: ChatMessage[];
};

const STORAGE_PREFIX = "EJT_JOB_CHAT_V1";

export function useJobChatStore({ jobId, seedMessages }: UseJobChatStoreArgs) {
  const storageKey = `${STORAGE_PREFIX}_${jobId || "default"}`;

  const [messages, setMessages] = useState<ChatMessage[]>(seedMessages);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from AsyncStorage on mount
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const raw = await AsyncStorage.getItem(storageKey);
        if (!raw) {
          if (!cancelled) setMessages(seedMessages);
          return;
        }

        const parsed = JSON.parse(raw);
        if (!cancelled && Array.isArray(parsed)) {
          setMessages(parsed);
        }
      } catch (e) {
        console.warn("Failed to load job chat:", e);
        if (!cancelled) setMessages(seedMessages);
      } finally {
        if (!cancelled) setIsLoaded(true);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  // Save whenever messages change
  useEffect(() => {
    if (!isLoaded) return;

    const save = async () => {
      try {
        await AsyncStorage.setItem(storageKey, JSON.stringify(messages));
      } catch (e) {
        console.warn("Failed to save job chat:", e);
      }
    };

    save();
  }, [messages, isLoaded, storageKey]);

  const appendMessage = (msg: ChatMessage) => {
    setMessages((prev) => [...prev, msg]);
  };

  return {
    messages,
    appendMessage,
    setMessages,
    isLoaded,
  };
}

// ↙ add this so default import also works
export default useJobChatStore;
