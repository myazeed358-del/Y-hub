import type { CanonicalAST } from '@/services/math/types/ast';
import {
  LocalSeriesEngine,
  Rat,
  type Rational
} from '@/services/math/symbolic/series';

export type AbsoluteValueZeroProof =
  | {
      status: 'proved_differentiable';
      point: 0;
      derivative: string;
      method: 'exact_polynomial_local_coefficients';
      explanation: string;
    }
  | {
      status: 'proved_not_differentiable';
      point: 0;
      leftDerivative: string;
      rightDerivative: string;
      method: 'exact_polynomial_local_coefficients';
      explanation: string;
    }
  | {
      status: 'not_proven';
      point: 0;
      reason: string;
    };

function safePolynomial(
  node: CanonicalAST,
  variable: string,
  budget: { remaining: number }
): boolean {
  budget.remaining -= 1;
  if (budget.remaining < 0) return false;

  if (node.type === 'Number') {
    if (!/^-?\d+$/.test(node.value)) return false;
    return Number.isSafeInteger(Number(node.value));
  }

  if (node.type === 'Symbol') {
    return node.name === variable;
  }

  if (node.type === 'Parenthesis') {
    return safePolynomial(node.content, variable, budget);
  }

  if (node.type !== 'Operator') return false;

  if (node.operator === '^') {
    if (node.args.length !== 2) return false;

    const exponent = node.args[1];

    return exponent.type === 'Number' &&
      /^\d+$/.test(exponent.value) &&
      Number(exponent.value) <= 12 &&
      safePolynomial(node.args[0], variable, budget);
  }

  if (node.operator === '-') {
    if (node.args.length < 1 || node.args.length > 2) {
      return false;
    }
  } else if (
    node.operator !== '+' &&
    node.operator !== '*' &&
    node.operator !== 'implicit_multiply'
  ) {
    return false;
  }

  return node.args.length > 0 &&
    node.args.every(arg =>
      safePolynomial(arg, variable, budget)
    );
}

function asText(value: Rational): string {
  const rational = Rat.simplify(value);

  return rational.den === 1n
    ? rational.num.toString()
    : `${rational.num}/${rational.den}`;
}

export function proveAbsoluteValueAtZero(
  original: CanonicalAST,
  variable: string
): AbsoluteValueZeroProof {
  const unsupported = (
    reason: string
  ): AbsoluteValueZeroProof => ({
    status: 'not_proven',
    point: 0,
    reason
  });

  if (
    original.type !== 'Function' ||
    original.name !== 'abs' ||
    original.args.length !== 1
  ) {
    return unsupported(
      'Only explicit abs(g(x)) is supported.'
    );
  }

  const inner = original.args[0];

  if (!safePolynomial(
    inner,
    variable,
    { remaining: 100 }
  )) {
    return unsupported(
      'The inner expression is outside the exact polynomial scope.'
    );
  }

  let coefficients: Rational[];

  try {
    const expansion = new LocalSeriesEngine().expand(
      inner,
      variable,
      0,
      1
    );

    if (!expansion || expansion.terms.length < 2) {
      return unsupported(
        'Exact local coefficients are unavailable.'
      );
    }

    coefficients = expansion.terms;
  } catch {
    return unsupported(
      'The polynomial expansion could not be established.'
    );
  }

  const value = Rat.simplify(coefficients[0]);
  const slope = Rat.simplify(coefficients[1]);

  // A nonzero value keeps its sign near this point.
  if (!Rat.isZero(value)) {
    const sign = value.num > 0n ? 1n : -1n;
    const derivative = Rat.mul(
      slope,
      { num: sign, den: 1n }
    );

    return {
      status: 'proved_differentiable',
      point: 0,
      derivative: asText(derivative),
      method: 'exact_polynomial_local_coefficients',
      explanation:
        'The polynomial is nonzero at zero. By continuity, its sign ' +
        'is constant nearby, so the absolute value is locally ' +
        'the polynomial or its negative.'
    };
  }

  if (Rat.isZero(slope)) {
    return {
      status: 'proved_differentiable',
      point: 0,
      derivative: '0',
      method: 'exact_polynomial_local_coefficients',
      explanation:
        'The polynomial and its first derivative vanish at zero. ' +
        'Therefore the absolute-value difference quotient tends to zero.'
    };
  }

  const magnitude: Rational = {
    num: slope.num < 0n ? -slope.num : slope.num,
    den: slope.den
  };

  return {
    status: 'proved_not_differentiable',
    point: 0,
    leftDerivative: asText({
      num: -magnitude.num,
      den: magnitude.den
    }),
    rightDerivative: asText(magnitude),
    method: 'exact_polynomial_local_coefficients',
    explanation:
      'The polynomial has a simple zero at zero. The one-sided ' +
      'derivatives of its absolute value are different.'
  };
}
