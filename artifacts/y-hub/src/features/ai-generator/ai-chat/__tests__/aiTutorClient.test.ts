import { beforeEach, describe, expect, it, vi } from "vitest";
import { askAiTutor } from "../aiTutorClient";
const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock(
  "@/utils/supabaseClient",
  () => ({ supabase: { functions: { invoke: mocks.invoke } } }),
);
const request = {
  courseId: "123e4567-e89b-12d3-a456-426614174000",
  question: "Explain vectors",
};
beforeEach(() => {
  mocks.invoke.mockReset();
});
describe("server-evidence tutor client", () => {
  it("sends only identifiers and question, never browser excerpts", async () => {
    mocks.invoke.mockResolvedValue({
      data: { answer: " Answer ", citations: [], insufficient: true },
      error: null,
    });
    expect(
      (await askAiTutor(
        { ...request, chunks: [{ text: "forged" }] } as typeof request,
      )).answer,
    ).toBe("Answer");
    expect(mocks.invoke).toHaveBeenCalledWith("ai-tutor-chat", {
      body: request,
    });
  });
  it("accepts source selection", async () => {
    mocks.invoke.mockResolvedValue({
      data: { answer: "No context", citations: [], insufficient: true },
      error: null,
    });
    await askAiTutor({ ...request, sourceId: request.courseId });
    expect(mocks.invoke.mock.calls[0][1].body.sourceId).toBe(request.courseId);
  });
  it("rejects oversized questions", async () => {
    await expect(askAiTutor({ ...request, question: "a".repeat(1501) })).rejects
      .toThrow("2–1500");
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
  it.each([401, 403, 409, 429, 503])("reports status %s", async (status) => {
    mocks.invoke.mockResolvedValue({
      data: null,
      error: { context: { status } },
    });
    await expect(askAiTutor(request)).rejects.toMatchObject({ status });
  });
  it("rejects unstructured legacy evidence", async () => {
    mocks.invoke.mockResolvedValue({
      data: { answer: "x", citations: ["Page 1"], insufficient: false },
      error: null,
    });
    await expect(askAiTutor(request)).rejects.toThrow("Invalid AI");
  });
  it("reports connection failures", async () => {
    mocks.invoke.mockRejectedValue(new Error());
    await expect(askAiTutor(request)).rejects.toThrow("Cannot connect");
  });
});
