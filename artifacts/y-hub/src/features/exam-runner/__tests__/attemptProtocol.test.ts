import { expect, it } from "vitest";
import { parseAttempt, remainingSeconds } from "../domain/attemptProtocol";
it("uses elapsed monotonic time and server offset, never device wall time", () => {
  const state = parseAttempt({
    status: "active",
    attempt_id: "10000000-0000-4000-8000-000000000001",
    started_at: "2026-01-01T10:00:00Z",
    deadline_at: "2026-01-01T10:01:00Z",
    server_now: "2026-01-01T10:00:30Z",
    result: null,
  });
  expect(remainingSeconds(state, 1000, 500, 11000)).toBe(20);
  expect(remainingSeconds(state, 1000, 500, 99000)).toBe(0);
});
it("accepts confirmed historical results without inventing a deadline", () => {
  expect(
    parseAttempt({
      status: "submitted",
      attempt_id: null,
      started_at: null,
      deadline_at: null,
      server_now: new Date().toISOString(),
      result: {
        id: "10000000-0000-4000-8000-000000000001",
        score: 1,
        total_score: 2,
      },
    }).status,
  ).toBe("submitted");
});
