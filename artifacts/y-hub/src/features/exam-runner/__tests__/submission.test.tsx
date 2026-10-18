import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { useExamRunner } from "../hooks/useExamRunner";
const mock = vi.hoisted(() => ({
  user: { id: "student" },
  repo: {
    previousResult: vi.fn(),
    getExam: vi.fn(),
    getQuestions: vi.fn(),
    submitExam: vi.fn(),
    startAttempt: vi.fn(),
    getAttempt: vi.fn(),
  },
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: mock.user }),
}));
vi.mock("wouter", () => ({ useRoute: () => [true, { id: "exam" }] }));
vi.mock("sonner", () => ({
  toast: { success: mock.success, error: mock.error },
}));
vi.mock("../services/examRunnerRepository", () => ({
  examRunnerRepository: mock.repo,
}));
const active = () => ({
  status: "active",
  attempt_id: "10000000-0000-4000-8000-000000000001",
  started_at: new Date().toISOString(),
  deadline_at: new Date(Date.now() + 60000).toISOString(),
  server_now: new Date().toISOString(),
  result: null,
});
beforeEach(() => {
  vi.clearAllMocks();
  mock.repo.previousResult.mockResolvedValue(null);
  mock.repo.getExam.mockResolvedValue({
    course_id: "course",
    title: "Exam",
    time_limit_minutes: 1,
  });
  mock.repo.getQuestions.mockResolvedValue({ data: [], error: null });
  mock.repo.startAttempt.mockImplementation(async () => active());
  mock.repo.getAttempt.mockImplementation(async () => active());
});
it("never declares a failed save submitted and preserves answers", async () => {
  mock.repo.submitExam.mockResolvedValue({
    data: null,
    error: new Error("offline"),
  });
  const { result } = renderHook(() => useExamRunner());
  await waitFor(() => expect(result.current.loading).toBe(false));
  act(() => result.current.setAnswers({ q: "answer" }));
  await act(async () => {
    await result.current.handleSubmit();
  });
  expect(result.current.isSubmitted).toBe(false);
  expect(result.current.answers).toEqual({ q: "answer" });
  expect(mock.success).not.toHaveBeenCalled();
});

it("blocks double clicks until the confirmed response arrives", async () => {
  let resolve!: (value: unknown) => void;
  mock.repo.submitExam.mockReturnValue(
    new Promise((r) => {
      resolve = r;
    }),
  );
  const { result } = renderHook(() => useExamRunner());
  await waitFor(() => expect(result.current.loading).toBe(false));
  let pending!: Promise<void>;
  act(() => {
    pending = result.current.handleSubmit();
    void result.current.handleSubmit();
  });
  await waitFor(() => expect(mock.repo.submitExam).toHaveBeenCalledTimes(1));
  expect(result.current.isSubmitted).toBe(false);
  await act(async () => {
    resolve(confirmed());
    await pending;
  });
  expect(result.current.isSubmitted).toBe(true);
});
const confirmed = () => ({
  ...active(),
  status: "submitted",
  result: {
    id: "20000000-0000-4000-8000-000000000001",
    score: 1,
    total_score: 2,
  },
});
it("reconciles a lost response without resubmitting saved answers", async () => {
  mock.repo.submitExam.mockRejectedValue(new Error("response lost"));
  const { result } = renderHook(() => useExamRunner());
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => {
    await result.current.handleSubmit();
  });
  expect(result.current.phase).toBe("failed");
  mock.repo.getAttempt.mockResolvedValue(confirmed());
  await act(async () => {
    await result.current.handleSubmit();
  });
  expect(result.current.isSubmitted).toBe(true);
  expect(mock.repo.submitExam).toHaveBeenCalledTimes(1);
});
it.each([
  null,
  {},
  { status: "submitted", result: { score: 1, total_score: 1 } },
  { ...active(), status: "submitted", result: null },
])("rejects invalid success payload %j", async (payload) => {
  mock.repo.submitExam.mockResolvedValue(payload);
  const { result } = renderHook(() => useExamRunner());
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => {
    await result.current.handleSubmit();
  });
  expect(result.current.phase).toBe("failed");
  expect(mock.success).not.toHaveBeenCalled();
});
it.each(["JWT expired", "permission denied"])(
  "keeps answers when server rejects access: %s",
  async (message) => {
    mock.repo.getAttempt.mockRejectedValue(new Error(message));
    const { result } = renderHook(() => useExamRunner());
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.setAnswers({ q: "draft" }));
    await act(async () => {
      await result.current.handleSubmit();
    });
    expect(result.current.answers).toEqual({ q: "draft" });
    expect(result.current.isSubmitted).toBe(false);
    expect(mock.repo.submitExam).not.toHaveBeenCalled();
  },
);
it("marks expired without a false result or automatically sending answers", async () => {
  mock.repo.startAttempt.mockResolvedValue({ ...active(), status: "expired" });
  const { result } = renderHook(() => useExamRunner());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.phase).toBe("expired");
  expect(result.current.isSubmitted).toBe(false);
  expect(result.current.result).toBeNull();
  expect(mock.repo.submitExam).not.toHaveBeenCalled();
});
it("restores server deadline on remount instead of resetting exam duration", async () => {
  const state = {
    ...active(),
    deadline_at: new Date(Date.now() + 20000).toISOString(),
  };
  mock.repo.startAttempt.mockResolvedValue(state);
  const first = renderHook(() => useExamRunner());
  await waitFor(() => expect(first.result.current.loading).toBe(false));
  expect(first.result.current.timeLeft).toBeLessThanOrEqual(20);
  first.unmount();
  const second = renderHook(() => useExamRunner());
  await waitFor(() => expect(second.result.current.loading).toBe(false));
  expect(second.result.current.timeLeft).toBeLessThanOrEqual(20);
});
it("ignores a late result after logout/account change", async () => {
  let resolve!: (value: unknown) => void;
  mock.repo.submitExam.mockReturnValue(
    new Promise((r) => {
      resolve = r;
    }),
  );
  const { result, rerender } = renderHook(() => useExamRunner());
  await waitFor(() => expect(result.current.loading).toBe(false));
  let pending!: Promise<void>;
  act(() => {
    pending = result.current.handleSubmit();
  });
  await waitFor(() => expect(mock.repo.submitExam).toHaveBeenCalled());
  mock.user = { id: "other" };
  rerender();
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => {
    resolve(confirmed());
    await pending;
  });
  expect(result.current.isSubmitted).toBe(false);
  expect(mock.success).not.toHaveBeenCalled();
  mock.user = { id: "student" };
});
it("ignores an older clock response after a confirmed submission", async () => {
  const { result } = renderHook(() => useExamRunner());
  await waitFor(() => expect(result.current.loading).toBe(false));
  let resolve!: (value: unknown) => void;
  mock.repo.getAttempt
    .mockReturnValueOnce(
      new Promise((r) => {
        resolve = r;
      }),
    )
    .mockResolvedValueOnce(confirmed());
  act(() => window.dispatchEvent(new Event("focus")));
  await waitFor(() => expect(mock.repo.getAttempt).toHaveBeenCalledTimes(1));
  await act(async () => {
    await result.current.handleSubmit();
  });
  expect(result.current.isSubmitted).toBe(true);
  await act(async () => {
    resolve(active());
  });
  expect(result.current.isSubmitted).toBe(true);
});
