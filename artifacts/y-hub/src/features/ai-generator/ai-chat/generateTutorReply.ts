import type { ChatMessage } from './chat.types';
import type { SemanticChunk } from '../document-analysis/document.types';
import { searchChunks } from '../document-search/searchChunks';
import { askAiTutor } from './aiTutorClient';

export async function generateTutorReply(
  courseId: string,
  question: string,
  chunks: SemanticChunk[]
): Promise<ChatMessage> {
  const relevantChunks = searchChunks(question, chunks);

  // Do not consume AI quota when no matching text was found.
  if (relevantChunks.length === 0) {
    return {
      id: crypto.randomUUID(),
      role: 'ai',
      content:
        'I could not find relevant information in the uploaded textbook. Please try a more specific question.',
      citations: [],
    };
  }

  // Errors are propagated. Never silently replace real AI failures
  // with template-based answers.
  const answer = await askAiTutor({
    courseId,
    question,
    chunks: relevantChunks,
  });

  return {
    id: crypto.randomUUID(),
    role: 'ai',
    content: answer,
    // These are retrieved context labels, not verified AI citations.
    citations: [...new Set(relevantChunks.map(chunk => chunk.source))],
    canTestKnowledge: true,
  };
}
