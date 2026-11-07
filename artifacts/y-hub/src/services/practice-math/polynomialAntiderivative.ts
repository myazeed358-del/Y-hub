import { DerivativeEngine } from "../math/symbolic/derivative";
import { ast, coefficientsOf, latex, vector } from "./polynomialDerivative";

/** Bounded exact integer polynomials only. Verify every candidate by the existing
 * derivative engine; no numerical sampling, LLM key or duplicated integration rule.
 * Constants represent the same indefinite integral family, not different options.
 */
export function parseAntiderivativeTask(value: unknown) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).sort().join(",") !== "coefficients,kind,options,variable"
  )
    throw new Error("Invalid antiderivative task");
  const p = value as Record<string, unknown>;
  if (
    p.kind !== "polynomial_antiderivative" ||
    !["x", "t"].includes(String(p.variable)) ||
    !Array.isArray(p.options) ||
    p.options.length !== 4
  )
    throw new Error("Unsupported antiderivative task");
  const coefficients = vector(p.coefficients, 100);
  if (coefficients.length > 8) throw new Error("Unsupported integrand degree");
  const options = p.options.map((option) => {
    const result = vector(option, 800);
    result[0] = 0; // absorb the additive constant in C before display/comparison
    return vector(result, 800);
  });
  if (new Set(options.map((v) => JSON.stringify(v))).size !== 4)
    throw new Error("Equivalent antiderivative choices");
  return {
    kind: "polynomial_antiderivative" as const,
    variable: p.variable as "x" | "t",
    coefficients,
    options,
  };
}

export function verifyAntiderivative(value: unknown, language: "ar" | "en") {
  const task = parseAntiderivativeTask(value),
    engine = new DerivativeEngine();
  const differentiate = (v: number[]) =>
    coefficientsOf(
      engine.differentiate(ast(v, task.variable), task.variable),
      task.variable,
      6400,
    );
  const matches = task.options.map(
    (option) =>
      JSON.stringify(differentiate(option)) ===
      JSON.stringify(task.coefficients),
  );
  if (matches.filter(Boolean).length !== 1)
    throw new Error("No engine-verified antiderivative choice");
  const correct = matches.indexOf(true);
  const answer = task.options[correct],
    x = task.variable;
  const steps = answer.flatMap((c, power) => {
    if (!c) return [];
    const term = Array(power + 1).fill(0);
    term[power] = c;
    return [
      `\\[\\frac{d}{d${x}}\\left(${latex(term, x)}\\right)=${latex(differentiate(term), x)}\\]`,
    ];
  });
  return {
    question: {
      prompt: `${language === "ar" ? "اختر عائلة الدوال الأصلية للتكامل غير المحدد" : "Choose the antiderivative family of the indefinite integral"}:\n\\[\\int \\left(${latex(task.coefficients, x)}\\right)\\,d${x}\\]`,
      options: task.options.map(
        (v) => `\\(${v.length === 1 ? "C" : `${latex(v, x)}+C`}\\)`,
      ),
      correct,
      explanation: [
        language === "ar"
          ? "نستخدم قاعدة القوة للتكامل والخطية، ثم نتحقق باشتقاق الإجابة حدًا حدًا:"
          : "Use the integration power rule and linearity, then verify the answer by differentiating each term:",
        `\\[\\int a ${x}^n\\,d${x}=\\frac{a}{n+1}${x}^{n+1}+C\\quad(n\\geq0)\\]`,
        ...steps,
        `\\[\\frac{d}{d${x}}\\left(${latex(answer, x)}+C\\right)=${latex(task.coefficients, x)}\\]`,
        `\\[\\boxed{\\int\\left(${latex(task.coefficients, x)}\\right)\\,d${x}=${answer.length === 1 ? "C" : `${latex(answer, x)}+C`}}\\]`,
        language === "ar"
          ? "الثابت C عدد حقيقي اعتباطي. التحقق لكثيرات حدود محدودة ذات دوال أصلية بمعاملات صحيحة على الأعداد الحقيقية؛ لا يشمل التكاملات العامة أو الكسور."
          : "C is an arbitrary real constant. Verification covers bounded polynomials with integer-coefficient antiderivatives over the reals; general integrals and fractional coefficients are not supported.",
      ].join("\n"),
    },
    verification: { method: "polynomial-antiderivative-v1" as const, task },
  };
}
