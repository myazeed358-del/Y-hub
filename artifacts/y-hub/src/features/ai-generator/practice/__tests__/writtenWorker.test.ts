import { beforeEach, expect, it, vi } from "vitest";
import { saveWrittenPractice } from "../../../../../supabase/functions/_shared/tutor/practiceWritten";
import { recheckPractice } from "../../../../../supabase/functions/_shared/tutor/practiceReview";
import type { Context } from "../../../../../supabase/functions/_shared/tutor/core";
const id = "123e4567-e89b-42d3-a456-426614174000";
const verification = {
  method: "polynomial-derivative-v1",
  task: {
    kind: "polynomial_derivative",
    variable: "x",
    coefficients: [0, 0, 1],
    options: [[0, 2], [0], [1], [2]],
  },
};
const body = {
  sessionId: id,
  position: 1,
  revision: 2,
  text: "2x",
  answer: false,
};
const req = (value: unknown) =>
  new Request("https://local", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  });
let ctx: Context;
let rpc: ReturnType<typeof vi.fn>;
beforeEach(() => {
  rpc = vi.fn(async (name: string) => ({
    error: null,
    data:
      name === "ai_practice_written_context"
        ? { courseId: id, language: "ar", verification }
        : name === "ai_practice_review_context"
          ? {
              courseId: id,
              language: "ar",
              verification,
              writtenAnswer: "2x",
              revision: 1,
              done: false,
            }
          : name === "save_ai_practice_written_answer"
            ? 3
            : true,
  }));
  ctx = {
    actor: id,
    db: { rpc, from: vi.fn() },
    admin: { rpc, from: vi.fn() },
    env: vi.fn(),
    fetch: vi.fn(),
    validSession: vi.fn(async () => true),
  };
});
it("computes server-side, returns only revision, and spends no provider quota", async () => {
  expect(await saveWrittenPractice(req(body), ctx)).toEqual({ revision: 3 });
  expect(rpc).toHaveBeenCalledWith(
    "save_ai_practice_written_answer",
    expect.objectContaining({
      p_actor: id,
      p_text: "2x",
      p_score: 1,
      p_revision: 2,
      p_answer: false,
    }),
  );
  expect(ctx.fetch).not.toHaveBeenCalled();
  expect(rpc.mock.calls.some((c) => c[0] === "begin_ai_tutor_request")).toBe(
    false,
  );
});
it("stores unsupported text as pending, not zero", async () => {
  await saveWrittenPractice(req({ ...body, text: "sin(x)" }), ctx);
  expect(rpc).toHaveBeenCalledWith(
    "save_ai_practice_written_answer",
    expect.objectContaining({ p_score: null }),
  );
});
it.each(["score", "actor", "verification", "evidence", "courseId"])(
  "rejects a forged %s before any work",
  async (key) => {
    await expect(
      saveWrittenPractice(req({ ...body, [key]: 1 }), ctx),
    ).rejects.toMatchObject({ status: 400 });
    expect(rpc).not.toHaveBeenCalled();
  },
);
it.each([
  { text: "" },
  { text: "x".repeat(401) },
  { position: 101 },
  { revision: 0 },
  { answer: null },
])("rejects malformed input %#", async (patch) => {
  await expect(
    saveWrittenPractice(req({ ...body, ...patch }), ctx),
  ).rejects.toMatchObject({ status: 400 });
});
it("rechecks expiry before publication", async () => {
  ctx.validSession = vi
    .fn()
    .mockResolvedValueOnce(true)
    .mockResolvedValueOnce(true)
    .mockResolvedValue(false);
  await expect(saveWrittenPractice(req(body), ctx)).rejects.toMatchObject({
    status: 401,
  });
  expect(
    rpc.mock.calls.some((c) => c[0] === "save_ai_practice_written_answer"),
  ).toBe(false);
});
it.each(["42501", "PT409"])(
  "does not report a rejected write as saved (%s)",
  async (code) => {
    const base = rpc.getMockImplementation()!;
    rpc.mockImplementation((name, ...args) =>
      name === "save_ai_practice_written_answer"
        ? { data: null, error: { code } }
        : base(name, ...args),
    );
    await expect(saveWrittenPractice(req(body), ctx)).rejects.toMatchObject({
      status: code === "42501" ? 403 : 409,
    });
  },
);
it("requires current engine authorization", async () => {
  const base = rpc.getMockImplementation()!;
  rpc.mockImplementation((name, ...args) =>
    name === "authorize_engine_compute"
      ? { data: false, error: null }
      : base(name, ...args),
  );
  await expect(saveWrittenPractice(req(body), ctx)).rejects.toMatchObject({
    status: 403,
  });
});
it("rechecks the stored written answer deterministically without a model or public score", async () => {
  expect(await recheckPractice(req({ reviewId: id }), ctx)).toEqual({
    stored: true,
  });
  expect(rpc).toHaveBeenCalledWith(
    "publish_ai_practice_written_recheck",
    expect.objectContaining({
      p_actor: id,
      p_review: id,
      p_score: 1,
      p_revision: 1,
    }),
  );
  expect(ctx.fetch).not.toHaveBeenCalled();
});
it("records an unresolved recheck after engine revocation so human review remains possible", async () => {
  const base = rpc.getMockImplementation()!;
  rpc.mockImplementation((name, ...args) =>
    name === "authorize_engine_compute"
      ? { data: false, error: null }
      : base(name, ...args),
  );
  expect(await recheckPractice(req({ reviewId: id }), ctx)).toEqual({
    stored: true,
  });
  expect(rpc).toHaveBeenCalledWith(
    "publish_ai_practice_written_recheck",
    expect.objectContaining({ p_score: null }),
  );
  expect(ctx.fetch).not.toHaveBeenCalled();
});
