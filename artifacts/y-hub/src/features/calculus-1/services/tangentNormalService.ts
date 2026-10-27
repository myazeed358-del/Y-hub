import { ExpressionParser } from '@/services/math/parser';
import { ASTNormalizer } from '@/services/math/parser/normalizer';
import {
  LocalSeriesEngine,
  Rat,
  type Rational
} from '@/services/math/symbolic/series';
import type { CanonicalAST } from '@/services/math/types/ast';
import type { MathStep } from '@/services/math/types/step';
import type { Calculus1Result } from './calculus1Service';

function polynomial(
  node: CanonicalAST,
  budget: { nodes: number }
): boolean {
  budget.nodes--;

  if (budget.nodes < 0) return false;

  if (node.type === 'Number') {
    return /^-?\d+(?:\.\d+)?$/.test(node.value) &&
      Number.isFinite(Number(node.value)) &&
      Math.abs(Number(node.value)) <= 1000000;
  }

  if (node.type === 'Symbol') {
    return node.name === 'x';
  }

  if (node.type === 'Parenthesis') {
    return polynomial(node.content, budget);
  }

  if (node.type !== 'Operator') return false;

  if (node.operator === '^') {
    if (node.args.length !== 2) return false;

    const exponent = node.args[1];

    return exponent.type === 'Number' &&
      /^\d+$/.test(exponent.value) &&
      Number(exponent.value) <= 12 &&
      polynomial(node.args[0], budget);
  }

  if (
    !['+', '-', '*', 'implicit_multiply']
      .includes(node.operator)
  ) {
    return false;
  }

  if (
    node.operator === '-' &&
    ![1, 2].includes(node.args.length)
  ) {
    return false;
  }

  return node.args.length > 0 &&
    node.args.every(arg => polynomial(arg, budget));
}

function text(value: Rational): string {
  const v = Rat.simplify(value);

  return v.den === 1n
    ? String(v.num)
    : `${v.num}/${v.den}`;
}

function latex(value: Rational): string {
  const v = Rat.simplify(value);

  return v.den === 1n
    ? String(v.num)
    : String.raw`\frac{${v.num}}{${v.den}}`;
}

function line(
  pointX: Rational,
  pointY: Rational,
  slope: Rational
): string {
  if (Rat.isZero(slope)) {
    return `y = ${latex(pointY)}`;
  }

  const negative = slope.num < 0n;

  const magnitude: Rational = {
    num: negative ? -slope.num : slope.num,
    den: slope.den
  };

  return (
    `y = ${latex(pointY)} ` +
    `${negative ? '-' : '+'} ` +
    `${latex(magnitude)}` +
    String.raw`\left(x - \left(${latex(pointX)}\right)\right)`
  );
}

export function solveCalculus1TangentNormal(
  expression: string,
  pointInput: string
): Calculus1Result {
  if (!expression.trim()) {
    throw new Error('Mathematical expression is required.');
  }

  if (!pointInput.trim()) {
    throw new Error('A point is required.');
  }

  const pointNumber = Number(pointInput.trim());

  if (
    !Number.isFinite(pointNumber) ||
    Math.abs(pointNumber) > 1000000
  ) {
    throw new Error('Enter a finite point within the supported range.');
  }

  const parser = new ExpressionParser();
  const normalizer = new ASTNormalizer();

  const ast = normalizer.normalize(
    parser.parse(expression)
  );

  if (!polynomial(ast, { nodes: 150 })) {
    throw new Error(
      'This version supports polynomials in x only.'
    );
  }

  const series = new LocalSeriesEngine().expand(
    ast,
    'x',
    pointNumber,
    1
  );

  if (!series || series.terms.length < 2) {
    throw new Error(
      'Exact value and slope could not be established at this point.'
    );
  }

  const a = series.center;
  const value = Rat.simplify(series.terms[0]);
  const slope = Rat.simplify(series.terms[1]);

  const tangent = line(a, value, slope);

  // A flat tangent has a vertical normal, not a finite slope.
  const normalSlope = Rat.isZero(slope)
    ? null
    : Rat.div(
        { num: -1n, den: 1n },
        slope
      );

  const normal = normalSlope
    ? line(a, value, normalSlope)
    : `x = ${latex(a)}`;

  const steps: MathStep[] = [
    {
      id: 'tangent_evaluate_point',
      title: 'Find the point on the curve',
      explanation:
        `At x = ${text(a)}, the exact value is ` +
        `f(x) = ${text(value)}.`
    },
    {
      id: 'tangent_find_slope',
      title: 'Find the tangent slope',
      explanation:
        `The exact derivative at x = ${text(a)} ` +
        `is f'(x) = ${text(slope)}. ` +
        'The slope is obtained from the first local ' +
        'polynomial coefficient.'
    },
    {
      id: 'tangent_construct_line',
      title: 'Tangent line',
      explanation:
        "Use y - f(a) = f'(a)(x-a). " +
        `Tangent: ${tangent}.`
    },
    {
      id: 'normal_construct_line',
      title: 'Normal line',
      explanation: normalSlope
        ? `The normal slope is ${text(normalSlope)}. ` +
          `Normal: ${normal}.`
        : `The tangent is horizontal, so the normal ` +
          `is vertical: ${normal}.`
    }
  ];

  return {
    status: 'computed',
    latex:
      String.raw`\begin{aligned}` +
      String.raw`\text{Tangent:}\;&` + tangent +
      String.raw`\\` +
      String.raw`\text{Normal:}\;&` + normal +
      String.raw`\end{aligned}`,
    method: 'exact_polynomial_tangent_normal',
    steps,
    warnings: [
      'This result uses an exact polynomial calculation ' +
      'at the specified point.'
    ]
  };
}
