import { StrictMode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
const calls = vi.hoisted(() => ({
  read: vi.fn(),
  save: vi.fn(),
  generate: vi.fn(),
  submit: vi.fn(),
  language: "en" as "ar" | "en",
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "viewer" } }),
}));
vi.mock("@/i18n/LanguageContext", () => ({
  useLanguage: () => ({ language: calls.language }),
}));
vi.mock("../sessionsRepository", async (original) => ({
  ...(await original<object>()),
  sessionsRepository: calls,
}));
vi.mock("../../knowledge/SourceEvidence", () => ({
  SourceEvidence: ({ sources }: { sources: unknown[] }) => (
    <div data-testid="citations">{sources.length}</div>
  ),
}));
vi.mock("../review/PracticeAssessment", () => ({
  PracticeAssessment: () => null,
}));
import { PracticeSessionView } from "../PracticeSessionView";
import { PracticeSessionError } from "../sessionsRepository";
import { answerRecovery } from "../answerRecovery";
const state = {
  id: "session",
  courseId: "course",
  revision: 2,
  mode: "practice",
  difficulty: "medium",
  language: "en",
  target: 2,
  submittedAt: null,
  questions: [
    {
      position: 1,
      prompt: "احسب $x^2$",
      options: ["$2x$", "$3x$", "$4x$", "$5x$"],
      choice: null,
      answered: false,
      feedback: null,
    },
  ],
};
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  calls.language = "en";
  calls.read.mockResolvedValue(structuredClone(state));
  calls.save.mockResolvedValue(3);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
const open = async () => {
  const dirty = vi.fn();
  render(<PracticeSessionView id="session" onDirty={dirty} />);
  await screen.findByLabelText("1: 1");
  return dirty;
};
it("renders actual math and hides solutions and evidence until server releases them", async () => {
  await open();
  expect(document.querySelector(".katex")).toBeTruthy();
  expect(screen.queryByTestId("citations")).toBeNull();
  expect(
    (screen.getByText("Confirm answer") as HTMLButtonElement).disabled,
  ).toBe(true);
});
it("autosaves after debounce and retains the pending choice during network failure", async () => {
  const dirty = await open();
  calls.save.mockRejectedValue(new PracticeSessionError("unavailable"));
  fireEvent.click(screen.getByLabelText("1: 2"));
  await waitFor(() => expect(calls.save).toHaveBeenCalled(), { timeout: 2000 });
  await screen.findByRole("alert");
  expect(answerRecovery("viewer", "session").read()?.choice).toBe(1);
  expect(dirty).toHaveBeenLastCalledWith(true);
  expect((screen.getByLabelText("1: 2") as HTMLInputElement).checked).toBe(
    true,
  );
});
it("recovers metadata only after authenticated load and requires review before saving", async () => {
  answerRecovery("viewer", "session").write({
    position: 1,
    choice: 2,
    revision: 2,
  });
  await open();
  await screen.findByText(/Local recovery found/);
  expect(calls.save).not.toHaveBeenCalled();
  expect((screen.getByLabelText("1: 3") as HTMLInputElement).checked).toBe(
    true,
  );
  fireEvent.click(screen.getByText("Save answer draft"));
  await waitFor(() => expect(calls.save).toHaveBeenCalledWith(state, 1, 2));
  await waitFor(() =>
    expect(answerRecovery("viewer", "session").read()).toBeNull(),
  );
});
it("lost acknowledgement is reconciled with the server without another mutation", async () => {
  answerRecovery("viewer", "session").write({
    position: 1,
    choice: 1,
    revision: 2,
  });
  calls.read.mockResolvedValue({
    ...state,
    revision: 3,
    questions: [{ ...state.questions[0], choice: 1 }],
  });
  await open();
  expect(answerRecovery("viewer", "session").read()).toBeNull();
  expect(calls.save).not.toHaveBeenCalled();
});
it("denial clears cached content and pending recovery instead of retaining protected questions", async () => {
  await open();
  fireEvent.click(screen.getByLabelText("1: 1"));
  calls.read.mockRejectedValue(new PracticeSessionError("denied"));
  fireEvent.click(screen.getByText("Reload current session"));
  await screen.findByRole("alert");
  expect(screen.queryByLabelText("1: 1")).toBeNull();
  expect(answerRecovery("viewer", "session").read()).toBeNull();
});
it("conflict preserves a draft but prevents blind overwrite; reload displays remote choice", async () => {
  await open();
  calls.save.mockRejectedValue(new PracticeSessionError("conflict"));
  fireEvent.click(screen.getByLabelText("1: 1"));
  fireEvent.click(screen.getByText("Save answer draft"));
  await screen.findByRole("alert");
  expect(screen.queryByLabelText("1: 1")).toBeNull();
  expect(answerRecovery("viewer", "session").read()?.choice).toBe(0);
  calls.read.mockResolvedValue({
    ...state,
    revision: 3,
    questions: [{ ...state.questions[0], choice: 2 }],
  });
  fireEvent.click(screen.getByText("Reload current session"));
  await screen.findByLabelText("1: 1");
  expect(
    screen.getByText("Server-saved choice:").parentElement?.textContent,
  ).toContain("3");
  expect(calls.save).toHaveBeenCalledTimes(1);
});
it("does not reveal exam feedback after saving a draft", async () => {
  calls.read.mockResolvedValue({ ...state, mode: "exam" });
  await open();
  expect(screen.queryByText("Confirm answer")).toBeNull();
  expect(screen.queryByTestId("citations")).toBeNull();
});
it("shows Arabic model suggestion and trusted citations only when server releases feedback", async () => {
  calls.language = "ar";
  calls.read.mockResolvedValue({
    ...state,
    questions: [
      {
        ...state.questions[0],
        choice: 0,
        answered: true,
        feedback: {
          matchesSuggestion: true,
          suggestedChoice: 0,
          explanation: "قاعدة القوة \\[2x\\]",
          citations: [{ id: "trusted" }],
        },
      },
    ],
  });
  await open();
  expect(screen.getByTestId("citations").textContent).toBe("1");
  expect(screen.getByText("يطابق اقتراح الذكاء الاصطناعي")).toBeTruthy();
});
it("ignores a late load after unmount", async () => {
  let resolve!: (value: unknown) => void;
  calls.read.mockImplementation(() => new Promise((r) => (resolve = r)));
  const view = render(<PracticeSessionView id="session" onDirty={() => {}} />);
  view.unmount();
  await act(async () => resolve(state));
  expect(screen.queryByLabelText("1: 1")).toBeNull();
});

it("loads correctly through StrictMode effect cleanup and does not accept the aborted response", async () => {
  render(
    <StrictMode>
      <PracticeSessionView id="session" onDirty={() => {}} />
    </StrictMode>,
  );
  await screen.findByLabelText("1: 1");
  expect(calls.read).toHaveBeenCalledTimes(2);
  expect(calls.read.mock.calls[0][1].aborted).toBe(true);
  expect(calls.read.mock.calls[1][1].aborted).toBe(false);
});
