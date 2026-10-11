import { supabase } from '@/utils/supabaseClient';
import type { SemanticChunk } from '../document-analysis/document.types';

export interface AiTutorRequest {
  courseId: string;
  question: string;
  chunks: SemanticChunk[];
}

export interface AiTutorResponse {
  answer: string;
}

export class AiTutorClientError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = 'AiTutorClientError';
  }
}

export async function askAiTutor(
  request: AiTutorRequest
): Promise<string> {
  const { courseId, chunks } = request;
  const question = request.question?.trim();

  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!uuidPattern.test(courseId)) {
    throw new AiTutorClientError('Invalid course ID.');
  }

  if (!question || question.length < 2 || question.length > 1500) {
    throw new AiTutorClientError('Question must contain 2–1500 characters.');
  }

  if (
    !Array.isArray(chunks) ||
    chunks.length < 1 ||
    chunks.length > 4 ||
    !chunks.every(chunk =>
      chunk !== null &&
      typeof chunk === 'object' &&
      typeof chunk.text === 'string' &&
      chunk.text.trim().length > 0 &&
      chunk.text.length <= 2000 &&
      typeof chunk.source === 'string' &&
      chunk.source.length <= 80
    )
  ) {
    throw new AiTutorClientError('Provide 1 to 4 valid document excerpts.');
  }

  const payload = { courseId, question, chunks };

  if (new TextEncoder().encode(JSON.stringify(payload)).length > 16000) {
    throw new AiTutorClientError('AI Tutor request is too large.');
  }

  let result: Awaited<ReturnType<
    typeof supabase.functions.invoke<AiTutorResponse>
  >>;

  try {
    result = await supabase.functions.invoke<AiTutorResponse>(
      'ai-tutor-chat',
      { body: payload }
    );
  } catch {
    throw new AiTutorClientError('Cannot connect to AI Tutor.');
  }

  if (result.error) {
    const context = (
      result.error as { context?: { status?: number } }
    ).context;

    const status = context?.status;

    if (status === 401) {
      throw new AiTutorClientError('Please sign in again.', status);
    }

    if (status === 403) {
      throw new AiTutorClientError('Course access denied.', status);
    }

    if (status === 429) {
      throw new AiTutorClientError(
        'AI Tutor rate limit or question quota reached.',
        status
      );
    }

    throw new AiTutorClientError(
      'AI Tutor service is unavailable.',
      status
    );
  }

  const answer = result.data?.answer;

  if (typeof answer !== 'string' || !answer.trim()) {
    throw new AiTutorClientError('Invalid AI Tutor response.');
  }

  return answer.trim();
}
