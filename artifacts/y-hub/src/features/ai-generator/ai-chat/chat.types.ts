import type { QuizQuestion } from '../quiz/quiz.types';

export interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  content: string;
  citations?: string[];
  quiz?: QuizQuestion[];
  canTestKnowledge?: boolean;
}
