import { z } from "zod";
import { supabase } from "@/utils/supabaseClient";
import { PracticeSessionError } from "../sessionsRepository";
const count = z.number().int().nonnegative();
const percent = z.number().min(0).max(100);
const category = z.object({
  earned: count,
  graded: count,
  pending: count,
  excluded: count,
  percent: percent.nullable(),
});
export const summarySchema = z.object({
  score: percent.nullable(),
  coverage: percent,
  practice: category,
  exam: category,
});
export const performanceSchema = z.object({
  courseId: z.string().uuid(),
  canManage: z.boolean(),
  weights: z
    .object({ practice: percent.int(), exam: percent.int(), revision: count })
    .refine((w) => w.practice + w.exam === 100),
  summary: summarySchema,
  units: z
    .array(
      z.object({
        unitId: z.string().uuid().nullable(),
        title: z.string().nullable(),
        summary: summarySchema,
      }),
    )
    .max(20),
  unitCount: count,
  offset: count,
  hasMore: z.boolean(),
  unavailableSessions: count,
});
export type Performance = z.infer<typeof performanceSchema>;
export type PerformanceSummary = z.infer<typeof summarySchema>;
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
export const performanceRepository = {
  async read(courseId: string, offset: number, signal?: AbortSignal) {
    const data = performanceSchema.parse(
      await rpc(
        "read_ai_practice_performance",
        { p_course: courseId, p_offset: offset },
        signal,
      ),
    );
    if (data.courseId !== courseId || data.offset !== offset)
      throw new PracticeSessionError("unavailable");
    return data;
  },
  async save(
    courseId: string,
    revision: number,
    practice: number,
    exam: number,
  ) {
    const weights = z
      .object({ practice: percent.int(), exam: percent.int() })
      .refine((w) => w.practice + w.exam === 100)
      .parse({ practice, exam });
    return count.parse(
      await rpc("set_ai_practice_performance_weights", {
        p_course: courseId,
        p_revision: revision,
        p_practice: weights.practice,
        p_exam: weights.exam,
      }),
    );
  },
};
