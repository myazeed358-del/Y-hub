import { beforeEach, expect, it, vi } from "vitest";
import {
  generatePractice,
  parsePracticeProposal,
  practiceInstructions,
} from "../../../../../supabase/functions/_shared/tutor/practice";
import type { Context } from "../../../../../supabase/functions/_shared/tutor/core";
const id = "123e4567-e89b-42d3-a456-426614174000";
const evidence = {
  id: "evidence",
  source_id: id,
  revision: id,
  title: "Book",
  text: "Derivative $x^2$ is $2x$.",
  page: 2,
  unit_id: null,
};
const proposal = {
  insufficient: false,
  prompt: "مشتقة $x^2$؟",
  options: ["$2x$", "$3x$", "$4x$", "$5x$"],
  correct: 0,
  explanation: "قاعدة القوة",
  evidenceIds: ["evidence"],
};
const mathProposal = {
  insufficient: false,
  task: {
    kind: "polynomial_derivative",
    variable: "x",
    coefficients: [0, 0, 1],
    options: [
      [0, 2],
      [0, 3],
      [0, 4],
      [0, 5],
    ],
  },
  evidenceIds: ["evidence"],
};
let ctx: Context;
let rpc: ReturnType<typeof vi.fn>;
let fetcher: ReturnType<typeof vi.fn>;
const request = (body: unknown = { sessionId: id, position: 1 }) =>
  new Request("http://local", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  rpc = vi.fn(async (name: string) => ({
    error: null,
    data:
      name === "ai_practice_generation_context"
        ? {
            courseId: id,
            exists: false,
            selection: [],
            units: [],
            query: "",
            language: "ar",
            difficulty: "medium",
            previous: [],
          }
        : name === "ai_tutor_access"
          ? true
          : name === "retrieve_ai_practice_evidence"
            ? [evidence]
            : "lease",
  }));
  fetcher = vi.fn(async () =>
    Response.json({
      choices: [{ message: { content: JSON.stringify(proposal) } }],
    }),
  );
  ctx = {
    actor: "authenticated-actor",
    db: { rpc, from: vi.fn() },
    admin: { rpc, from: vi.fn() },
    env: (k) => (k === "GROQ_API_KEY" ? "local-fixture" : undefined),
    fetch: fetcher,
    validSession: async () => true,
  };
});
it("persists server-validated evidence IDs but never returns the key to the client", async () => {
  expect(await generatePractice(request(), ctx)).toEqual({ stored: true });
  const call = rpc.mock.calls.find(
    (c) => c[0] === "publish_ai_practice_question",
  )!;
  expect(call[1]).toMatchObject({
    p_actor: "authenticated-actor",
    p_id: id,
    p_question: { correct: 0 },
    p_evidence_ids: ["evidence"],
  });
  expect(rpc.mock.calls.filter((c) => c[0] === "ai_tutor_access")).toHaveLength(
    2,
  );
  expect(JSON.parse(fetcher.mock.calls[0][1].body).max_completion_tokens).toBe(
    2200,
  );
  expect(practiceInstructions("ar", "hard")).toContain("fluent Arabic");
  expect(practiceInstructions("en", "easy")).toContain("English");
});
it("computes the mathematical key on the server and publishes only through the guarded math RPC", async () => {
  const base = rpc.getMockImplementation()!;
  rpc.mockImplementation((name, ...args) =>
    name === "authorize_engine_compute"
      ? Promise.resolve({ data: true, error: null })
      : base(name, ...args),
  );
  fetcher.mockResolvedValue(
    Response.json({
      choices: [{ message: { content: JSON.stringify(mathProposal) } }],
    }),
  );
  expect(await generatePractice(request(), ctx)).toEqual({ stored: true });
  const call = rpc.mock.calls.find(
    (c) => c[0] === "publish_ai_practice_math_question",
  )!;
  expect(call[1]).toMatchObject({
    p_question: { correct: 0, prompt: expect.stringContaining("اختر مشتقة") },
    p_verification: { method: "polynomial-derivative-v1" },
  });
  expect(
    rpc.mock.calls.some((c) => c[0] === "publish_ai_practice_question"),
  ).toBe(false);
});
it("rejects a model attempting to use an engine not authorized for the user", async () => {
  fetcher.mockResolvedValue(
    Response.json({
      choices: [{ message: { content: JSON.stringify(mathProposal) } }],
    }),
  );
  await expect(generatePractice(request(), ctx)).rejects.toMatchObject({
    status: 403,
  });
  expect(
    rpc.mock.calls.some((c) => c[0] === "publish_ai_practice_math_question"),
  ).toBe(false);
});
it.each([
  { ...mathProposal, correct: 0 },
  { ...mathProposal, evidenceIds: ["forged"] },
  {
    ...mathProposal,
    task: { ...mathProposal.task, options: [[0], [1], [2], [3]] },
  },
])("cannot attach a fake key, evidence or unsupported proof %#", (p) => {
  expect(() => parsePracticeProposal(p, [evidence], "ar")).toThrow();
});
it.each(["actor", "evidence", "correct", "courseId"])(
  "rejects forged %s before any work",
  async (key) => {
    await expect(
      generatePractice(
        request({ sessionId: id, position: 1, [key]: "forged" }),
        ctx,
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(rpc).not.toHaveBeenCalled();
  },
);
it("recovers a lost acknowledgement without charging or regenerating", async () => {
  rpc.mockResolvedValueOnce({
    data: { exists: true, courseId: id },
    error: null,
  });
  expect(await generatePractice(request(), ctx)).toEqual({ stored: true });
  expect(fetcher).not.toHaveBeenCalled();
  expect(rpc.mock.calls.some((c) => c[0] === "begin_ai_tutor_request")).toBe(
    false,
  );
});
it.each([
  { ...proposal, evidenceIds: ["forged"] },
  { ...proposal, correct: 4 },
  { ...proposal, options: ["a", "a", "b", "c"] },
  { ...proposal, html: "extra" },
  { ...proposal, explanation: "" },
])("rejects malformed/unsupported proposal %#", (p) => {
  expect(() => parsePracticeProposal(p, [evidence])).toThrow();
});
it("fails honestly on insufficient evidence", () => {
  expect(() =>
    parsePracticeProposal({ insufficient: true }, [evidence]),
  ).toThrow(/Insufficient/);
});
it("does not persist if the JWT expires during provider work and always releases lease", async () => {
  ctx.validSession = vi
    .fn()
    .mockResolvedValueOnce(true)
    .mockResolvedValueOnce(true)
    .mockResolvedValue(false);
  await expect(generatePractice(request(), ctx)).rejects.toMatchObject({
    status: 401,
  });
  expect(
    rpc.mock.calls.some((c) => c[0] === "publish_ai_practice_question"),
  ).toBe(false);
  expect(rpc.mock.calls.at(-1)?.[0]).toBe("end_ai_tutor_request");
});
it("honors the existing shared platform/user quota", async () => {
  const base = rpc.getMockImplementation()!;
  rpc.mockImplementation((name, ...args) =>
    name === "begin_ai_tutor_request"
      ? Promise.resolve({ data: null, error: { code: "PT429" } })
      : base(name, ...args),
  );
  await expect(generatePractice(request(), ctx)).rejects.toMatchObject({
    status: 429,
  });
  expect(fetcher).not.toHaveBeenCalled();
});
it.each([429, 500])(
  "provider failure %s does not persist and releases lease",
  async (status) => {
    fetcher.mockResolvedValue(new Response("", { status }));
    await expect(generatePractice(request(), ctx)).rejects.toMatchObject({
      status: status === 429 ? 429 : 502,
    });
    expect(
      rpc.mock.calls.some((c) => c[0] === "publish_ai_practice_question"),
    ).toBe(false);
    expect(rpc.mock.calls.at(-1)?.[0]).toBe("end_ai_tutor_request");
  },
);
it("source conflict on final publication is not reported as stored", async () => {
  const base = rpc.getMockImplementation()!;
  rpc.mockImplementation((name, ...args) =>
    name === "publish_ai_practice_question"
      ? Promise.resolve({ data: null, error: { code: "PT409" } })
      : base(name, ...args),
  );
  await expect(generatePractice(request(), ctx)).rejects.toMatchObject({
    status: 409,
  });
});
