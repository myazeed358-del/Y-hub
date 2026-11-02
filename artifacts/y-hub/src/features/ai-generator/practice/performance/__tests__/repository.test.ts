import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/utils/supabaseClient", () => ({ supabase: { rpc: mocks.rpc } }));
import { performanceRepository } from "../repository";
const id = "00000000-0000-4000-8000-000000000001";
const category = {
  earned: 0,
  graded: 0,
  pending: 0,
  excluded: 0,
  percent: null,
};
const reply = {
  courseId: id,
  canManage: false,
  weights: { practice: 50, exam: 50, revision: 0 },
  summary: { score: null, coverage: 0, practice: category, exam: category },
  units: [],
  unitCount: 0,
  offset: 0,
  hasMore: false,
  unavailableSessions: 0,
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.rpc.mockResolvedValue({ data: reply, error: null });
});
it("reads only the authenticated caller via a bounded server page, never sends an actor or score", async () => {
  expect(await performanceRepository.read(id, 0)).toEqual(reply);
  expect(mocks.rpc).toHaveBeenCalledWith("read_ai_practice_performance", {
    p_course: id,
    p_offset: 0,
  });
});
it.each([
  { courseId: "00000000-0000-4000-8000-000000000002" },
  { offset: 20 },
  { summary: { ...reply.summary, score: 101 } },
  { weights: { practice: 0, exam: 0, revision: 1 } },
])("rejects a mismatched or invalid server reply %#", async (patch) => {
  mocks.rpc.mockResolvedValue({ data: { ...reply, ...patch }, error: null });
  await expect(performanceRepository.read(id, 0)).rejects.toThrow();
});
it.each([
  [20, 50],
  [-1, 101],
  [40.5, 59.5],
])("does not send invalid weights %s/%s", async (a, b) => {
  await expect(performanceRepository.save(id, 1, a, b)).rejects.toThrow();
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("saves only weights and expected revision", async () => {
  mocks.rpc.mockResolvedValue({ data: 2, error: null });
  expect(await performanceRepository.save(id, 1, 40, 60)).toBe(2);
  expect(mocks.rpc).toHaveBeenCalledWith(
    "set_ai_practice_performance_weights",
    { p_course: id, p_revision: 1, p_practice: 40, p_exam: 60 },
  );
});
it.each([
  ["42501", "denied"],
  ["PGRST301", "denied"],
  ["PGRST303", "denied"],
  ["PT409", "conflict"],
  ["500", "unavailable"],
])("maps %s to safe %s", async (code, kind) => {
  mocks.rpc.mockResolvedValue({ error: { code } });
  await expect(performanceRepository.read(id, 0)).rejects.toMatchObject({
    kind,
  });
});
