import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
const calls = vi.hoisted(() => ({
  assessment: vi.fn(),
  begin: vi.fn(),
  recheck: vi.fn(),
  request: vi.fn(),
  language: "en" as "en" | "ar",
}));
vi.mock("@/i18n/LanguageContext", () => ({
  useLanguage: () => ({ language: calls.language }),
}));
vi.mock("../repository", () => ({ reviewRepository: calls }));
vi.mock("../ReviewDetailPanel", () => ({
  ReviewDetailPanel: () => <p>Protected details</p>,
  reviewButton: "button",
}));
import { PracticeAssessment } from "../PracticeAssessment";
import { PracticeSessionError } from "../../sessionsRepository";
const row = {
  position: 1,
  id: null,
  state: "unverified",
  revision: null,
  outcome: null,
  score: null,
};
const data = { earned: 0, graded: 0, pending: 1, excluded: 0, items: [row] };
beforeEach(() => {
  vi.clearAllMocks();
  calls.language = "en";
  calls.assessment.mockResolvedValue(data);
  calls.begin.mockResolvedValue("review");
  calls.recheck.mockResolvedValue(undefined);
  calls.request.mockResolvedValue(3);
});
afterEach(cleanup);
async function open() {
  render(<PracticeAssessment sessionId="session" revision={3} />);
  await screen.findByText(/Unverified suggestion/);
}
it("does not display pending answers as a zero grade", async () => {
  await open();
  expect(screen.getByText(/Confirmed review score:/).textContent).toContain(
    "—",
  );
  expect(screen.getByText(/Confirmed review score:/).textContent).toContain(
    "Not yet resolved: 1",
  );
});
it("displays a server-verified score and permits requesting review without claiming a human resolved it", async () => {
  calls.assessment.mockResolvedValue({
    ...data,
    earned: 1,
    graded: 1,
    pending: 0,
    items: [{ ...row, state: "math_verified", score: 1 }],
  });
  render(<PracticeAssessment sessionId="session" revision={3} />);
  await screen.findByText(/Engine-verified polynomial derivative/);
  expect(screen.getByText("1/1")).toBeTruthy();
  fireEvent.click(screen.getByText("Recheck this answer"));
  await waitFor(() => expect(calls.begin).toHaveBeenCalledWith("session", 1));
});
it("runs the server-owned recheck before offering a human request", async () => {
  await open();
  expect(screen.queryByText("Request instructor review")).toBeNull();
  fireEvent.click(screen.getByText("Recheck this answer"));
  await waitFor(() => expect(calls.recheck).toHaveBeenCalledWith("review"));
  expect(calls.begin).toHaveBeenCalledWith("session", 1);
  expect(calls.request).not.toHaveBeenCalled();
});
it("requests human review using the server revision and leaves score unresolved", async () => {
  calls.assessment.mockResolvedValue({
    ...data,
    items: [
      {
        ...row,
        id: "review",
        state: "needs_review",
        revision: 2,
        outcome: "uncertain",
      },
    ],
  });
  render(<PracticeAssessment sessionId="session" revision={3} />);
  fireEvent.click(await screen.findByText("Request instructor review"));
  await waitFor(() => expect(calls.request).toHaveBeenCalledWith("review", 2));
  expect(calls.recheck).not.toHaveBeenCalled();
});
it("denial clears all private review details", async () => {
  const blocked = vi.fn();
  calls.assessment.mockResolvedValue({
    ...data,
    items: [{ ...row, id: "review", state: "requested", revision: 3 }],
  });
  render(
    <PracticeAssessment sessionId="session" revision={3} onBlocked={blocked} />,
  );
  fireEvent.click(await screen.findByText("Review details"));
  expect(screen.getByText("Protected details")).toBeTruthy();
  calls.assessment.mockRejectedValue(new PracticeSessionError("denied"));
  fireEvent.click(screen.getByText("Refresh reviews"));
  await screen.findByRole("alert");
  expect(screen.queryByText("Protected details")).toBeNull();
  expect(screen.queryByText("Review details")).toBeNull();
  expect(blocked).toHaveBeenCalledWith("denied");
});
it("shows only the server confirmed score in Arabic with LTR counts", async () => {
  calls.language = "ar";
  calls.assessment.mockResolvedValue({
    ...data,
    earned: 1,
    graded: 1,
    pending: 0,
    items: [{ ...row, id: "review", state: "resolved", revision: 4, score: 1 }],
  });
  render(<PracticeAssessment sessionId="session" revision={4} />);
  await screen.findByText(/حسمها المراجع/);
  expect(screen.getByText("1/1").getAttribute("dir")).toBe("ltr");
  expect(screen.getByRole("region").getAttribute("dir")).toBe("rtl");
});
it("quota failure permits retry without falsely reporting successful automatic review", async () => {
  calls.recheck.mockRejectedValue(new PracticeSessionError("quota"));
  await open();
  fireEvent.click(screen.getByText("Recheck this answer"));
  expect((await screen.findByRole("alert")).textContent).toContain("quota");
  expect(screen.queryByText("Request instructor review")).toBeNull();
});
