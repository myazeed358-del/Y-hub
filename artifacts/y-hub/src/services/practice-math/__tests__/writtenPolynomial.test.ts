import { describe, expect, it } from "vitest";
import {
  gradeWrittenPolynomial,
  parseWrittenPolynomial,
} from "../writtenPolynomial";
import { gradeWrittenPolynomial as deployed } from "../../../../supabase/functions/_shared/tutor/polynomialVerifier.mjs";
const derivative = {
  method: "polynomial-derivative-v1",
  task: {
    kind: "polynomial_derivative",
    variable: "x",
    coefficients: [7, 1, 1],
    options: [[1, 2], [0], [1], [2]],
  },
};
const integral = {
  method: "polynomial-antiderivative-v1",
  task: {
    kind: "polynomial_antiderivative",
    variable: "x",
    coefficients: [1, 2],
    options: [[0, 1, 1], [0], [0, 2], [0, 3]],
  },
};
describe.each([gradeWrittenPolynomial, deployed])(
  "written source and actual Edge artifact",
  (grade) => {
    it.each(["2*x+1", "1+x+x", "٢*x+١", "۲×x+۱", "-x+3x+1", "2x^1+1x^0"])(
      "compares exact derivative coefficients: %s",
      (text) => {
        expect(grade(derivative, text, "en").score).toBe(1);
      },
    );
    it("scores a supported wrong polynomial without requiring a matching distractor", () => {
      expect(grade(derivative, "7x+14", "ar").score).toBe(0);
      expect(grade(derivative, "7x+14", "ar").explanation).toContain(
        "المعاملات غير متطابقة",
      );
    });
    it.each(["x^2+x+C", "x+x^2+47+C", "x^2+x-13-C"])(
      "verifies the integral family by differentiation: %s",
      (text) => {
        expect(grade(integral, text, "en").score).toBe(1);
      },
    );
    it("does not erase the integrand's constant or confuse variable names", () => {
      expect(grade(integral, "x^2+C", "en").score).toBe(0);
      expect(grade(derivative, "2t+1", "en").score).toBeNull();
    });
    it.each([
      "sin(x)",
      "x/x+2x",
      "(x+1)^2",
      "1 2*x",
      "2.0*x+1",
      "2x++1",
      "2x+",
      "2x+C",
      "x^99",
      "x^-1",
      "1e2*x",
      "Infinity",
      "9999999999999999*x",
      "x".repeat(401),
      "<script>alert(1)</script>",
      "x;fetch('https://example.com')",
    ])("keeps unsupported/ambiguous input pending: %s", (text) => {
      expect(grade(derivative, text, "en").score).toBeNull();
    });
    it("does not claim a complete antiderivative family without +C", () => {
      expect(grade(integral, "x^2+x", "en").score).toBeNull();
      expect(grade(integral, "C", "en").score).toBeNull();
    });
    it("fails closed for unknown verifier contracts", () => {
      expect(
        grade({ ...derivative, method: "unknown" }, "2x+1", "en").score,
      ).toBeNull();
      expect(grade({ ...derivative, task: {} }, "2x+1", "en").score).toBeNull();
    });
  },
);
it("bounds degree, magnitude and intermediate coefficient sums before invoking the engine", () => {
  expect(parseWrittenPolynomial("800x^8-800x^8", "x", false)).toEqual([0]);
  expect(() => parseWrittenPolynomial("800x+1x-800x", "x", false)).toThrow();
  expect(() =>
    parseWrittenPolynomial(Array(65).fill("x").join("+"), "x", false),
  ).toThrow();
});
