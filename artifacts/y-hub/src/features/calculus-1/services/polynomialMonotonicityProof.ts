import { ExpressionParser } from '@/services/math/parser';
import { ASTNormalizer } from '@/services/math/parser/normalizer';
import {
  LocalSeriesEngine,
  Rat,
  type Rational
} from '@/services/math/symbolic/series';
import type { CanonicalAST } from '@/services/math/types/ast';
import type { MathStep } from '@/services/math/types/step';

export type PolynomialMonotonicityProof =
  | {
      status: 'verified';
      scope: 'rational_polynomial_degree_at_most_2';
      degree: 1 | 2;
      criticalPoints: string[];
      increasingIntervals: string[];
      decreasingIntervals: string[];
      extrema: Array<{
        type: 'global_minimum' | 'global_maximum';
        x: string;
        y: string;
      }>;
      steps: MathStep[];
    }
  | {
      status: 'unsupported';
      reason: string;
    };

function degree(
  node: CanonicalAST,
  budget: { remaining: number }
): number | null {
  budget.remaining--;

  if (budget.remaining < 0) return null;

  if (node.type === 'Number') {
    return /^-?\d+(?:\.\d{1,6})?$/.test(node.value) &&
      Math.abs(Number(node.value)) <= 1000000
      ? 0
      : null;
  }

  if (node.type === 'Symbol') {
    return node.name === 'x' ? 1 : null;
  }

  if (node.type === 'Parenthesis') {
    return degree(node.content, budget);
  }

  if (node.type !== 'Operator') return null;

  if (node.operator === '^') {
    if (node.args.length !== 2) return null;

    const exponent = node.args[1];

    if (
      exponent.type !== 'Number' ||
      !/^\d+$/.test(exponent.value) ||
      Number(exponent.value) > 2
    ) {
      return null;
    }

    const baseDegree = degree(node.args[0], budget);

    if (baseDegree === null) return null;

    const result = baseDegree * Number(exponent.value);

    return result <= 2 ? result : null;
  }

  if (
    !['+', '-', '*', 'implicit_multiply']
      .includes(node.operator)
  ) {
    return null;
  }

  if (
    node.args.length === 0 ||
    (
      node.operator === '-' &&
      node.args.length > 2
    )
  ) {
    return null;
  }

  const childDegrees = node.args.map(arg =>
    degree(arg, budget)
  );

  if (childDegrees.some(item => item === null)) {
    return null;
  }

  const values = childDegrees as number[];

  const result =
    node.operator === '*' ||
    node.operator === 'implicit_multiply'
      ? values.reduce((sum, item) => sum + item, 0)
      : Math.max(...values);

  return result <= 2 ? result : null;
}

function display(value: Rational): string {
  const normalized = Rat.simplify(value);

  return normalized.den === 1n
    ? normalized.num.toString()
    : `${normalized.num}/${normalized.den}`;
}

function interval(
  left: string,
  right: string
): string {
  return `(${left}, ${right})`;
}

export function provePolynomialMonotonicity(
  expression: string
): PolynomialMonotonicityProof {
  if (!expression.trim()) {
    return {
      status: 'unsupported',
      reason: 'A function is required.'
    };
  }

  const parser = new ExpressionParser();
  const normalizer = new ASTNormalizer();

  const ast = normalizer.normalize(
    parser.parse(expression)
  );

  const structuralDegree = degree(
    ast,
    { remaining: 150 }
  );

  if (structuralDegree === null) {
    return {
      status: 'unsupported',
      reason:
        'Exact proof currently supports rational polynomials ' +
        'of degree at most two.'
    };
  }

  const series = new LocalSeriesEngine().expand(
    ast,
    'x',
    0,
    2
  );

  if (!series || series.terms.length !== 3) {
    return {
      status: 'unsupported',
      reason: 'Exact polynomial coefficients are unavailable.'
    };
  }

  const [c, b, a] = series.terms.map(
    coefficient => Rat.simplify(coefficient)
  );

  // Constant functions have infinitely many stationary
  // points and require a separate result contract.
  if (Rat.isZero(a) && Rat.isZero(b)) {
    return {
      status: 'unsupported',
      reason:
        'Constant functions require separate stationary-point handling.'
    };
  }

  if (Rat.isZero(a)) {
    const increasing = b.num > 0n;

    return {
      status: 'verified',
      scope: 'rational_polynomial_degree_at_most_2',
      degree: 1,
      criticalPoints: [],
      increasingIntervals: increasing
        ? [interval('-infinity', '+infinity')]
        : [],
      decreasingIntervals: increasing
        ? []
        : [interval('-infinity', '+infinity')],
      extrema: [],
      steps: [
        {
          id: 'exact_linear_coefficients',
          title: 'Extract exact polynomial coefficients',
          explanation:
            `f(x) = (${display(b)})x + (${display(c)}).`
        },
        {
          id: 'exact_linear_derivative_sign',
          title: 'Prove the derivative sign',
          explanation:
            `f'(x) = ${display(b)} is ` +
            `${increasing ? 'positive' : 'negative'} for every real x.`
        },
        {
          id: 'exact_linear_monotonicity',
          title: 'Establish global monotonicity',
          explanation:
            `The function is strictly ` +
            `${increasing ? 'increasing' : 'decreasing'} ` +
            'on the real line and has no extrema.'
        }
      ]
    };
  }

  const twoA = Rat.mul(
    { num: 2n, den: 1n },
    a
  );

  const negativeB = {
    num: -b.num,
    den: b.den
  };

  const vertexX = Rat.div(
    negativeB,
    twoA
  );

  const vertexY = Rat.add(
    Rat.add(
      Rat.mul(a, Rat.mul(vertexX, vertexX)),
      Rat.mul(b, vertexX)
    ),
    c
  );

  const x = display(vertexX);
  const y = display(vertexY);
  const opensUp = a.num > 0n;

  return {
    status: 'verified',
    scope: 'rational_polynomial_degree_at_most_2',
    degree: 2,
    criticalPoints: [x],
    increasingIntervals: opensUp
      ? [interval(x, '+infinity')]
      : [interval('-infinity', x)],
    decreasingIntervals: opensUp
      ? [interval('-infinity', x)]
      : [interval(x, '+infinity')],
    extrema: [
      {
        type: opensUp
          ? 'global_minimum'
          : 'global_maximum',
        x,
        y
      }
    ],
    steps: [
      {
        id: 'exact_quadratic_coefficients',
        title: 'Extract exact polynomial coefficients',
        explanation:
          `f(x) = (${display(a)})x^2 + ` +
          `(${display(b)})x + (${display(c)}).`
      },
      {
        id: 'exact_quadratic_critical_point',
        title: 'Find the unique critical point',
        explanation:
          `f'(x) = 2(${display(a)})x + (${display(b)}). ` +
          `Solving f'(x)=0 gives x = ${x}.`
      },
      {
        id: 'exact_quadratic_sign_chart',
        title: 'Prove the derivative sign on both sides',
        explanation:
          `f'(x) = 2(${display(a)})(x - (${x})). ` +
          (opensUp
            ? 'It is negative to the left and positive to the right.'
            : 'It is positive to the left and negative to the right.')
      },
      {
        id: 'exact_quadratic_extremum',
        title: 'Establish the global extremum',
        explanation:
          `Completing the square gives ` +
          `f(x) = (${display(a)})(x - (${x}))^2 + (${y}). ` +
          `Therefore (${x}, ${y}) is the global ` +
          `${opensUp ? 'minimum' : 'maximum'}.`
      }
    ]
  };
}
