import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), abort: vi.fn() }));
vi.mock("@/utils/supabaseClient", () => ({ supabase: { rpc: mocks.rpc } }));
import { topicRepository } from "../topicRepository";
const id = "00000000-0000-4000-8000-000000000001",
  other = "00000000-0000-4000-8000-000000000002";
const category = {
    earned: 0,
    graded: 0,
    pending: 0,
    excluded: 0,
    percent: null,
  },
  summary = { score: null, coverage: 0, practice: category, exam: category };
const attribution = {
  sourceId: id,
  sourceRevision: other,
  outlineRevision: 1,
  sectionId: id,
  title: "التفاضل",
  sourceTitle: "Book",
};
const data = {
  courseId: id,
  kind: "topic" as const,
  offset: 0,
  groupCount: 1,
  hasMore: false,
  weights: { practice: 40, exam: 60, revision: 1 },
  groups: [{ attribution, summary }],
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.rpc.mockReturnValue({ abortSignal: mocks.abort });
  mocks.abort.mockResolvedValue({ data, error: null });
});
it("reads only own bounded topic report and passes cancellation", async () => {
  const signal = new AbortController().signal;
  expect(await topicRepository.read(id, "topic", 0, signal)).toEqual(data);
  expect(mocks.rpc).toHaveBeenCalledWith("read_ai_practice_topic_performance", {
    p_course: id,
    p_kind: "topic",
    p_offset: 0,
  });
  expect(mocks.abort).toHaveBeenCalledWith(signal);
});
it.each([
  { courseId: other },
  { kind: "chapter" },
  { offset: 20 },
  { groups: Array(21).fill(data.groups[0]) },
  { groups: [{ attribution: { ...attribution, title: "" }, summary }] },
  { weights: { practice: 30, exam: 30, revision: 0 } },
  { groups: [{ attribution, summary: { ...summary, score: 101 } }] },
])("rejects mismatched, oversized or invalid response %#", async (patch) => {
  mocks.abort.mockResolvedValue({ data: { ...data, ...patch }, error: null });
  await expect(
    topicRepository.read(id, "topic", 0, new AbortController().signal),
  ).rejects.toThrow();
});
it("supports null attribution without manufacturing an empty topic or score", async () => {
  mocks.abort.mockResolvedValue({
    data: { ...data, groups: [{ attribution: null, summary }] },
    error: null,
  });
  const result = await topicRepository.read(
    id,
    "topic",
    0,
    new AbortController().signal,
  );
  expect(result.groups[0].attribution).toBeNull();
  expect(result.groups[0].summary.score).toBeNull();
});
it.each([
  ["42501", "denied"],
  ["PGRST301", "denied"],
  ["PGRST303", "denied"],
  ["XX000", "unavailable"],
])("uses safe errors for %s", async (code, kind) => {
  mocks.abort.mockResolvedValue({
    data: null,
    error: { code, message: "private database details" },
  });
  await expect(
    topicRepository.read(id, "topic", 0, new AbortController().signal),
  ).rejects.toMatchObject({ kind });
});
