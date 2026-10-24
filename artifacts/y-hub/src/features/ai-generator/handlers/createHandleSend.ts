import type { Dispatch, SetStateAction } from "react";
import type { ChatMessage } from "@/features/ai-generator/ai-chat/chat.types";
import type { SemanticChunk } from "@/features/ai-generator/document-analysis/document.types";
import { generateTutorReply } from "@/features/ai-generator/ai-chat/generateTutorReply";
import { AiTutorClientError } from "@/features/ai-generator/ai-chat/aiTutorClient";

interface SendDependencies {
  courseId: string;
  input: string;
  bookFile: unknown;
  isIndexing: boolean;
  isThinking: boolean;
  chunks: SemanticChunk[];
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  setInput: Dispatch<SetStateAction<string>>;
  setIsThinking: Dispatch<SetStateAction<boolean>>;
}

export function createHandleSend({
  courseId,
  input,
  bookFile,
  isIndexing,
  isThinking,
  chunks,
  setMessages,
  setInput,
  setIsThinking,
}: SendDependencies) {
  return async () => {
    if (!input.trim() || !bookFile || isIndexing || isThinking) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: input,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsThinking(true);

    try {
      const aiResponse = await generateTutorReply(
        courseId,
        userMsg.content,
        undefined,
      );
      setMessages((prev) => [...prev, aiResponse]);
    } catch (e) {
      console.error("AI Tutor request failed:", e);
      const errorMessage = e instanceof AiTutorClientError
        ? e.message
        : "Sorry, I encountered an error while processing your request.";
      setMessages((prev) => [...prev, {
        id: crypto.randomUUID(),
        role: "ai",
        content: errorMessage,
      }]);
    } finally {
      setIsThinking(false);
    }
  };
}
