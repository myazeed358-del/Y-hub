import type { ChatMessage } from "./chat.types";
import { askAiTutor, type ExplanationLanguage } from "./aiTutorClient";
export async function generateTutorReply(
  courseId: string,
  question: string,
  sourceId?: string,
  language?: ExplanationLanguage,
): Promise<ChatMessage> {
  const result = await askAiTutor({
    courseId,
    question,
    sourceId,
    ...(language ? { language } : {}),
  });
  return {
    id: crypto.randomUUID(),
    role: "ai",
    content: result.answer,
    sources: result.citations,
    canTestKnowledge: false,
  };
}
