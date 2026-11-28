import { access, type Context, input, TutorError, uuid } from "./core.ts";
import { gradeWrittenPolynomial } from "./polynomialVerifier.mjs";

export function writtenDatabaseError(error: { code?: string } | null) {
  if (error)
    throw new TutorError(
      error.code === "42501" ? 403 : error.code === "PT409" ? 409 : 503,
      "Written answer unavailable or changed",
    );
}
export async function writtenEngineAccess(ctx: Context) {
  const result = await ctx.db.rpc("authorize_engine_compute", {
    p_protocol: "ast",
    p_scope: "derive",
  });
  if (result.error || result.data !== true)
    throw new TutorError(403, "Mathematical engine access denied");
}
/** Bounded deterministic calculation: no LLM call, no key or score in response. */
export async function saveWrittenPractice(req: Request, ctx: Context) {
  const body = await input(req);
  if (
    Object.keys(body).sort().join(",") !==
      "answer,position,revision,sessionId,text" ||
    !uuid(body.sessionId) ||
    !Number.isInteger(body.position) ||
    Number(body.position) < 1 ||
    Number(body.position) > 100 ||
    !Number.isSafeInteger(body.revision) ||
    Number(body.revision) < 1 ||
    typeof body.answer !== "boolean" ||
    typeof body.text !== "string" ||
    !body.text.trim() ||
    body.text.length > 400
  )
    throw new TutorError(400, "Invalid written answer");
  if (!(await ctx.validSession())) throw new TutorError(401, "Session expired");
  const args = {
    p_actor: ctx.actor,
    p_id: body.sessionId,
    p_position: body.position,
  };
  const loaded = await ctx.admin.rpc("ai_practice_written_context", args);
  writtenDatabaseError(loaded.error);
  const context = loaded.data;
  if (
    !context ||
    !uuid(context.courseId) ||
    !["ar", "en"].includes(context.language)
  )
    throw new TutorError(503, "Question unavailable");
  await access(ctx, context.courseId);
  await writtenEngineAccess(ctx);
  const result = gradeWrittenPolynomial(
    context.verification,
    body.text,
    context.language,
  );
  await access(ctx, context.courseId);
  const saved = await ctx.admin.rpc("save_ai_practice_written_answer", {
    ...args,
    p_revision: body.revision,
    p_text: body.text,
    p_score: result.score,
    p_explanation: result.explanation,
    p_answer: body.answer,
  });
  writtenDatabaseError(saved.error);
  if (!Number.isSafeInteger(saved.data) || saved.data < 1)
    throw new TutorError(503, "Invalid acknowledgement");
  return { revision: saved.data };
}
