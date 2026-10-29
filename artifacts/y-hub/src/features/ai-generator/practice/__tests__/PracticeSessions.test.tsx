import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
const calls = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn() }));
vi.mock("@/i18n/LanguageContext", () => ({
  useLanguage: () => ({ language: "en" }),
}));
vi.mock("../sessionsRepository", async (orig) => ({
  ...(await orig<object>()),
  sessionsRepository: calls,
}));
vi.mock("../PracticeSessionView", () => ({
  PracticeSessionView: ({
    id,
    onDirty,
  }: {
    id: string;
    onDirty: (dirty: boolean) => void;
  }) => (
    <div>
      {id}
      <button onClick={() => onDirty(true)}>unsaved test choice</button>
    </div>
  ),
}));
import { PracticeSessions } from "../PracticeSessions";
const scope = {
  selection: [{ sourceId: "source", revision: "revision", pages: [2] }],
  units: [],
  query: "",
};
beforeEach(() => {
  vi.clearAllMocks();
  calls.list.mockResolvedValue([]);
  calls.create.mockResolvedValue("new-session");
});
afterEach(cleanup);
async function open(getScope = () => scope) {
  render(<PracticeSessions courseId="course" getScope={getScope} />);
  fireEvent.click(screen.getByText("Saved practice sessions"));
  await screen.findByText("No saved sessions.");
}
it("retains the idempotency key after a failed create and never sends evidence or actor", async () => {
  calls.create.mockRejectedValueOnce(new Error("lost acknowledgement"));
  await open();
  fireEvent.click(screen.getByText("Create session"));
  await screen.findByRole("alert");
  fireEvent.click(screen.getByText("Create session"));
  await screen.findByText("new-session");
  expect(calls.create.mock.calls[0][0]).toBe(calls.create.mock.calls[1][0]);
  expect(calls.create.mock.calls[0][2]).toEqual(scope);
  expect(calls.create.mock.calls[0][3]).toMatchObject({
    target: 5,
    mode: "practice",
    difficulty: "medium",
    language: "en",
  });
});
it("validates the selected scope before writing", async () => {
  await open(() => {
    throw new Error("invalid pages");
  });
  fireEvent.click(screen.getByText("Create session"));
  await screen.findByRole("alert");
  expect(calls.create).not.toHaveBeenCalled();
});
it("blocks unsafe switching/creation with a dirty choice", async () => {
  await open();
  fireEvent.click(screen.getByText("Create session"));
  fireEvent.click(await screen.findByText("unsaved test choice"));
  await waitFor(() =>
    expect(
      (
        screen
          .getByText("Create session")
          .closest("fieldset") as HTMLFieldSetElement
      ).disabled,
    ).toBe(true),
  );
  fireEvent.click(screen.getByText("Saved practice sessions"));
  expect(screen.getByRole("alert").textContent).toContain("not saved");
  expect(screen.getByText("new-session")).toBeTruthy();
});
it("pages history on the server instead of fetching every session", async () => {
  calls.list.mockResolvedValue(
    Array.from({ length: 20 }, (_, i) => ({
      id: String(i),
      mode: "practice",
      target: 1,
      submitted_at: null,
      updated_at: "2026-10-29T00:00:00Z",
    })),
  );
  render(<PracticeSessions courseId="course" getScope={() => scope} />);
  fireEvent.click(screen.getByText("Saved practice sessions"));
  await waitFor(() =>
    expect(
      (screen.getByText("Older sessions") as HTMLButtonElement).disabled,
    ).toBe(false),
  );
  fireEvent.click(screen.getByText("Older sessions"));
  await waitFor(() =>
    expect(calls.list).toHaveBeenLastCalledWith("course", 20),
  );
});
