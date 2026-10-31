import { expect, it } from "vitest";
import { verifyDerivative, parseDerivativeTask } from "../polynomialDerivative";
import { verifyDerivative as deployed } from "../../../../supabase/functions/_shared/tutor/polynomialVerifier.mjs";
const task = {
  kind: "polynomial_derivative",
  variable: "x",
  coefficients: [1, -5, 2, 1],
  options: [[-5, 4, 3], [-5, 2, 3], [1, -5, 2, 1], [0]],
};
it("delegates the derivative and coefficient comparison to the existing engine", () => {
  const result = verifyDerivative(task, "en");
  expect(result.question.correct).toBe(0);
  expect(result.question.prompt).toContain("x^{3}+2x^{2}-5x+1");
  expect(result.question.explanation).toContain("3x^{2}+4x-5");
  expect(result.verification.method).toBe("polynomial-derivative-v1");
  expect(result.question.options).toHaveLength(4);
});
it("renders Arabic instructions and independently computed per-term steps with LTR LaTeX", () => {
  const { question } = verifyDerivative(task, "ar");
  expect(question.prompt).toContain("اختر مشتقة");
  expect(question.explanation).toContain("نطبق قاعدة القوة");
  expect(question.explanation.match(/\\frac\{d\}\{dx\}\\left/g)).toHaveLength(
    4,
  );
  expect(question.explanation).toContain("\\boxed");
});
it.each([
  { coefficients: [7], options: [[7], [1], [0], [2]], correct: 2 },
  { coefficients: [0], options: [[1], [0], [2], [3]], correct: 1 },
  {
    coefficients: [0, 0, 0, 0, 0, 0, 0, 0, 100],
    options: [[0], [1], [2], [0, 0, 0, 0, 0, 0, 0, 800]],
    correct: 3,
  },
  {
    coefficients: [0, -3, 0, -2],
    options: [[-3, 0, -6], [-3, 0, 6], [3, 0, -6], [0]],
    correct: 0,
  },
])("verifies constants, zeros and supported boundary polynomials %#", (t) => {
  expect(
    verifyDerivative(
      { ...task, coefficients: t.coefficients, options: t.options },
      "en",
    ).question.correct,
  ).toBe(t.correct);
});
it("preserves the variable and never mutates inputs", () => {
  const v = { ...task, variable: "t" },
    original = JSON.stringify(v);
  expect(verifyDerivative(v, "en").question.prompt).toContain("f(t)");
  expect(JSON.stringify(v)).toBe(original);
});
it.each([
  { ...task, kind: "integral" },
  { ...task, variable: "__proto__" },
  { ...task, coefficients: [0.1, 1] },
  { ...task, coefficients: [101] },
  { ...task, coefficients: Array(10).fill(1) },
  { ...task, coefficients: [NaN] },
  { ...task, coefficients: [] },
  { ...task, options: [[1], [1, 0], [0], [2]] },
  { ...task, options: [[801], [0], [1], [2]] },
  { ...task, correct: 0 },
])("rejects unsupported or equivalent inputs %#", (value) =>
  expect(() => parseDerivativeTask(value)).toThrow(),
);
it("fails closed if the model supplies no mathematically correct option", () => {
  expect(() =>
    verifyDerivative({ ...task, options: [[0], [1], [2], [3]] }, "en"),
  ).toThrow(/No engine/);
});
it("executes the exact deployed artifact with the same verified results", () => {
  for (const language of ["ar", "en"] as const)
    expect(deployed(task, language)).toEqual(verifyDerivative(task, language));
});
