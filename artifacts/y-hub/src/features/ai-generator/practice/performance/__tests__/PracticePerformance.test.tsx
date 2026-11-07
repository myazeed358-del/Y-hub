import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
const mocks = vi.hoisted(() => ({
  read: vi.fn(),
  save: vi.fn(),
  language: "en" as "en" | "ar",
}));
vi.mock("@/i18n/LanguageContext", () => ({
  useLanguage: () => ({ language: mocks.language }),
}));
vi.mock("../repository", async original => ({
  ...await original<object>(),
  performanceRepository: { read: mocks.read, save: mocks.save },
}));
import { PracticePerformance } from "../PracticePerformance";
import { PracticeSessionError } from "../../sessionsRepository";
const category = {
  earned: 2,
  graded: 3,
  pending: 1,
  excluded: 1,
  percent: 66.67,
};
const summary = {
  score: 66.67,
  coverage: 50,
  practice: category,
  exam: { earned: 0, graded: 0, pending: 0, excluded: 0, percent: null },
};
const base = {
  courseId: "course",
  canManage: false,
  weights: { practice: 50, exam: 50, revision: 0 },
  summary,
  units: [{ unitId: "unit", title: "Trusted calculus unit", summary }],
  unitCount: 1,
  offset: 0,
  hasMore: false,
  unavailableSessions: 0,
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.language = "en";
  mocks.read.mockResolvedValue(base);
  mocks.save.mockResolvedValue(1);
});
afterEach(cleanup);
async function open() {
  render(<PracticePerformance courseId="course" />);
  fireEvent.click(
    screen.getByRole("button", {
      name:
        mocks.language === "ar"
          ? "أدائي التدريبي في المساق"
          : "My course practice performance",
    }),
  );
  await screen.findByText("Trusted calculus unit");
}
it("is lazy, displays real counts and partial coverage, never student controls", async () => {
  render(<PracticePerformance courseId="course" />);
  expect(mocks.read).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText("My course practice performance"));
  await screen.findByText("Trusted calculus unit");
  expect(screen.getAllByText("Partial coverage")).toHaveLength(2);
  expect(screen.queryByText("Save course weights")).toBeNull();
  expect(screen.getByText(/not an official university grade/)).toBeTruthy();
});
it("preserves a real zero score and shows empty data honestly", async () => {
  mocks.read.mockResolvedValue({
    ...base,
    units: [],
    unitCount: 0,
    summary: { ...summary, score: 0 },
  });
  render(<PracticePerformance courseId="course" />);
  fireEvent.click(screen.getByText("My course practice performance"));
  await screen.findByText("No released answers yet");
  expect(screen.getByText("0%")).toBeTruthy();
});
it("clears results on focus before revalidation and after withdrawn access", async () => {
  await open();
  mocks.read.mockRejectedValue(new PracticeSessionError("denied"));
  fireEvent.focus(window);
  await screen.findByRole("alert");
  expect(screen.queryByText("Trusted calculus unit")).toBeNull();
  expect(screen.getByText(/Performance has been cleared/)).toBeTruthy();
});
it("does not resurrect an older request after a course change", async () => {
  let resolve!: (value: unknown) => void;
  mocks.read.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const view = render(<PracticePerformance courseId="course" />);
  fireEvent.click(screen.getByText("My course practice performance"));
  view.rerender(<PracticePerformance courseId="second" />);
  await screen.findByText("Trusted calculus unit");
  await act(async () =>
    resolve({
      ...base,
      units: [{ unitId: "old", title: "Old private unit", summary }],
    }),
  );
  expect(screen.queryByText("Old private unit")).toBeNull();
});
it("loads unit pages from the server and retains global summary", async () => {
  mocks.read
    .mockResolvedValueOnce({ ...base, hasMore: true, unitCount: 21 })
    .mockResolvedValue({ ...base, offset: 20 });
  await open();
  fireEvent.click(screen.getByText("Next units"));
  await waitFor(() =>
    expect(mocks.read).toHaveBeenLastCalledWith(
      "course",
      20,
      expect.any(AbortSignal),
    ),
  );
  await screen.findByText("Trusted calculus unit");
  expect(screen.getAllByText("66.67%")).toHaveLength(2);
});
it("preserves a weight draft across refresh, uses original CAS revision and reports conflict", async () => {
  mocks.read.mockResolvedValue({ ...base, canManage: true });
  await open();
  fireEvent.change(screen.getByLabelText("Practice (%)"), {
    target: { value: "30" },
  });
  fireEvent.change(screen.getByLabelText("Submitted self-tests (%)"), {
    target: { value: "70" },
  });
  mocks.read.mockResolvedValue({
    ...base,
    canManage: true,
    weights: { practice: 60, exam: 40, revision: 1 },
  });
  fireEvent.focus(window);
  await screen.findByText(/changed on another device/);
  expect(
    (screen.getByLabelText("Practice (%)") as HTMLInputElement).value,
  ).toBe("30");
  mocks.save.mockRejectedValueOnce(new PracticeSessionError("conflict"));
  fireEvent.click(screen.getByText("Save course weights"));
  await screen.findByRole("alert");
  expect(mocks.save).toHaveBeenCalledWith("course", 0, 30, 70);
  fireEvent.click(screen.getByText("Use current weights"));
  expect(
    (screen.getByLabelText("Practice (%)") as HTMLInputElement).value,
  ).toBe("60");
});
it("validates weights and clears everything on denied save", async () => {
  mocks.read.mockResolvedValue({ ...base, canManage: true });
  await open();
  fireEvent.change(screen.getByLabelText("Practice (%)"), {
    target: { value: "70" },
  });
  fireEvent.click(screen.getByText("Save course weights"));
  await screen.findByRole("alert");
  expect(mocks.save).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Submitted self-tests (%)"), {
    target: { value: "30" },
  });
  mocks.save.mockRejectedValue(new PracticeSessionError("denied"));
  fireEvent.click(screen.getByText("Save course weights"));
  await screen.findByText(/Performance has been cleared/);
  expect(screen.queryByText("Trusted calculus unit")).toBeNull();
});
it("renders Arabic RTL labels with isolated numeric ratios and no official grade claim", async () => {
  mocks.language = "ar";
  await open();
  expect(
    screen
      .getByText("أدائي التدريبي في المساق")
      .closest("section")
      ?.getAttribute("dir"),
  ).toBe("rtl");
  expect(screen.getByText(/ليس علامة جامعية رسمية/)).toBeTruthy();
  expect(screen.getAllByText("2/3")[0].getAttribute("dir")).toBe("ltr");
});
it("supports retry after an unavailable service without retaining stale results", async () => {
  mocks.read
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValue(base);
  render(<PracticePerformance courseId="course" />);
  fireEvent.click(screen.getByText("My course practice performance"));
  await screen.findByRole("alert");
  fireEvent.click(screen.getByText("Refresh performance"));
  await screen.findByText("Trusted calculus unit");
  expect(screen.queryByRole("alert")).toBeNull();
});
