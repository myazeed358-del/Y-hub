import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
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
  localStorage.clear();
  mock.user = { id: "student" };
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

afterEach(() => vi.restoreAllMocks());
it("recovers answers after refresh without extending the server deadline", async () => {
  const state = active();
  mock.repo.startAttempt.mockResolvedValue(state);
  const first = renderHook(() => useExamRunner());
  await waitFor(() => expect(first.result.current.loading).toBe(false));
  act(() => first.result.current.setAnswers({ q: "offline answer" }));
  first.unmount();
  const second = renderHook(() => useExamRunner());
  await waitFor(() => expect(second.result.current.loading).toBe(false));
  expect(second.result.current.answers).toEqual({ q: "offline answer" });
  expect(second.result.current.timeLeft).toBeLessThanOrEqual(60);
  expect(second.result.current.recoveryMessage).toContain("restored");
});
it("keeps recovery through a failed submission and clears it only after confirmation", async () => {
  mock.repo.submitExam.mockRejectedValue(new Error("offline"));
  const first = renderHook(() => useExamRunner());
  await waitFor(() => expect(first.result.current.loading).toBe(false));
  act(() => first.result.current.setAnswers({ q: "draft" }));
  await act(() => first.result.current.handleSubmit());
  first.unmount();
  const second = renderHook(() => useExamRunner());
  await waitFor(() => expect(second.result.current.loading).toBe(false));
  expect(second.result.current.answers).toEqual({ q: "draft" });
  mock.repo.getAttempt.mockResolvedValue(confirmed());
  await act(() => second.result.current.handleSubmit());
  expect(localStorage.length).toBe(0);
});
it("does not restore another account or another attempt", async () => {
  const first = renderHook(() => useExamRunner());
  await waitFor(() => expect(first.result.current.loading).toBe(false));
  act(() => first.result.current.setAnswers({ q: "private" }));
  first.unmount();
  mock.user = { id: "other" };
  const second = renderHook(() => useExamRunner());
  await waitFor(() => expect(second.result.current.loading).toBe(false));
  expect(second.result.current.answers).toEqual({});
  second.unmount();
  mock.user = { id: "student" };
  mock.repo.startAttempt.mockResolvedValue({ ...active(), attempt_id: "10000000-0000-4000-8000-000000000099" });
  const third = renderHook(() => useExamRunner());
  await waitFor(() => expect(third.result.current.loading).toBe(false));
  expect(third.result.current.answers).toEqual({});
});
it("preserves independent tab drafts for explicit recovery selection", async () => {
  const one = renderHook(() => useExamRunner());
  const two = renderHook(() => useExamRunner());
  await waitFor(() => expect(one.result.current.loading || two.result.current.loading).toBe(false));
  act(() => one.result.current.setAnswers({ q: "one" }));
  act(() => two.result.current.setAnswers({ q: "two" }));
  one.unmount(); two.unmount();
  const three = renderHook(() => useExamRunner());
  await waitFor(() => expect(three.result.current.loading).toBe(false));
  expect(three.result.current.recoveryChoices.map(d => d.answers.q).sort()).toEqual(["one", "two"]);
});
it("warns on storage failure, keeps in-memory edits and guards refresh", async () => {
  const { result } = renderHook(() => useExamRunner());
  await waitFor(() => expect(result.current.loading).toBe(false));
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw Error("quota"); });
  act(() => result.current.setAnswers({ q: "keep me" }));
  expect(result.current.answers).toEqual({ q: "keep me" });
  expect(result.current.recoveryMessage).toContain("Local recovery failed");
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
});
