import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
const calls = vi.hoisted(() => ({ detail: vi.fn(), resolve: vi.fn() }));
vi.mock("@/i18n/LanguageContext", () => ({
  useLanguage: () => ({ language: "en" }),
}));
vi.mock("../repository", () => ({ reviewRepository: calls }));
vi.mock("../../../knowledge/SourceEvidence", () => ({
  SourceEvidence: () => <p>Trusted citations</p>,
}));
import { ReviewDetailPanel } from "../ReviewDetailPanel";
import { PracticeSessionError } from "../../sessionsRepository";
const data = {
  review: { id: "review", position: 1, state: "requested", revision: 3 },
  question: {
    prompt: "Derivative $x^2$",
    options: ["$2x$", "$3x$", "$4x$", "$5x$"],
    choice: 1,
    suggestedChoice: 0,
    explanation: "Original suggestion",
    citations: [],
  },
  automatic: { choice: null, explanation: "Uncertain" },
  resolution: null,
};
beforeEach(() => {
  vi.clearAllMocks();
  calls.detail.mockResolvedValue(data);
  calls.resolve.mockResolvedValue(4);
  vi.spyOn(window, "confirm").mockReturnValue(true);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
async function open(manage = true) {
  const changed = vi.fn();
  render(<ReviewDetailPanel id="review" manage={manage} onChanged={changed} />);
  await screen.findByText("Trusted citations");
  return changed;
}
it("renders mathematical evidence without granting a student a resolution form", async () => {
  await open(false);
  expect(document.querySelector(".katex")).toBeTruthy();
  expect(screen.queryByText("Apply resolution")).toBeNull();
});
it("requires an explicit decision and explanation", async () => {
  await open();
  fireEvent.click(screen.getByText("Apply resolution"));
  await screen.findByRole("alert");
  expect(calls.resolve).not.toHaveBeenCalled();
});
it("saves a CAS resolution and notifies the queue", async () => {
  const changed = await open();
  fireEvent.change(screen.getByLabelText("Correct option after review"), {
    target: { value: "1" },
  });
  fireEvent.change(
    screen.getByLabelText("Explain the resolution (10–2000 characters)"),
    { target: { value: "Verified against the approved book." } },
  );
  fireEvent.click(screen.getByText("Apply resolution"));
  await waitFor(() => expect(changed).toHaveBeenCalled());
  expect(calls.resolve).toHaveBeenCalledWith(
    "review",
    3,
    1,
    "Verified against the approved book.",
  );
});
it("explicit exclusion sends null rather than marking an answer incorrect", async () => {
  await open();
  fireEvent.change(screen.getByLabelText("Correct option after review"), {
    target: { value: "exclude" },
  });
  fireEvent.change(
    screen.getByLabelText("Explain the resolution (10–2000 characters)"),
    { target: { value: "The question has more than one valid answer." } },
  );
  fireEvent.click(screen.getByText("Apply resolution"));
  await waitFor(() =>
    expect(calls.resolve).toHaveBeenCalledWith(
      "review",
      3,
      null,
      expect.any(String),
    ),
  );
});
it("retains an unsaved decision after conflict and reload without blind retry", async () => {
  calls.resolve.mockRejectedValue(new PracticeSessionError("conflict"));
  await open();
  fireEvent.change(screen.getByLabelText("Correct option after review"), {
    target: { value: "2" },
  });
  fireEvent.change(
    screen.getByLabelText("Explain the resolution (10–2000 characters)"),
    { target: { value: "A considered reviewer explanation." } },
  );
  fireEvent.click(screen.getByText("Apply resolution"));
  await screen.findByRole("alert");
  expect(screen.queryByText("Trusted citations")).toBeNull();
  fireEvent.click(screen.getByText("Refresh reviews"));
  await screen.findByText("Trusted citations");
  expect(
    (screen.getByLabelText("Correct option after review") as HTMLSelectElement)
      .value,
  ).toBe("2");
  expect(calls.resolve).toHaveBeenCalledTimes(1);
});
it("revalidates on focus and clears details after revoked authorization", async () => {
  const denied = vi.fn();
  render(
    <ReviewDetailPanel
      id="review"
      manage
      onChanged={vi.fn()}
      onDenied={denied}
    />,
  );
  await screen.findByText("Trusted citations");
  calls.detail.mockRejectedValue(new PracticeSessionError("denied"));
  fireEvent(window, new Event("focus"));
  await screen.findByRole("alert");
  expect(screen.queryByText("Trusted citations")).toBeNull();
  expect(screen.queryByText("Apply resolution")).toBeNull();
  expect(denied).toHaveBeenCalledOnce();
});
