import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  read: vi.fn(),
  main: vi.fn(),
  language: "en" as "en" | "ar",
}));
vi.mock("@/i18n/LanguageContext", () => ({
  useLanguage: () => ({ language: state.language }),
}));
vi.mock("../topicRepository", () => ({
  topicRepository: { read: state.read },
}));
vi.mock("../repository", async (original) => ({
  ...(await original<object>()),
  performanceRepository: { read: state.main },
}));
import { TopicPerformance } from "../TopicPerformance";
import { PracticePerformance } from "../PracticePerformance";
import { PracticeSessionError } from "../../sessionsRepository";
const category = {
    earned: 2,
    graded: 3,
    pending: 1,
    excluded: 1,
    percent: 66.67,
  },
  summary = {
    score: 66.67,
    coverage: 40,
    practice: category,
    exam: { earned: 0, graded: 0, pending: 0, excluded: 0, percent: null },
  };
const attribution = {
  sourceId: "source",
  sourceRevision: "generation",
  outlineRevision: 1,
  sectionId: "topic",
  title: "تفاضل Derivatives",
  sourceTitle: "Approved book",
};
const data = {
  courseId: "course",
  kind: "topic",
  offset: 0,
  groupCount: 1,
  hasMore: false,
  weights: { practice: 40, exam: 60, revision: 1 },
  groups: [{ attribution, summary }],
};
beforeEach(() => {
  vi.resetAllMocks();
  state.language = "en";
  state.read.mockResolvedValue(data);
  state.main.mockResolvedValue({
    courseId: "course",
    canManage: false,
    weights: data.weights,
    summary,
    units: [],
    unitCount: 0,
    offset: 0,
    hasMore: false,
    unavailableSessions: 0,
  });
});
afterEach(cleanup);
it("shows trusted source identity and independent counts without an official grade", async () => {
  render(<TopicPerformance courseId="course" kind="topic" />);
  await screen.findByText("تفاضل Derivatives");
  expect(screen.getByText("Approved book")).toBeTruthy();
  expect(screen.getByText("2/3")).toBeTruthy();
  expect(screen.getByText("Partial coverage")).toBeTruthy();
  expect(screen.getByText(/must not be added together/)).toBeTruthy();
});
it("keeps ambiguous answers explicitly unclassified and pending", async () => {
  state.read.mockResolvedValue({
    ...data,
    groups: [{ attribution: null, summary: { ...summary, score: null } }],
  });
  render(<TopicPerformance courseId="course" kind="topic" />);
  await screen.findByText("Unclassified / mixed scope");
  expect(
    screen.getByText("No confirmed results in weighted categories yet"),
  ).toBeTruthy();
  expect(screen.queryByText("Approved book")).toBeNull();
});
it("loads bounded server pages and replaces the previous private page", async () => {
  state.read
    .mockResolvedValueOnce({ ...data, hasMore: true, groupCount: 21 })
    .mockResolvedValue({
      ...data,
      offset: 20,
      groups: [
        { attribution: { ...attribution, title: "Next topic" }, summary },
      ],
    });
  render(<TopicPerformance courseId="course" kind="topic" />);
  await screen.findByText("تفاضل Derivatives");
  fireEvent.click(screen.getByText("Next groups"));
  expect(screen.queryByText("تفاضل Derivatives")).toBeNull();
  await screen.findByText("Next topic");
  expect(state.read).toHaveBeenLastCalledWith(
    "course",
    "topic",
    20,
    expect.any(AbortSignal),
  );
});
it("clears topic names on denial and allows an explicit retry after transient failure", async () => {
  render(<TopicPerformance courseId="course" kind="topic" />);
  await screen.findByText("تفاضل Derivatives");
  state.read.mockRejectedValueOnce(new PracticeSessionError("denied"));
  fireEvent.click(screen.getByText("Refresh groups"));
  await screen.findByRole("alert");
  expect(screen.queryByText("تفاضل Derivatives")).toBeNull();
  fireEvent.click(screen.getByText("Refresh groups"));
  await screen.findByText("تفاضل Derivatives");
  expect(screen.queryByRole("alert")).toBeNull();
});
it("cancels late replies when the user switches dimensions", async () => {
  let resolve!: (value: unknown) => void;
  state.read.mockImplementationOnce(() => new Promise((r) => (resolve = r)));
  const v = render(
    <TopicPerformance key="topic" courseId="course" kind="topic" />,
  );
  await waitFor(() => expect(state.read).toHaveBeenCalled());
  const signal = state.read.mock.calls[0][3];
  state.read.mockResolvedValue({ ...data, kind: "chapter", groups: [] });
  v.rerender(
    <TopicPerformance key="chapter" courseId="course" kind="chapter" />,
  );
  await screen.findByText("No released answers yet");
  expect(signal.aborted).toBe(true);
  await act(async () => resolve(data));
  expect(screen.queryByText("تفاضل Derivatives")).toBeNull();
});
it("retains Arabic labels and LTR ratios and escapes teacher labels", async () => {
  state.language = "ar";
  state.read.mockResolvedValue({
    ...data,
    groups: [
      {
        attribution: { ...attribution, title: "<img src=x onerror=alert(1)>" },
        summary,
      },
    ],
  });
  const { container } = render(
    <TopicPerformance courseId="course" kind="topic" />,
  );
  await screen.findByText("<img src=x onerror=alert(1)>");
  expect(container.querySelector("img")).toBeNull();
  expect(screen.getByText("2/3").getAttribute("dir")).toBe("ltr");
  expect(
    screen
      .getByRole("region", { name: "موضوعات PDF" })
      .getAttribute("aria-label"),
  ).toBe("موضوعات PDF");
});
it("extends the existing indicator lazily, keeps unit view and clears all detail on access loss", async () => {
  render(<PracticePerformance courseId="course" />);
  fireEvent.click(screen.getByText("My course practice performance"));
  await screen.findByText("No released answers yet");
  expect(state.read).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "PDF topics" }));
  await screen.findByText("تفاضل Derivatives");
  expect(
    screen
      .getByRole("button", { name: "PDF topics" })
      .getAttribute("aria-pressed"),
  ).toBe("true");
  state.read.mockResolvedValue({ ...data, kind: "chapter", groups: [] });
  fireEvent.click(screen.getByRole("button", { name: "PDF chapters" }));
  await screen.findByText("No released answers yet");
  expect(state.read).toHaveBeenLastCalledWith(
    "course",
    "chapter",
    0,
    expect.any(AbortSignal),
  );
  state.main.mockRejectedValue(new PracticeSessionError("denied"));
  fireEvent.focus(window);
  await screen.findByRole("alert");
  expect(screen.queryByRole("region", { name: "PDF chapters" })).toBeNull();
});
