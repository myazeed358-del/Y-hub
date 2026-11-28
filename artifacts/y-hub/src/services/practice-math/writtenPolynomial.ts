import { DerivativeEngine } from "../math/symbolic/derivative";
import {
  ast,
  coefficientsOf,
  latex,
  parseDerivativeTask,
} from "./polynomialDerivative";
import { parseAntiderivativeTask } from "./polynomialAntiderivative";

/** A bounded text-to-polynomial adapter, not a general expression evaluator.
 * Only integer monomials and sums are accepted. Nothing is eval'd, sampled,
 * simplified across domain restrictions, or silently discarded. */
export function parseWrittenPolynomial(
  text: string,
  variable: "x" | "t",
  integral: boolean,
) {
  if (text.length > 400) throw new Error("Unsupported answer length");
  let source = text
    .trim()
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 1776))
    .replace(/−/g, "-")
    .replace(/×/g, "*");
  // Whitespace may separate tokens, never join digits ("1 2" is not twelve).
  if (/\d\s+\d/.test(source)) throw new Error("Ambiguous digits");
  source = source.replace(/\s/g, "");
  const family = /[+-]C$/.test(source);
  if (family) source = source.slice(0, -2);
  if (family !== integral)
    throw new Error("Expected a polynomial or a family +C");
  if (!source) throw new Error("Missing polynomial");
  const terms = source.match(/[+-]?[^+-]+/g);
  if (!terms || terms.join("") !== source || terms.length > 64)
    throw new Error("Unsupported expression");
  const values = Array<number>(9).fill(0);
  const monomial = new RegExp(
    `^([+-]?)(?:(\\d+)\\*?)?${variable}(?:\\^([0-8]))?$`,
  );
  for (const term of terms) {
    const match = term.match(monomial);
    let degree: number, value: number;
    if (match) {
      degree = match[3] === undefined ? 1 : Number(match[3]);
      value = (match[1] === "-" ? -1 : 1) * Number(match[2] ?? 1);
    } else if (/^[+-]?\d+$/.test(term)) {
      degree = 0;
      value = Number(term);
    } else throw new Error("Unsupported expression");
    if (!Number.isSafeInteger(value) || Math.abs(value) > 800)
      throw new Error("Unsupported coefficient");
    values[degree] += value;
    if (Math.abs(values[degree]) > 800)
      throw new Error("Unsupported coefficient sum");
  }
  while (values.length > 1 && values.at(-1) === 0) values.pop();
  return values;
}

export function gradeWrittenPolynomial(
  verification: unknown,
  text: string,
  language: "ar" | "en",
) {
  const ar = language === "ar";
  const pending = {
    score: null,
    explanation: ar
      ? "تحتاج الإجابة إلى مراجعة: لا يدعم التحقق الحالي هذا التعبير. لا تُحتسب الإجابة خاطئة."
      : "Needs review: this expression is outside the supported verifier. It is not counted as incorrect.",
  };
  if (
    !verification ||
    typeof verification !== "object" ||
    !("method" in verification) ||
    !("task" in verification)
  )
    return pending;
  const integral = verification.method === "polynomial-antiderivative-v1";
  if (!integral && verification.method !== "polynomial-derivative-v1")
    return pending;
  try {
    const task = integral
      ? parseAntiderivativeTask(verification.task)
      : parseDerivativeTask(verification.task);
    const answer = parseWrittenPolynomial(text, task.variable, integral);
    const engine = new DerivativeEngine();
    const actual = integral
      ? coefficientsOf(
          engine.differentiate(ast(answer, task.variable), task.variable),
          task.variable,
          6400,
        )
      : answer;
    const expected = integral
      ? task.coefficients
      : coefficientsOf(
          engine.differentiate(
            ast(task.coefficients, task.variable),
            task.variable,
          ),
          task.variable,
        );
    const score = JSON.stringify(actual) === JSON.stringify(expected) ? 1 : 0;
    return {
      score,
      explanation: [
        ar
          ? "نقارن معاملات كثير الحدود بدقة باستخدام المحرك:"
          : "Compare polynomial coefficients exactly using the engine:",
        integral
          ? `\\[\\frac{d}{d${task.variable}}\\left(${latex(answer, task.variable)}+C\\right)=${latex(actual, task.variable)}\\]`
          : `\\[${latex(answer, task.variable)}\\]`,
        `${ar ? "الناتج المطلوب للمقارنة" : "Expected comparison result"}: \\[${latex(expected, task.variable)}\\]`,
        score
          ? ar
            ? "المعاملات متطابقة."
            : "The coefficients match."
          : ar
            ? "المعاملات غير متطابقة."
            : "The coefficients differ.",
      ].join("\n"),
    };
  } catch {
    return pending;
  }
}
