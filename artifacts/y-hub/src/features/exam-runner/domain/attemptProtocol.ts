import { z } from "zod";
const resultSchema = z
  .object({
    id: z.string().uuid(),
    score: z.number().int().nonnegative(),
    total_score: z.number().int().nonnegative(),
  })
  .refine((value) => value.score <= value.total_score);
const instant = z
  .string()
  .refine((value) => Number.isFinite(Date.parse(value)));
// Make sure attempt states match their deadlines and results.
const schema = z
  .object({
    status: z.enum(["not_started", "active", "submitted", "expired"]),
    attempt_id: z.string().uuid().nullable(),
    started_at: instant.nullable(),
    deadline_at: instant.nullable(),
    server_now: instant,
    result: resultSchema.nullable(),
  })
  .superRefine((value, ctx) => {
    if ((value.status === "submitted") !== (value.result !== null))
      ctx.addIssue({ code: "custom", message: "Unconfirmed exam result" });
    if (value.status === "active" || value.status === "expired") {
      if (
        !value.attempt_id ||
        !value.started_at ||
        !value.deadline_at ||
        Date.parse(value.deadline_at) <= Date.parse(value.started_at)
      )
        ctx.addIssue({ code: "custom", message: "Invalid attempt deadline" });
    }
  });
export type ExamAttempt = z.infer<typeof schema>;
export type SubmissionPhase =
  "editing" | "submitting" | "submitted" | "failed" | "expired";
export function parseAttempt(value: unknown): ExamAttempt {
  return schema.parse(value);
}

// Monotonic display clock: device wall-clock edits cannot extend the displayed time.
// Subtract the whole request duration conservatively; the RPC decides acceptance.
export function remainingSeconds(
  attempt: ExamAttempt,
  receivedAt: number,
  requestMs: number,
  now: number,
): number {
  if (attempt.status !== "active" || !attempt.deadline_at) return 0;
  return Math.max(
    0,
    Math.ceil(
      (Date.parse(attempt.deadline_at) -
        Date.parse(attempt.server_now) -
        Math.max(0, requestMs) -
        Math.max(0, now - receivedAt)) /
        1000,
    ),
  );
}
