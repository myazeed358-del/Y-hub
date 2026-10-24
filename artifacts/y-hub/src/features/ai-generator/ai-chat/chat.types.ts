import type { QuizQuestion } from "../quiz/quiz.types";

export interface ChatMessage {
  id: string;
  role: "user" | "ai";
  content: string;
  citations?: string[];
  sources?: import("./aiTutorClient").TutorCitation[];
  quiz?: QuizQuestion[];
  canTestKnowledge?: boolean;
}
