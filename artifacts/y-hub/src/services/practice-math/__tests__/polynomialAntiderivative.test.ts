import { expect, it } from "vitest";
import {
  parseAntiderivativeTask,
  verifyAntiderivative,
} from "../polynomialAntiderivative";
import { verifyPolynomial as deployed } from "../../../../supabase/functions/_shared/tutor/polynomialVerifier.mjs";
const task = {
  kind: "polynomial_antiderivative",
  variable: "x",
  coefficients: [2, -6, 3],
  options: [[7, 2, -3, 1], [0, 2, -6, 1], [0, 2, -3, 3], [0]],
};
it.each(["en", "ar"] as const)(
  "verifies each term with the existing engine and renders %s",
  (language) => {
    const original = JSON.stringify(task),
      result = verifyAntiderivative(task, language);
    expect(result.question.correct).toBe(0);
    expect(result.question.options[0]).toBe(String.raw`\(x^{3}-3x^{2}+2x+C\)`);
    expect(result.question.explanation).toContain(String.raw`\boxed`);
    expect(result.question.explanation.match(/\\frac\{d\}/g)).toHaveLength(4);
    expect(result.question.prompt).toContain(
      language === "ar" ? "للتكامل غير المحدد" : "indefinite integral",
    );
    expect(deployed(task, language)).toEqual(result);
    expect(JSON.stringify(task)).toBe(original);
  },
);
it.each([
  { coefficients: [0], options: [[0, 1], [0], [0, 2], [0, 0, 1]], correct: 1 },
  { coefficients: [-8], options: [[0], [0, 8], [0, -8], [0, -4]], correct: 2 },
  {
    coefficients: [0, 0, 0, 0, 0, 0, 0, 96],
    options: [[0], [0, 1], [0, 2], [0, 0, 0, 0, 0, 0, 0, 0, 12]],
    correct: 3,
  },
])(
  "handles zero, negative constants and maximum degree %#",
  ({ correct, ...data }) => {
    expect(
      verifyAntiderivative({ ...task, ...data, variable: "t" }, "en").question
        .correct,
    ).toBe(correct);
  },
);
it.each([
  { coefficients: [1, 1] }, // no integer-coefficient primitive among the candidates
  { coefficients: [0, 0, 0, 0, 0, 0, 0, 0, 8] },
  { coefficients: [101] },
  { coefficients: [0.5] },
  { coefficients: [Infinity] },
  { coefficients: [] },
  { options: [[0], [7], [0, 1], [0, 2]] },
  { options: [[0, 1], [5, 1, 0], [0, 2], [0]] },
  { options: [[0, 801], [0], [0, 1], [0, 2]] },
  {
    options: [
      [0, 1],
      [0, 2],
      [0, 3],
      [0, 4],
    ],
  },
  { variable: "y" },
  { kind: "definite_integral" },
  { correct: 0 },
])("fails closed for unsupported, ambiguous or fabricated tasks %#", (data) => {
  expect(() => verifyAntiderivative({ ...task, ...data }, "en")).toThrow();
});
it("normalizes constant and trailing zeros before comparing/rendering families", () => {
  expect(parseAntiderivativeTask(task).options[0]).toEqual([0, 2, -3, 1]);
});
