import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseWorkbookStorage } from "../integration/supabaseWorkbookStorage";
import { createDefaultWorkbook } from "../state/defaultWorkbook";
const api = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
  single: vi.fn(),
}));
vi.mock("@/utils/supabaseClient", () => ({
  supabase: { auth: { getUser: api.getUser }, rpc: api.rpc, from: api.from },
}));
const owner = "owner-a";
const workbook = () => ({
  ...createDefaultWorkbook(),
  id: "11111111-1111-4111-8111-111111111111",
});
beforeEach(() => {
  vi.resetAllMocks();
  api.getUser.mockResolvedValue({ data: { user: { id: owner } }, error: null });
  const query = { select: vi.fn(), eq: vi.fn(), single: api.single };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  api.from.mockReturnValue(query);
  api.single.mockResolvedValue({
    data: { ...workbook(), content: workbook(), revision: 1 },
    error: null,
  });
  api.rpc.mockResolvedValue({ data: 2, error: null });
});
describe("Supabase workbook save protocol", () => {
  it("replays the same request after a committed write loses its acknowledgment", async () => {
    const storage = createSupabaseWorkbookStorage(owner);
    const wb = await storage.loadWorkbook(workbook().id);
    api.rpc.mockRejectedValueOnce(new Error("connection lost after commit"));
    await expect(storage.saveWorkbook(wb)).rejects.toThrow();
    await storage.saveWorkbook(wb);
    expect(api.rpc.mock.calls[0]).toEqual(api.rpc.mock.calls[1]);
    expect(storage.checkpoint?.(wb.id)).toEqual({ revision: 2 });
  });
  it("acknowledges the unresolved snapshot before sending newer edits", async () => {
    const storage = createSupabaseWorkbookStorage(owner);
    const wb = await storage.loadWorkbook(workbook().id);
    api.rpc
      .mockRejectedValueOnce(new Error("lost response"))
      .mockResolvedValueOnce({ data: 2, error: null })
      .mockResolvedValueOnce({ data: 3, error: null });
    await expect(storage.saveWorkbook(wb)).rejects.toThrow();
    await storage.saveWorkbook({ ...wb, name: "New edit" });
    expect(api.rpc.mock.calls[1]).toEqual(api.rpc.mock.calls[0]);
    expect(api.rpc.mock.calls[2][1]).toMatchObject({
      p_expected_revision: 2,
      p_content: { name: "New edit" },
    });
  });
  it("serializes concurrent snapshots and never rebases an external conflict", async () => {
    const storage = createSupabaseWorkbookStorage(owner);
    const wb = await storage.loadWorkbook(workbook().id);
    api.rpc
      .mockResolvedValueOnce({ data: 2, error: null })
      .mockResolvedValueOnce({ data: null, error: { code: "40001" } });
    const first = storage.saveWorkbook(wb),
      second = storage.saveWorkbook({ ...wb, name: "Second" });
    await first;
    await expect(second).rejects.toThrow("conflict");
    expect(api.rpc.mock.calls[1][1].p_expected_revision).toBe(2);
    expect(storage.checkpoint?.(wb.id)?.intent?.workbook.name).toBe("Second");
  });
  it("restores an uncertain intent after refresh with the original request identity", async () => {
    const first = createSupabaseWorkbookStorage(owner);
    const wb = await first.loadWorkbook(workbook().id);
    api.rpc.mockRejectedValueOnce(new Error("offline"));
    await expect(first.saveWorkbook(wb)).rejects.toThrow();
    const next = createSupabaseWorkbookStorage(owner);
    next.restoreCheckpoint?.(wb.id, first.checkpoint!(wb.id)!);
    await next.saveWorkbook(wb);
    expect(api.rpc.mock.calls[1]).toEqual(api.rpc.mock.calls[0]);
  });
  it("never sends an old account snapshot after a session switch", async () => {
    const storage = createSupabaseWorkbookStorage(owner);
    const wb = await storage.loadWorkbook(workbook().id);
    api.getUser.mockResolvedValue({
      data: { user: { id: "owner-b" } },
      error: null,
    });
    await expect(storage.saveWorkbook(wb)).rejects.toThrow("session");
    expect(api.rpc).not.toHaveBeenCalled();
  });
  it("does not send when durable intent journaling fails", async () => {
    const storage = createSupabaseWorkbookStorage(owner, (_id, cp) => {
      if (cp.intent) throw new Error("disk full");
    });
    const wb = await storage.loadWorkbook(workbook().id);
    await expect(storage.saveWorkbook(wb)).rejects.toThrow("disk full");
    expect(api.rpc).not.toHaveBeenCalled();
  });
  it("creates through the same retryable protocol and confirms deletion", async () => {
    api.rpc.mockResolvedValueOnce({ data: 1, error: null });
    const storage = createSupabaseWorkbookStorage(owner);
    const wb = await storage.createWorkbook!("New");
    expect(api.rpc.mock.calls[0][1]).toMatchObject({
      p_expected_owner_id: owner,
      p_expected_revision: 0,
      p_content: { id: wb.id, name: "New" },
    });
    api.rpc.mockResolvedValueOnce({ data: null, error: null });
    await expect(storage.deleteWorkbook!(wb.id, 1)).rejects.toThrow(
      "not confirmed",
    );
  });
});
