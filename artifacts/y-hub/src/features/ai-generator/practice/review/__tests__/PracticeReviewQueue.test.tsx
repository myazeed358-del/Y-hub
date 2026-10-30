import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
const calls = vi.hoisted(() => ({ queue: vi.fn() }));
vi.mock("@/i18n/LanguageContext", () => ({
  useLanguage: () => ({ language: "ar" }),
}));
vi.mock("../repository", () => ({ reviewRepository: calls }));
vi.mock("../ReviewDetailPanel", () => ({
  ReviewDetailPanel: () => <p>Protected review</p>,
  reviewButton: "button",
}));
import { PracticeReviewQueue } from "../PracticeReviewQueue";
import { PracticeSessionError } from "../../sessionsRepository";
const row = {
  id: "review",
  position: 1,
  state: "requested",
  revision: 3,
  full_name_ar: "طالب عربي",
  full_name_en: "Student",
  user_number: "001234567",
};
beforeEach(() => {
  vi.clearAllMocks();
  calls.queue.mockResolvedValue([row]);
});
afterEach(cleanup);
async function open() {
  render(<PracticeReviewQueue courseId="course" />);
  fireEvent.click(screen.getByText("مراجعات إجابات الشعبة"));
  await screen.findByText("001234567");
}
it("loads only when opened and displays localized student identity", async () => {
  await open();
  expect(calls.queue).toHaveBeenCalledWith(
    "course",
    false,
    0,
    expect.any(AbortSignal),
  );
  expect(screen.getByText("001234567").getAttribute("dir")).toBe("ltr");
  expect(screen.getByRole("button", { name: /طالب عربي/ })).toBeTruthy();
});
it("changes queue filter on the server and resets pagination", async () => {
  await open();
  fireEvent.click(screen.getByText("مراجعات محسومة"));
  await waitFor(() =>
    expect(calls.queue).toHaveBeenLastCalledWith(
      "course",
      true,
      0,
      expect.any(AbortSignal),
    ),
  );
});
it("losing the instructor role hides loaded review content", async () => {
  await open();
  fireEvent.click(screen.getByRole("button", { name: /طالب عربي/ }));
  calls.queue.mockRejectedValue(new PracticeSessionError("denied"));
  fireEvent.click(screen.getByText("تحديث المراجعات"));
  await screen.findByRole("alert");
  expect(screen.queryByText("Protected review")).toBeNull();
  expect(screen.queryByText("001234567")).toBeNull();
});
