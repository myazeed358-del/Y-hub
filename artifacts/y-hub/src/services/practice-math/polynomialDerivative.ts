import type { CanonicalAST } from "../math/types/ast";
import { DerivativeEngine } from "../math/symbolic/derivative";
import { PolynomialExtractor } from "../math/symbolic/polynomial";
import { ASTEvaluator } from "../math/symbolic/evaluator";

/** Server adapter: a deliberately bounded exact-integer polynomial capability.
 * It delegates differentiation/extraction to the existing engine. No LLM key,
 * numerical spot checks, arbitrary expressions or browser calculation is trusted.
 */
export const verifierVersion = "polynomial-derivative-v1";
export type DerivativeTask = {
  kind: "polynomial_derivative";
  variable: "x" | "t";
  coefficients: number[];
  options: number[][];
};
const keys = (v: object) => Object.keys(v).sort().join(",");
function vector(v: unknown, bound: number): number[] {
  if (
    !Array.isArray(v) ||
    v.length < 1 ||
    v.length > 9 ||
    v.some(
      (n) =>
        typeof n !== "number" ||
        !Number.isSafeInteger(n) ||
        Math.abs(n) > bound,
    )
  )
    throw new Error("Unsupported polynomial coefficients");
  const result = [...v];
  while (result.length > 1 && result.at(-1) === 0) result.pop();
  return result;
}
export function parseDerivativeTask(value: unknown): DerivativeTask {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    keys(value) !== "coefficients,kind,options,variable"
  )
    throw new Error("Invalid derivative task");
  const p = value as Record<string, unknown>;
  if (
    p.kind !== "polynomial_derivative" ||
    !["x", "t"].includes(String(p.variable)) ||
    !Array.isArray(p.options) ||
    p.options.length !== 4
  )
    throw new Error("Unsupported derivative task");
  const coefficients = vector(p.coefficients, 100),
    options = p.options.map((v) => vector(v, 800));
  if (new Set(options.map((v) => JSON.stringify(v))).size !== 4)
    throw new Error("Equivalent answer choices");
  return {
    kind: "polynomial_derivative",
    variable: p.variable as "x" | "t",
    coefficients,
    options,
  };
}
const number = (n: number): CanonicalAST => ({
  type: "Number",
  value: String(n),
});
function ast(coefficients: number[], variable: string): CanonicalAST {
  const terms: CanonicalAST[] = coefficients.flatMap((c, power) =>
    c === 0
      ? []
      : [
          power === 0
            ? number(c)
            : ({
                type: "Operator",
                operator: "*",
                args: [
                  number(c),
                  power === 1
                    ? { type: "Symbol", name: variable }
                    : {
                        type: "Operator",
                        operator: "^",
                        args: [
                          { type: "Symbol", name: variable },
                          number(power),
                        ],
                      },
                ],
              } as CanonicalAST),
        ],
  );
  return terms.length === 0
    ? number(0)
    : terms.length === 1
      ? terms[0]
      : { type: "Operator", operator: "+", args: terms };
}
function coefficientsOf(node: CanonicalAST, variable: string): number[] {
  const values = Array(9).fill(0) as number[],
    evaluator = new ASTEvaluator();
  for (const [degree, coefficients] of new PolynomialExtractor().extract(
    node,
    variable,
  )) {
    if (!Number.isInteger(degree) || degree < 0 || degree > 8)
      throw new Error("Unsupported engine result");
    values[degree] = coefficients.reduce(
      (sum, coefficient) => sum + evaluator.evaluate(coefficient, {}),
      0,
    );
  }
  return vector(values, 800);
}
/** Rendering only: all numeric coefficients are bounded integers, variable is allowlisted. */
function latex(coefficients: number[], variable: string): string {
  const terms = coefficients
    .map((c, power) => {
      if (!c) return "";
      const magnitude = Math.abs(c),
        body =
          power === 0
            ? String(magnitude)
            : `${magnitude === 1 ? "" : magnitude}${variable}${power === 1 ? "" : `^{${power}}`}`;
      return `${c < 0 ? "-" : "+"}${body}`;
    })
    .filter(Boolean)
    .reverse()
    .join("");
  return terms.replace(/^\+/, "") || "0";
}
export function verifyDerivative(value: unknown, language: "ar" | "en") {
  const task = parseDerivativeTask(value),
    engine = new DerivativeEngine();
  const answer = coefficientsOf(
    engine.differentiate(ast(task.coefficients, task.variable), task.variable),
    task.variable,
  );
  const correct = task.options.findIndex(
    (v) => JSON.stringify(v) === JSON.stringify(answer),
  );
  if (correct === -1) throw new Error("No engine-verified answer choice");
  const termSteps = task.coefficients.flatMap((c, power) => {
    if (!c) return [];
    const term = Array(power + 1).fill(0);
    term[power] = c;
    const result = coefficientsOf(
      engine.differentiate(ast(term, task.variable), task.variable),
      task.variable,
    );
    return [
      `\\[\\frac{d}{d${task.variable}}\\left(${latex(term, task.variable)}\\right)=${latex(result, task.variable)}\\]`,
    ];
  });
  return {
    question: {
      prompt: `${language === "ar" ? "اختر مشتقة الدالة بالنسبة إلى" : "Choose the derivative with respect to"} $${task.variable}$:\n\\[f(${task.variable})=${latex(task.coefficients, task.variable)}\\]`,
      options: task.options.map((v) => `\\(${latex(v, task.variable)}\\)`),
      correct,
      explanation: [
        language === "ar"
          ? "نطبق قاعدة القوة والخطية على كل حد:"
          : "Apply the power rule and linearity to each term:",
        `\\[\\frac{d}{d${task.variable}}(a ${task.variable}^n)=a n ${task.variable}^{n-1}\\quad(n\\geq1),\\qquad\\frac{d}{d${task.variable}}a=0\\]`,
        ...termSteps,
        `\\[\\boxed{f'(${task.variable})=${latex(answer, task.variable)}}\\]`,
        language === "ar"
          ? "التحقق لكثيرات الحدود المحدودة بمعاملات صحيحة؛ المجال جميع الأعداد الحقيقية."
          : "Verified for bounded integer-coefficient polynomials over the real numbers.",
      ].join("\n"),
    },
    verification: { method: verifierVersion, task },
  };
}
