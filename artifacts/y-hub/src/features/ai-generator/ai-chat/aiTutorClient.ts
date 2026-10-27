import { supabase } from "@/utils/supabaseClient";
export interface TutorCitation {
  id: string;
  source_id: string;
  revision: string;
  title: string;
  page: number | null;
  unit_id: string | null;
  text: string;
}
export type ExplanationLanguage = "auto" | "ar" | "en";
export interface AiTutorRequest {
  language?: ExplanationLanguage;
  courseId: string;
  question: string;
  sourceId?: string;
}
export interface AiTutorResponse {
  answer: string;
  citations: TutorCitation[];
  insufficient: boolean;
}
export class AiTutorClientError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "AiTutorClientError";
  }
}
export async function askAiTutor(
  request: AiTutorRequest,
): Promise<AiTutorResponse> {
  const { courseId, sourceId, language } = request;
  if (language !== undefined && !["auto", "ar", "en"].includes(language)) {
    throw new AiTutorClientError("Invalid explanation language.");
  }
  const question = request.question?.trim();
  if (!/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(courseId)) {
    throw new AiTutorClientError("Invalid course ID.");
  }
  if (!question || question.length < 2 || question.length > 1500) {
    throw new AiTutorClientError("Question must contain 2–1500 characters.");
  }
  let result;
  try {
    result = await supabase.functions.invoke<AiTutorResponse>("ai-tutor-chat", {
      body: {
        courseId,
        question,
        ...(sourceId ? { sourceId } : {}),
        ...(language && language !== "auto" ? { language } : {}),
      },
    });
  } catch {
    throw new AiTutorClientError("Cannot connect to AI Tutor. / تعذر الاتصال.");
  }
  if (result.error) {
    const status = (result.error as { context?: { status?: number } }).context
      ?.status;
    throw new AiTutorClientError(
      status === 401
        ? "Please sign in again. / سجّل الدخول مجددًا."
        : status === 403
        ? "Course access denied. / لا تملك صلاحية الوصول."
        : status === 429
        ? "AI Tutor quota or concurrent request limit reached. / تم بلوغ حد الطلبات."
        : status === 409
        ? "Sources changed; retry. / تغيرت المصادر؛ أعد المحاولة."
        : "AI Tutor unavailable. / المعلم غير متاح حاليًا.",
      status,
    );
  }
  // Don't pass an unexpected response shape to the chat UI.
  const data = result.data;
  if (
    !data || typeof data.answer !== "string" || !data.answer.trim() ||
    typeof data.insufficient !== "boolean" || !Array.isArray(data.citations) ||
    data.citations.length > 6 ||
    data.citations.some((c) =>
      !c || typeof c.id !== "string" || typeof c.source_id !== "string" ||
      typeof c.text !== "string" || typeof c.title !== "string" ||
      (c.page !== null && (!Number.isInteger(c.page) || c.page < 1))
    )
  ) throw new AiTutorClientError("Invalid AI Tutor response.");
  return { ...data, answer: data.answer.trim() };
}
