import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { useDashboardController } from "./useDashboardController";
const mocks = vi.hoisted(() => ({
  user: { id: "owner" },
  list: vi.fn(),
  delete: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: mocks.user, role: "instructor", profile: null }),
}));
vi.mock("@/i18n/LanguageContext", () => ({
  useLanguage: () => ({ language: "en" }),
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.success, error: mocks.error },
}));
vi.mock("../services/dashboardRepository", () => ({
  dashboardRepository: {
    listManagedCourses: mocks.list,
    deleteCourse: mocks.delete,
  },
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.list.mockResolvedValue({
    data: [{ id: "course", title: "Course" }],
    error: null,
  });
  vi.spyOn(window, "confirm").mockReturnValue(true);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());
it("does not show success or remove a course when zero rows were deleted without error", async () => {
  mocks.delete.mockResolvedValue({ data: [], error: null });
  const { result } = renderHook(useDashboardController);
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => {
    await result.current.handleDelete("course");
  });
  expect(mocks.success).not.toHaveBeenCalled();
  expect(mocks.error).toHaveBeenCalled();
  expect(mocks.list).toHaveBeenCalledTimes(1);
  expect(result.current.courses).toHaveLength(1);
});
it.each([
  ["P0002", "Course not found; it may already have been deleted"],
  ["42501", "You do not have permission to delete this course"],
  ["P0001", "Could not delete the course"],
  ["23503", "Could not delete the course"],
])("reports %s without advancing success state", async (code, message) => {
  mocks.delete.mockResolvedValue({
    data: null,
    error: { code, message: "database failure" },
  });
  const { result } = renderHook(useDashboardController);
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => {
    await result.current.handleDelete("course");
  });
  expect(mocks.error).toHaveBeenCalledWith(message);
  expect(mocks.success).not.toHaveBeenCalled();
  expect(mocks.list).toHaveBeenCalledTimes(1);
});
it.each([null, "another-course"])(
  "rejects unconfirmed/mismatched return value %j",
  async (data) => {
    mocks.delete.mockResolvedValue({ data, error: null });
    const { result } = renderHook(useDashboardController);
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.handleDelete("course");
    });
    expect(mocks.success).not.toHaveBeenCalled();
  },
);
it("refreshes only after the requested ID is confirmed deleted", async () => {
  mocks.delete.mockResolvedValue({ data: "course", error: null });
  const { result } = renderHook(useDashboardController);
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => {
    await result.current.handleDelete("course");
  });
  expect(mocks.success).toHaveBeenCalledWith("Course deleted");
  expect(mocks.list).toHaveBeenCalledTimes(2);
});
it("does not send a deletion when the destructive confirmation is cancelled", async () => {
  vi.mocked(window.confirm).mockReturnValue(false);
  const { result } = renderHook(useDashboardController);
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => {
    await result.current.handleDelete("course");
  });
  expect(mocks.delete).not.toHaveBeenCalled();
  expect(window.confirm).toHaveBeenCalledWith(
    expect.stringContaining("results and syllabus"),
  );
});
it("handles a lost connection as unconfirmed, not successful", async () => {
  mocks.delete.mockRejectedValue(new Error("network response lost"));
  const { result } = renderHook(useDashboardController);
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => {
    await result.current.handleDelete("course");
  });
  expect(mocks.success).not.toHaveBeenCalled();
  expect(mocks.error).toHaveBeenCalledWith(
    expect.stringContaining("not confirmed"),
  );
});
it("sends only one request for concurrent clicks", async () => {
  let resolve!: (data: unknown) => void;
  mocks.delete.mockReturnValue(
    new Promise((r) => {
      resolve = r;
    }),
  );
  const { result } = renderHook(useDashboardController);
  await waitFor(() => expect(result.current.loading).toBe(false));
  let pending!: Promise<void>;
  act(() => {
    pending = result.current.handleDelete("course");
    void result.current.handleDelete("course");
  });
  expect(mocks.delete).toHaveBeenCalledTimes(1);
  await act(async () => {
    resolve({ data: "course", error: null });
    await pending;
  });
});
