import { expect, it, vi } from "vitest";
import { dashboardRepository } from "./dashboardRepository";
const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/utils/supabaseClient", () => ({ supabase: { rpc } }));
it("uses the confirmed invoker RPC and propagates its data/error", async () => {
  const response = { data: "course", error: null };
  rpc.mockResolvedValue(response);
  expect(await dashboardRepository.deleteCourse("course")).toEqual(response);
  expect(rpc).toHaveBeenCalledWith("delete_course_confirmed", {
    p_course_id: "course",
  });
});
