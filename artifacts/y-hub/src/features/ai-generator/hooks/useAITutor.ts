import { useEffect, useRef, useState } from "react";
import { useRoute } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/utils/supabaseClient";
import type { ChatMessage } from "../ai-chat/chat.types";
import { generateTutorReply } from "../ai-chat/generateTutorReply";
import {
  AiTutorClientError,
  type ExplanationLanguage,
} from "../ai-chat/aiTutorClient";
import type { KnowledgeSource } from "../knowledge/KnowledgeSources";
export function useAITutor() {
  const [, params] = useRoute("/course/:id/ai-tutor");
  const courseId = params?.id ?? "";
  const { user } = useAuth();
  const [course, setCourse] = useState<{ id: string; title: string } | null>(
      null,
    ),
    [sources, setSources] = useState<KnowledgeSource[]>([]),
    [selected, setSelected] = useState("");
  const [isLoading, setIsLoading] = useState(true),
    [errorState, setErrorState] = useState<string | null>(null),
    [isEnrolled, setIsEnrolled] = useState(false),
    [manage, setManage] = useState(false);
  const [language, setLanguage] = useState<ExplanationLanguage>("auto");
  const [messages, setMessages] = useState<ChatMessage[]>([]),
    [input, setInput] = useState(""),
    [isThinking, setIsThinking] = useState(false),
    [isIndexing, setIsIndexing] = useState(false),
    [showScratchpad, setShowScratchpad] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null),
    generation = useRef(0),
    busy = useRef(false);
  useEffect(() => {
    const g = ++generation.current;
    let alive = true;
    busy.current = false;
    setMessages([]);
    setCourse(null);
    setSources([]);
    setSelected("");
    setLanguage("auto");
    setInput("");
    setIsThinking(false);
    setIsIndexing(false);
    setIsLoading(true);
    setErrorState(null);
    const deny = () => {
      if (alive) {
        generation.current++;
        setMessages([]);
        setSources([]);
        setIsEnrolled(false);
        setManage(false);
      }
    };
    async function verify() {
      const result = await supabase.rpc("ai_tutor_access", {
        p_course: courseId,
      });
      if (result.error || result.data !== true) {
        deny();
        return false;
      }
      return alive;
    }
    void (async () => {
      try {
        if (!user || !courseId || !await verify()) return;
        const [c, s, m] = await Promise.all([
          supabase.from("courses").select("id,title").eq("id", courseId)
            .single(),
          supabase.from("ai_tutor_sources").select(
            "id,title,kind,status,material_id",
          ).eq("course_id", courseId).order("title"),
          supabase.rpc("ai_tutor_access", {
            p_course: courseId,
            p_manage: true,
          }),
        ]);
        if (!alive || generation.current !== g) return;
        if (c.error || s.error || m.error) {
          throw new Error("Knowledge service unavailable / تعذر تحميل المصادر");
        }
        setCourse(c.data);
        setSources(s.data ?? []);
        setManage(m.data === true);
        setIsEnrolled(true);
      } catch (e) {
        if (alive) {
          setErrorState(e instanceof Error ? e.message : "Unavailable");
        }
      } finally {
        if (alive) setIsLoading(false);
      }
    })();
    const timer = setInterval(() => void verify(), 15000);
    const visibility = () => {
      if (document.visibilityState === "visible") void verify();
    };
    document.addEventListener("visibilitychange", visibility);
    const auth = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user.id !== user?.id) deny();
    });
    return () => {
      alive = false;
      generation.current++;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visibility);
      auth.data.subscription.unsubscribe();
    };
  }, [courseId, user?.id]);
  useEffect(() => {
    scrollRef.current?.scrollTo?.({ top: scrollRef.current.scrollHeight });
  }, [messages, isThinking]);
  async function handleSend() {
    if (busy.current || !isEnrolled || input.trim().length < 2) return;
    busy.current = true;
    setIsThinking(true);
    const g = generation.current, question = input.trim();
    setInput("");
    setMessages(
      (m) => [...m.slice(-38), {
        id: crypto.randomUUID(),
        role: "user",
        content: question,
      }],
    );
    try {
      const reply = await generateTutorReply(
        courseId,
        question,
        selected || undefined,
        language,
      );
      if (g === generation.current) setMessages((m) => [...m, reply]);
    } catch (e) {
      if (g === generation.current) {
        if (
          e instanceof AiTutorClientError && [401, 403].includes(e.status ?? 0)
        ) {
          setMessages([]);
          setSources([]);
          setIsEnrolled(false);
        } else {setMessages(
            (m) => [...m, {
              id: crypto.randomUUID(),
              role: "ai",
              content: e instanceof Error
                ? e.message
                : "Request failed / فشل الطلب",
            }],
          );}
      }
    } finally {
      if (g === generation.current) {
        busy.current = false;
        setIsThinking(false);
      }
    }
  }
  async function handleIndex(id: string) {
    if (busy.current || !manage) return;
    const g = generation.current;
    busy.current = true;
    setIsIndexing(true);
    setErrorState(null);
    try {
      const result = await supabase.functions.invoke("ai-tutor-index", {
        body: { sourceId: id },
      });
      if (result.error) {
        throw new Error(
          "Indexing failed; verify PDF text, size and permissions. / تعذرت الفهرسة.",
        );
      }
      const list = await supabase.from("ai_tutor_sources").select(
        "id,title,kind,status,material_id",
      ).eq("course_id", courseId);
      if (list.error) throw list.error;
      if (g === generation.current) {
        setSources(list.data ?? []);
        setMessages([]);
      }
    } catch (e) {
      if (g === generation.current) {
        setErrorState(e instanceof Error ? e.message : "Index failed");
      }
    } finally {
      if (g === generation.current) {
        busy.current = false;
        setIsIndexing(false);
      }
    }
  }
  return {
    language,
    setLanguage,
    course,
    sources,
    selected,
    setSelected,
    manage,
    handleIndex,
    bookFile: sources.some((s) => s.status === "ready")
      ? { name: "Section sources / مصادر الشعبة" }
      : null,
    savedBookmarks: new Set<string>(),
    showScratchpad,
    setShowScratchpad,
    isLoading,
    errorState,
    isEnrolled,
    isIndexing,
    messages,
    input,
    setInput,
    isThinking,
    scrollRef,
    handleSend,
    handleBookmark: async () => {},
    handleTestKnowledge: async () => {},
  };
}
