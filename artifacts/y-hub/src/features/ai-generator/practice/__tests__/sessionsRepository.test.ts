import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@/utils/supabaseClient", () => ({
  supabase: { functions: { invoke: mocks.invoke } },
}));
import { sessionsRepository } from "../sessionsRepository";
beforeEach(() => vi.resetAllMocks());
it("distinguishes a repeated proposal without consuming the original error body", async () => {
  const context = Response.json(
    { error: "Repeated or equivalent practice question" },
    { status: 409 },
  );
  mocks.invoke.mockResolvedValue({ error: { context } });
  await expect(sessionsRepository.generate("session", 2)).rejects.toMatchObject(
    { kind: "repeated" },
  );
  expect(context.bodyUsed).toBe(false);
  expect(mocks.invoke).toHaveBeenCalledTimes(1);
});
it.each([
  "{",
  JSON.stringify({ error: "Sources changed; retry the question" }),
  JSON.stringify({ error: "Untrusted text" }),
])(
  "preserves source/device conflict semantics for any other response %s",
  async (body) => {
    mocks.invoke.mockResolvedValue({
      error: { context: new Response(body, { status: 409 }) },
    });
    await expect(
      sessionsRepository.generate("session", 2),
    ).rejects.toMatchObject({ kind: "conflict" });
  },
);
it.each([
  [401, "denied"],
  [403, "denied"],
  [422, "insufficient"],
  [429, "quota"],
  [503, "unavailable"],
])("retains existing error handling for %s", async (status, kind) => {
  mocks.invoke.mockResolvedValue({
    error: { context: new Response("", { status: Number(status) }) },
  });
  await expect(sessionsRepository.generate("session", 1)).rejects.toMatchObject(
    { kind },
  );
});
it("accepts an acknowledged stored question without another generation", async () => {
  mocks.invoke.mockResolvedValue({ data: { stored: true }, error: null });
  await sessionsRepository.generate("session", 1);
  expect(mocks.invoke).toHaveBeenCalledTimes(1);
});
