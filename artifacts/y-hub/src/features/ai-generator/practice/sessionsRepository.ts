import { z } from "zod";
import { supabase } from "@/utils/supabaseClient";
import type { SourceSelection } from "./sourcesRepository";
const uuid = z.string().uuid(),
  choice = z.number().int().min(0).max(3);
export const practiceCitationSchema = z.object({
  id: uuid,
  source_id: uuid,
  revision: uuid,
  title: z.string(),
  text: z.string().max(1800),
  page: z.number().int().nullable(),
  unit_id: uuid.nullable(),
});
export const sessionSchema = z.object({
  id: uuid,
  courseId: uuid,
  mode: z.enum(["practice", "exam"]),
  difficulty: z.enum(["easy", "medium", "hard"]),
  language: z.enum(["ar", "en"]),
  target: z.number().int().min(1).max(100),
  revision: z.number().int().positive(),
  submittedAt: z.string().nullable(),
  questions: z
    .array(
      z.object({
        position: z.number().int().min(1).max(100),
        prompt: z.string().max(3000),
        options: z.array(z.string().max(1000)).length(4),
        choice: choice.nullable(),
        answered: z.boolean(),
        feedback: z
          .object({
            suggestedChoice: choice,
            matchesSuggestion: z.boolean().nullable(),
            explanation: z.string().max(6000),
            citations: z.array(practiceCitationSchema).min(1).max(6),
            verification: z
              .literal("polynomial-derivative-v1")
              .nullable()
              .optional(),
          })
          .nullable(),
      }),
    )
    .max(100),
});
export type PracticeSession = z.infer<typeof sessionSchema>;
const listSchema = z
  .array(
    z.object({
      id: uuid,
      mode: z.enum(["practice", "exam"]),
      difficulty: z.string(),
      language: z.string(),
      target: z.number(),
      created_at: z.string(),
      updated_at: z.string(),
      submitted_at: z.string().nullable(),
    }),
  )
  .max(20);
export type SessionSummary = z.infer<typeof listSchema>[number];
export type PracticeScope = {
  selection: SourceSelection;
  units: string[];
  query: string;
};
export type SessionSettings = {
  mode: "practice" | "exam";
  difficulty: "easy" | "medium" | "hard";
  language: "ar" | "en";
  target: number;
  allowRepeats: boolean;
};
export class PracticeSessionError extends Error {
  constructor(
    readonly kind:
      | "denied"
      | "conflict"
      | "repeated"
      | "insufficient"
      | "quota"
      | "unavailable",
  ) {
    super(kind);
  }
}
function check(error: { code?: string } | null) {
  if (error)
    throw new PracticeSessionError(
      ["42501", "PGRST301", "PGRST303"].includes(error.code ?? "")
        ? "denied"
        : error.code === "PT409"
          ? "conflict"
          : error.code === "PT422"
            ? "insufficient"
            : "unavailable",
    );
}
export const sessionsRepository = {
  async create(
    id: string,
    courseId: string,
    scope: PracticeScope,
    settings: SessionSettings,
  ) {
    const { data, error } = await supabase.rpc("create_ai_practice_session", {
      p_id: id,
      p_course: courseId,
      p_selection: scope.selection,
      p_units: scope.units,
      p_query: scope.query,
      p_mode: settings.mode,
      p_difficulty: settings.difficulty,
      p_language: settings.language,
      p_target: settings.target,
      p_allow_repeats: settings.allowRepeats,
    });
    check(error);
    return uuid.parse(data);
  },
  async read(id: string, signal?: AbortSignal) {
    let query = supabase.rpc("read_ai_practice_session", { p_id: id });
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query;
    check(error);
    const result = sessionSchema.parse(data);
    if (result.id !== id) throw new PracticeSessionError("unavailable");
    return result;
  },
  async list(courseId: string, offset: number, signal?: AbortSignal) {
    let query = supabase.rpc("list_ai_practice_sessions", {
      p_course: courseId,
      p_offset: offset,
    });
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query;
    check(error);
    return listSchema.parse(data);
  },
  async save(
    session: PracticeSession,
    position: number,
    selected: number,
    answer = false,
  ) {
    const { data, error } = await supabase.rpc("save_ai_practice_answer", {
      p_id: session.id,
      p_position: position,
      p_revision: session.revision,
      p_choice: choice.parse(selected),
      p_answer: answer,
    });
    check(error);
    return z.number().int().positive().parse(data);
  },
  async submit(session: PracticeSession) {
    const { error } = await supabase.rpc("submit_ai_practice_session", {
      p_id: session.id,
      p_revision: session.revision,
    });
    check(error);
  },
  async generate(id: string, position: number) {
    const { data, error } = await supabase.functions.invoke(
      "ai-practice-generate",
      { body: { sessionId: id, position } },
    );
    if (error) {
      const status = (error as { context?: { status?: number } }).context
        ?.status;
      // A repeated proposal is not a stale draft/source conflict. Preserve the
      // current session and offer an explicit retry; never silently charge again.
      const response = (error as { context?: unknown }).context;
      if (status === 409 && response instanceof Response) {
        const body = await response
          .clone()
          .json()
          .catch(() => null);
        if (body?.error === "Repeated or equivalent practice question")
          throw new PracticeSessionError("repeated");
      }
      throw new PracticeSessionError(
        status === 401 || status === 403
          ? "denied"
          : status === 409
            ? "conflict"
            : status === 422
              ? "insufficient"
              : status === 429
                ? "quota"
                : "unavailable",
      );
    }
    if (data?.stored !== true) throw new PracticeSessionError("unavailable");
  },
};
