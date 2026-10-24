import { beforeEach, expect, it, vi } from "vitest";
import { generateTutorReply } from "../generateTutorReply";
const mocks = vi.hoisted(() => ({ askAiTutor: vi.fn() }));
vi.mock("../aiTutorClient", () => ({ askAiTutor: mocks.askAiTutor }));
beforeEach(() => {
  mocks.askAiTutor.mockReset();
});
it("uses server evidence, no local keyword matching or fabricated page labels", async () => {
  const citations = [{
    id: "c",
    source_id: "s",
    title: "Lecture",
    page: 2,
    text: "Vector",
    revision: "r",
    unit_id: null,
  }];
  mocks.askAiTutor.mockResolvedValue({
    answer: "Explanation",
    citations,
    insufficient: false,
  });
  const reply = await generateTutorReply("course", "Explain", "source");
  expect(mocks.askAiTutor).toHaveBeenCalledWith({
    courseId: "course",
    question: "Explain",
    sourceId: "source",
  });
  expect(reply.sources).toEqual(citations);
  expect(reply.canTestKnowledge).toBe(false);
});
it("preserves the explicit server insufficient response", async () => {
  mocks.askAiTutor.mockResolvedValue({
    answer: "لا توجد معلومات كافية",
    citations: [],
    insufficient: true,
  });
  expect((await generateTutorReply("course", "question")).sources).toEqual([]);
});
it("propagates failures without synthetic answers", async () => {
  mocks.askAiTutor.mockRejectedValue(new Error("offline"));
  await expect(generateTutorReply("course", "question")).rejects.toThrow(
    "offline",
  );
});
it("passes manual explanation language and preserves JSON-decoded LaTeX", async () => {
  const answer = String.raw`نشتق: \[\frac{d}{dx}x^2=2x\]`;
  mocks.askAiTutor.mockResolvedValue({
    answer,
    citations: [],
    insufficient: true,
  });
  const result = await generateTutorReply(
    "course",
    "question",
    undefined,
    "ar",
  );
  expect(mocks.askAiTutor).toHaveBeenCalledWith({
    courseId: "course",
    question: "question",
    sourceId: undefined,
    language: "ar",
  });
  expect(result.content).toBe(answer);
});
