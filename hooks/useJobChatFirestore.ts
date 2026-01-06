// hooks/useJobChatFirestore.ts
import {
    addDoc,
    collection,
    limit,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { db } from "../firebaseConfig"; // <- adjust if your path differs

export type ChatIntent = "progress" | "issue" | "materials" | "other";

export type ChatMessage = {
  id: string;
  authorLabel: string;
  role: "you" | "boss" | "employee";
  text: string;
  createdAt: number;
  intent: ChatIntent;
  imageUri?: string | null;
  senderUid?: string;
};

type Params = {
  companyId: string;
  jobId: string;
};

export function useJobChatFirestore({ companyId, jobId }: Params) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const messagesRef = useMemo(() => {
    return collection(db, "companies", companyId, "jobs", jobId, "messages");
  }, [companyId, jobId]);

  useEffect(() => {
    if (!companyId || !jobId) return;

    const q = query(messagesRef, orderBy("createdAt", "asc"), limit(250));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const next: ChatMessage[] = snap.docs.map((d) => {
          const data: any = d.data();

          // Firestore timestamp -> ms
          const createdAtMs =
            data?.createdAt?.toMillis?.() ??
            (typeof data?.createdAt === "number" ? data.createdAt : Date.now());

          return {
            id: d.id,
            authorLabel: data.authorLabel ?? "Member",
            role: data.role ?? "employee",
            text: data.text ?? "",
            createdAt: createdAtMs,
            intent: data.intent ?? "other",
            imageUri: data.imageUri ?? null,
            senderUid: data.senderUid,
          };
        });

        setMessages(next);
        setIsLoaded(true);
      },
      (err) => {
        console.warn("Chat snapshot error:", err);
        setIsLoaded(true);
      }
    );

    return () => unsub();
  }, [messagesRef, companyId, jobId]);

  async function sendMessage(input: {
    text: string;
    authorLabel: string;
    role: "you" | "boss" | "employee";
    intent: ChatIntent;
    imageUri?: string | null;
    senderUid?: string;
  }) {
    if (!companyId || !jobId) return;

    await addDoc(messagesRef, {
      text: input.text,
      authorLabel: input.authorLabel,
      role: input.role,
      intent: input.intent,
      imageUri: input.imageUri ?? null,
      senderUid: input.senderUid ?? null,
      createdAt: serverTimestamp(),
    });
  }

  return { messages, isLoaded, sendMessage };
}
