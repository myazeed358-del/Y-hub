import { z } from "zod";
import { supabase } from "@/utils/supabaseClient";
import {
  practiceCitationSchema,
  PracticeSessionError,
} from "../sessionsRepository";
const uuid = z.string().uuid(),
  choice = z.number().int().min(0).max(3),
  score = z.number().int().min(0).max(1).nullable();
const state = z.enum([
  "automatic_pending",
  "needs_review",
  "requested",
  "resolved",
]);
export const assessmentSchema = z.object({
  earned: z.number().int().nonnegative(),
  graded: z.number().int().nonnegative(),
  pending: z.number().int().nonnegative(),
  excluded: z.number().int().nonnegative(),
  items: z
    .array(
      z.object({
        position: z.number().int().min(1).max(100),
        id: uuid.nullable(),
        state: z.enum([
          "unverified",
          "automatic_pending",
          "needs_review",
          "requested",
          "resolved",
        ]),
        revision: z.number().int().positive().nullable(),
        outcome: z
          .enum(["agrees", "disagrees", "uncertain", "unavailable"])
          .nullable(),
        score,
      }),
    )
    .max(100),
});
export const detailSchema = z.object({
  review: z.object({
    id: uuid,
    session_id: uuid,
    position: z.number().int(),
    course_id: uuid,
    student_id: uuid,
    state,
    auto_outcome: z.string().nullable(),
    revision: z.number().int().positive(),
    resolved_by: uuid.nullable(),
  }),
  question: z.object({
    prompt: z.string().max(3000),
    options: z.array(z.string().max(1000)).length(4),
    choice,
    suggestedChoice: choice,
    explanation: z.string().max(6000),
    citations: z.array(practiceCitationSchema).max(6),
  }),
  automatic: z.object({
    choice: choice.nullable(),
    explanation: z.string().max(4000).nullable(),
  }),
  resolution: z
    .object({
      choice: choice.nullable(),
      explanation: z.string().max(2000),
      score,
    })
    .nullable(),
});
const queueSchema = z
  .array(
    z.object({
      id: uuid,
      position: z.number().int(),
      state,
      revision: z.number().int(),
      created_at: z.string(),
      student_id: uuid,
      full_name_ar: z.string().nullable(),
      full_name_en: z.string().nullable(),
      full_name: z.string().nullable(),
      user_number: z.string().regex(/^\d{9}$/),
    }),
  )
  .max(20);
export type Assessment = z.infer<typeof assessmentSchema>;
export type ReviewDetail = z.infer<typeof detailSchema>;
export type ReviewSummary = z.infer<typeof queueSchema>[number];
async function rpc(
  name: string,
  args: Record<string, unknown>,
  signal?: AbortSignal,
) {
  let call = supabase.rpc(name, args);
  if (signal) call = call.abortSignal(signal);
  const { data, error } = await call;
  if (error)
    throw new PracticeSessionError(
      ["42501", "PGRST301", "PGRST303"].includes(error.code ?? "")
        ? "denied"
        : error.code === "PT409"
          ? "conflict"
          : "unavailable",
    );
  return data;
}
export const reviewRepository = {
  async assessment(sessionId: string, signal?: AbortSignal) {
    return assessmentSchema.parse(
      await rpc("get_ai_practice_assessment", { p_session: sessionId }, signal),
    );
  },
  async begin(sessionId: string, position: number) {
    return uuid.parse(
      await rpc("begin_ai_practice_review", {
        p_session: sessionId,
        p_position: position,
      }),
    );
  },
  async recheck(id: string) {
    const { data, error } = await supabase.functions.invoke(
      "ai-practice-recheck",
      { body: { reviewId: id } },
    );
    if (error) {
      const status = (error as { context?: { status?: number } }).context
        ?.status;
      throw new PracticeSessionError(
        status === 401 || status === 403
          ? "denied"
          : status === 409
            ? "conflict"
            : status === 429
              ? "quota"
              : "unavailable",
      );
    }
    if (data?.stored !== true) throw new PracticeSessionError("unavailable");
  },
  async request(id: string, revision: number) {
    return z
      .number()
      .int()
      .positive()
      .parse(
        await rpc("request_ai_practice_human_review", {
          p_review: id,
          p_revision: revision,
        }),
      );
  },
  async detail(id: string, signal?: AbortSignal) {
    const result = detailSchema.parse(
      await rpc("get_ai_practice_review", { p_review: id }, signal),
    );
    if (result.review.id !== id) throw new PracticeSessionError("unavailable");
    return result;
  },
  async resolve(
    id: string,
    revision: number,
    selected: number | null,
    explanation: string,
  ) {
    return z
      .number()
      .int()
      .positive()
      .parse(
        await rpc("resolve_ai_practice_review", {
          p_review: id,
          p_revision: revision,
          p_choice: choice.nullable().parse(selected),
          p_explanation: z.string().trim().min(10).max(2000).parse(explanation),
        }),
      );
  },
  async queue(
    courseId: string,
    resolved: boolean,
    offset: number,
    signal?: AbortSignal,
  ) {
    return queueSchema.parse(
      await rpc(
        "list_ai_practice_reviews",
        { p_course: courseId, p_resolved: resolved, p_offset: offset },
        signal,
      ),
    );
  },
};
