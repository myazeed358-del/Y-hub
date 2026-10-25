import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const repo = vi.hoisted(() => ({
  session: vi.fn(),
  sessionRoster: vi.fn(),
  open: vi.fn(),
  correct: vi.fn(),
  cancel: vi.fn(),
  extend: vi.fn(),
  close: vi.fn(),
}));
vi.mock("../repository", () => ({ attendanceRepository: repo }));
vi.mock("../QrPanel", () => ({ QrPanel: () => <div>QR</div> }));
import { AttendanceSessionPanel } from "../AttendanceSessionPanel";
const props = {
  lecture: "lecture",
  ar: false,
  version: 0,
  busy: false,
  mutate: async (fn: () => Promise<unknown>) => {
    await fn();
  },
};
const session = {
  id: "session",
  state: "closed",
  expires_at: "2026-10-24T20:00:00Z",
  qr_interval_seconds: 30,
  serverTime: "2026-10-24T19:00:00Z",
};
beforeEach(() => {
  vi.clearAllMocks();
  repo.session.mockResolvedValue(null);
  repo.sessionRoster.mockResolvedValue([{
    student_id: "student",
    full_name: "Student",
    user_number: "202600001",
  }]);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
it("defaults duration to ten minutes independently of QR and sends selected presets", async () => {
  render(<AttendanceSessionPanel {...props} />);
  await screen.findByText("Open attendance");
  expect(screen.getByLabelText("Attendance duration in minutes (1–120)"))
    .toHaveProperty("value", "10");
  fireEvent.click(screen.getByText("15 min"));
  fireEvent.click(screen.getByText("30 sec"));
  fireEvent.click(screen.getByText("Open attendance"));
  await waitFor(() =>
    expect(repo.open).toHaveBeenCalledWith("lecture", 15, 30)
  );
});
it("shows nine digit numbers and only binary corrections without a required reason", async () => {
  repo.session.mockResolvedValue(session);
  render(<AttendanceSessionPanel {...props} />);
  await screen.findByText("Student · 202600001");
  expect(screen.queryByText("Excused")).toBeNull();
  expect(screen.queryByRole("textbox")).toBeNull();
  fireEvent.change(screen.getByLabelText("Student"), {
    target: { value: "student" },
  });
  fireEvent.click(screen.getByText("Save correction"));
  await waitFor(() =>
    expect(repo.correct).toHaveBeenCalledWith("session", "student", "present")
  );
});
it("requires confirmation to cancel attendance separately from the lecture", async () => {
  repo.session.mockResolvedValue(session);
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  render(<AttendanceSessionPanel {...props} />);
  fireEvent.click(await screen.findByText("Cancel attendance session"));
  expect(repo.cancel).not.toHaveBeenCalled();
  confirm.mockReturnValue(true);
  fireEvent.click(screen.getByText("Cancel attendance session"));
  await waitFor(() => expect(repo.cancel).toHaveBeenCalledWith("session"));
});
it("uses server state to remove QR and extension controls after automatic expiry", async () => {
  vi.useFakeTimers();
  repo.session.mockResolvedValueOnce({ ...session, state: "open" })
    .mockResolvedValue(session);
  render(<AttendanceSessionPanel {...props} />);
  await act(async () => {});
  expect(screen.getByText("QR")).toBeTruthy();
  await act(() => vi.advanceTimersByTimeAsync(5000));
  expect(screen.queryByText("QR")).toBeNull();
  expect(screen.queryByText("Extend session")).toBeNull();
});
it("fails closed and removes cached roster on access loss", async () => {
  vi.useFakeTimers();
  repo.session.mockResolvedValueOnce(session).mockRejectedValue(
    new Error("denied"),
  );
  render(<AttendanceSessionPanel {...props} />);
  await act(async () => {});
  expect(screen.getByText("Student · 202600001")).toBeTruthy();
  await act(() => vi.advanceTimersByTimeAsync(5000));
  expect(screen.getByRole("alert")).toBeTruthy();
  expect(screen.queryByText("Student · 202600001")).toBeNull();
  expect(screen.queryByText("Open attendance")).toBeNull();
});
it("supports Arabic and hides all mutations for cancelled sessions", async () => {
  repo.session.mockResolvedValue({ ...session, state: "cancelled" });
  render(<AttendanceSessionPanel {...props} ar />);
  expect(await screen.findByText(/ملغاة/)).toBeTruthy();
  expect(screen.queryAllByRole("button")).toHaveLength(0);
});
it("ignores old responses after switching the keyed lecture context", async () => {
  let resolve!: (value: unknown) => void;
  repo.session.mockReturnValueOnce(new Promise((r) => resolve = r));
  const view = render(<AttendanceSessionPanel {...props} key="old" />);
  view.rerender(<AttendanceSessionPanel {...props} lecture="new" key="new" />);
  await screen.findByText("Open attendance");
  await act(async () => {
    resolve(session);
  });
  expect(screen.queryByText("Save correction")).toBeNull();
});
it("submits extension independently of the QR interval", async () => {
  repo.session.mockResolvedValue({ ...session, state: "open" });
  render(<AttendanceSessionPanel {...props} />);
  fireEvent.change(await screen.findByLabelText("Additional minutes"), {
    target: { value: "15" },
  });
  fireEvent.click(screen.getByText("Extend session"));
  await waitFor(() => expect(repo.extend).toHaveBeenCalledWith("session", 15));
});
