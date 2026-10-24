import type { ChatMessage } from "./chat.types";
import { askAiTutor } from "./aiTutorClient";
export async function generateTutorReply(
  courseId: string,
  question: string,
  sourceId?: string,
): Promise<ChatMessage> {
  const result = await askAiTutor({ courseId, question, sourceId });
  return {
    id: crypto.randomUUID(),
    role: "ai",
    content: result.answer,
    sources: result.citations,
    canTestKnowledge: false,
  };
}
