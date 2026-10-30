import { beforeEach, expect, it, vi } from "vitest";
import {
  parseRecheck,
  recheckPractice,
  recheckInstructions,
} from "../../../../../../supabase/functions/_shared/tutor/practiceReview";
import type { Context } from "../../../../../../supabase/functions/_shared/tutor/core";
const id = "123e4567-e89b-42d3-a456-426614174000";
const evidence = {
  id: "e",
  source_id: id,
  revision: id,
  title: "Approved book",
  page: 2,
  unit_id: null,
  text: "Derivative of x^2 is 2x.",
};
const proposal = {
  choice: 0,
  explanation: "Use the power rule: $2x$.",
  evidenceIds: ["e"],
};
let ctx: Context,
  rpc: ReturnType<typeof vi.fn>,
  fetcher: ReturnType<typeof vi.fn>;
const request = (body: unknown = { reviewId: id }) =>
  new Request("http://local", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  rpc = vi.fn(async (name: string) => ({
    error: null,
    data:
      name === "ai_practice_review_context"
        ? {
            courseId: id,
            revision: 1,
            done: false,
            language: "ar",
            prompt: "Derivative?",
            options: ["2x", "3x", "4x", "5x"],
            evidence: [evidence],
          }
        : name === "ai_tutor_access"
          ? true
          : "lease",
  }));
  fetcher = vi.fn(async () =>
    Response.json({
      choices: [{ message: { content: JSON.stringify(proposal) } }],
    }),
  );
  ctx = {
    actor: "trusted-actor",
    db: { rpc, from: vi.fn() },
    admin: { rpc, from: vi.fn() },
    fetch: fetcher,
    env: (k) => (k === "GROQ_API_KEY" ? "fixture" : undefined),
    validSession: async () => true,
  };
});
it("rechecks independently and publishes only a suggestion using server identity", async () => {
  expect(await recheckPractice(request(), ctx)).toEqual({ stored: true });
  const body = JSON.parse(fetcher.mock.calls[0][1].body);
  expect(body.max_completion_tokens).toBe(1800);
  expect(body.messages[1].content).not.toContain("trusted-actor");
  expect(body.messages[1].content).not.toContain("suggestedChoice");
  expect(
    rpc.mock.calls.find((c) => c[0] === "publish_ai_practice_recheck")?.[1],
  ).toMatchObject({
    p_actor: "trusted-actor",
    p_kind: "suggestion",
    p_choice: 0,
    p_evidence: ["e"],
  });
  expect(recheckInstructions("ar")).toContain("Arabic");
  expect(recheckInstructions("en")).toContain("English");
});
it.each(["actor", "score", "evidence", "choice"])(
  "rejects forged %s",
  async (key) => {
    await expect(
      recheckPractice(request({ reviewId: id, [key]: "forged" }), ctx),
    ).rejects.toMatchObject({ status: 400 });
    expect(rpc).not.toHaveBeenCalled();
  },
);
it("completed recheck does not call provider or charge another lease", async () => {
  rpc.mockResolvedValueOnce({
    data: { courseId: id, done: true },
    error: null,
  });
  expect(await recheckPractice(request(), ctx)).toEqual({ stored: true });
  expect(fetcher).not.toHaveBeenCalled();
  expect(rpc.mock.calls.some((c) => c[0] === "begin_ai_tutor_request")).toBe(
    false,
  );
});
it.each([
  { ...proposal, evidenceIds: ["forged"] },
  { ...proposal, choice: 5 },
  { ...proposal, explanation: "" },
  { ...proposal, score: 1 },
])("rejects invalid model proposal %#", (value) => {
  expect(() => parseRecheck(value, [evidence])).toThrow();
});
it("uncertainty never invents a choice", () => {
  expect(parseRecheck({ ...proposal, choice: null }, [evidence]).kind).toBe(
    "uncertain",
  );
});
it.each(["missing", "offline", "malformed", "provider429"])(
  "records %s as unavailable, not a grade, and permits a later human request",
  async (kind) => {
    if (kind === "missing") ctx.env = () => undefined;
    if (kind === "offline") fetcher.mockRejectedValue(new Error("network"));
    if (kind === "malformed")
      fetcher.mockResolvedValue(
        Response.json({ choices: [{ message: { content: "bad" } }] }),
      );
    if (kind === "provider429")
      fetcher.mockResolvedValue(new Response("", { status: 429 }));
    expect(await recheckPractice(request(), ctx)).toEqual({ stored: true });
    expect(
      rpc.mock.calls.find((c) => c[0] === "publish_ai_practice_recheck")?.[1],
    ).toMatchObject({ p_kind: "unavailable", p_choice: null, p_evidence: [] });
    expect(rpc.mock.calls.at(-1)?.[0]).toBe("end_ai_tutor_request");
  },
);
it("expiry during provider work does not persist or reveal a recheck", async () => {
  ctx.validSession = vi
    .fn()
    .mockResolvedValueOnce(true)
    .mockResolvedValueOnce(true)
    .mockResolvedValue(false);
  await expect(recheckPractice(request(), ctx)).rejects.toMatchObject({
    status: 401,
  });
  expect(
    rpc.mock.calls.some((c) => c[0] === "publish_ai_practice_recheck"),
  ).toBe(false);
});
it("shared concurrency quota does not mark another in-flight recheck unavailable", async () => {
  const base = rpc.getMockImplementation()!;
  rpc.mockImplementation((name, ...args) =>
    name === "begin_ai_tutor_request"
      ? Promise.resolve({ data: null, error: { code: "PT429" } })
      : base(name, ...args),
  );
  await expect(recheckPractice(request(), ctx)).rejects.toMatchObject({
    status: 429,
  });
  expect(fetcher).not.toHaveBeenCalled();
  expect(
    rpc.mock.calls.some((c) => c[0] === "publish_ai_practice_recheck"),
  ).toBe(false);
});
