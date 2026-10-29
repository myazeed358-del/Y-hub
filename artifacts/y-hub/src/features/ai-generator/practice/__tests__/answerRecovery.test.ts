import { beforeEach, expect, it } from "vitest";
import { answerRecovery } from "../answerRecovery";
beforeEach(() => localStorage.clear());
it("stores only bounded choices isolated by account and session", () => {
  const value = { position: 1, choice: 0, revision: 2 };
  const r = answerRecovery("a", "s");
  expect(r.write(value)).toBe(true);
  expect(r.read()).toEqual(value);
  expect(answerRecovery("b", "s").read()).toBeNull();
  expect(answerRecovery("a", "t").read()).toBeNull();
  r.clear();
  expect(r.read()).toBeNull();
});
it("rejects corrupt or injected recovery data", () => {
  localStorage.setItem(
    "yhub-practice-choice:a:s",
    JSON.stringify({ position: 1, choice: 0, revision: 1, answer: "forged" }),
  );
  expect(answerRecovery("a", "s").read()).toBeNull();
  expect(
    answerRecovery("a", "s").write({ position: 101, choice: 0, revision: 2 }),
  ).toBe(false);
});
