import type { ChatMessage } from './chat.types';
import type { SemanticChunk } from '../document-analysis/document.types';
import { searchChunks } from '../document-search/searchChunks';
import { askAiTutor } from './aiTutorClient';

function isInsufficientContextAnswer(answer: string): boolean {
  const normalized = answer
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

  // Temporary recognition until the API returns structured evidence.
  return [
    /\b(?:provided|supplied|retrieved)\s+(?:excerpts?|context|text|passages?)\s+(?:do not|does not|don't|doesn't)\s+(?:contain|include|mention|provide)\b/,
    /\b(?:provided|supplied|retrieved)\s+(?:excerpts?|context|text|passages?)\s+(?:contain|include)\s+no\b/,
    /\b(?:insufficient|not enough)\s+(?:information|context)\b.{0,100}\b(?:provided|supplied|retrieved|uploaded)\b/,
    /\b(?:cannot|can't|unable to)\s+answer\b.{0,120}\b(?:provided|supplied|retrieved|uploaded)\b/,
    /لا (?:تحتوي|تتضمن) (?:المقاطع|المقتطفات|النصوص)/,
    /(?:المقاطع|المقتطفات|النصوص)(?: المقدمة)? لا (?:تحتوي|تتضمن)/,
    /لا توجد معلومات كافية/,
  ].some(pattern => pattern.test(normalized));
}

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

  const insufficientContext = isInsufficientContextAnswer(answer);

  return {
    id: crypto.randomUUID(),
    role: 'ai',
    content: answer,
    // Retrieved pages are context labels, not verified citations.
    citations: insufficientContext
      ? []
      : [...new Set(relevantChunks.map(chunk => chunk.source))],
    canTestKnowledge: !insufficientContext,
  };
}
