import { describe, expect, it } from 'vitest';
import * as math from 'mathjs';
import { ASTUtils } from '@/services/math/symbolic/utils';
import { Rat, type Rational } from '@/services/math/symbolic/series';
import type { Endpoint } from '@/services/math/types/set';
import { proveExactDomain } from '../services/exactDomainProof';

function numeric(endpoint: Endpoint): number {
  if (endpoint.type === 'infinity') {
    return endpoint.sign === -1
      ? -Infinity
      : Infinity;
  }

  const value = math.evaluate(
    ASTUtils.serialize(endpoint.ast)
  );

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('Non-real or non-finite endpoint');
  }

  return value;
}

function contains(
  intervals: Array<{
    left: Endpoint;
    right: Endpoint;
    leftClosed: boolean;
    rightClosed: boolean;
  }>,
  x: number
): boolean {
  return intervals.some(interval => {
    const left = numeric(interval.left);
    const right = numeric(interval.right);

    return (
      (x > left || (x === left && interval.leftClosed)) &&
      (x < right || (x === right && interval.rightClosed))
    );
  });
}

function evaluatePolynomial(
  coefficients: Rational[],
  x: Rational
): Rational {
  let value = Rat.zero;
  let power = Rat.one;

  for (const coefficient of coefficients) {
    value = Rat.add(
      value,
      Rat.mul(coefficient, power)
    );
    power = Rat.mul(power, x);
  }

  return value;
}

const probes: Array<{
  expression: string;
  inside: number[];
  outside: number[];
}> = [
  {
    expression: 'sqrt(x^2-2)',
    inside: [-3, -2, 2, 3],
    outside: [-1, 0, 1]
  },
  {
    expression: 'ln(x^2-3)',
    inside: [-3, -2, 2, 3],
    outside: [-1, 0, 1]
  },
  {
    expression: 'sqrt(2-x^2)',
    inside: [-1, 0, 1],
    outside: [-3, -2, 2, 3]
  },
  {
    expression: 'ln(2-x^2)',
    inside: [-1, 0, 1],
    outside: [-3, -2, 2, 3]
  },
  {
    expression: 'sqrt((x-1)^2-2)',
    inside: [-3, -2, 3, 4],
    outside: [0, 1, 2]
  },
  {
    expression: 'sqrt(2-(x-1)^2)',
    inside: [0, 1, 2],
    outside: [-2, -1, 3, 4]
  },
  {
    expression: 'sqrt(2*x^2-3)',
    inside: [-3, -2, 2, 3],
    outside: [-1, 0, 1]
  },
  {
    expression: 'sqrt(x^2-4)/(x-3)',
    inside: [-3, -2, 2, 4],
    outside: [-1, 0, 1, 3]
  },
  {
    expression: 'sqrt(x-3)/(x-5)',
    inside: [3, 4, 6, 7],
    outside: [-2, 0, 2, 5]
  },
  {
    expression: 'sqrt(x^2-4)+ln(9-x^2)',
    inside: [-2.5, -2, 2, 2.5],
    outside: [-4, -1, 0, 1, 4]
  }
];

describe('Exact domain adversarial verification', () => {
  it.each(probes)(
    'matches independent membership probes: $expression',
    ({ expression, inside, outside }) => {
      const result = proveExactDomain(expression);

      expect(result.status).toBe('verified');
      if (result.status !== 'verified') return;

      for (const x of inside) {
        expect(
          contains(result.intervals, x),
          `Expected ${x} inside ${expression}`
        ).toBe(true);
      }

      for (const x of outside) {
        expect(
          contains(result.intervals, x),
          `Expected ${x} outside ${expression}`
        ).toBe(false);
      }
    }
  );

  it.each([
    'sqrt(x^2-2)',
    'sqrt(2-x^2)',
    'sqrt((x-1)^2-2)',
    'ln(x^2-3)',
    '1/(x^2-2)'
  ])('checks certified irrational root metadata: %s', expression => {
    const result = proveExactDomain(expression);

    expect(result.status).toBe('verified');
    if (result.status !== 'verified') return;

    const algebraic = result.intervals
      .flatMap(interval => [interval.left, interval.right])
      .filter(
        (endpoint): endpoint is Extract<
          Endpoint, { type: 'value' }
        > => endpoint.type === 'value' &&
          endpoint.algebraic !== undefined
      );

    expect(algebraic.length).toBeGreaterThan(0);

    for (const endpoint of algebraic) {
      const data = endpoint.algebraic!;
      const root = numeric(endpoint);
      const low = Number(data.isolatingInterval.left.num) /
        Number(data.isolatingInterval.left.den);
      const high = Number(data.isolatingInterval.right.num) /
        Number(data.isolatingInterval.right.den);

      expect(low).toBeLessThan(root);
      expect(root).toBeLessThan(high);

      const atLow = evaluatePolynomial(
        data.polyCoeffsRat,
        data.isolatingInterval.left
      );
      const atHigh = evaluatePolynomial(
        data.polyCoeffsRat,
        data.isolatingInterval.right
      );

      // Opposite signs prove a root is bracketed
      // in these quadratic cases.
      expect(atLow.num * atHigh.num < 0n).toBe(true);

      const coefficients = data.polyCoeffsRat.map(
        coefficient =>
          Number(coefficient.num) / Number(coefficient.den)
      );

      const residual = coefficients.reduce(
        (sum, coefficient, index) =>
          sum + coefficient * root ** index,
        0
      );

      expect(Math.abs(residual)).toBeLessThan(1e-7);
    }
  });

  it.each([
    'sqrt(x^2-2)/(x-3)',
    'sqrt(x^2-2)+ln(x+3)',
    'sqrt(x^3-1)',
    'x^x',
    'sin(x)/cos(x)'
  ])('does not overclaim unsupported domains: %s', expression => {
    expect(proveExactDomain(expression).status)
      .toBe('unsupported');
  });
});
