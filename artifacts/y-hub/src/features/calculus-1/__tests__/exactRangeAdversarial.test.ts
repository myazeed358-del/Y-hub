import { describe, expect, it } from 'vitest';
import * as math from 'mathjs';
import type { Endpoint, Interval } from '@/services/math/types/set';
import { proveExactRange } from '../services/exactRangeProof';

function value(endpoint: Endpoint): number {
  if (endpoint.type === 'infinity') {
    return endpoint.sign === 1 ? Infinity : -Infinity;
  }

  if (endpoint.rational) {
    return Number(endpoint.rational.num) /
      Number(endpoint.rational.den);
  }

  throw new Error('Expected exact rational endpoint');
}

function contains(interval: Interval, y: number): boolean {
  const lo = value(interval.left);
  const hi = value(interval.right);
  const tolerance = 1e-8;

  const above = y > lo - tolerance &&
    (interval.leftClosed || y > lo + tolerance);

  const below = y < hi + tolerance &&
    (interval.rightClosed || y < hi - tolerance);

  return above && below;
}

const expressions = [
  'x^2',
  '-x^2',
  'x^2+x',
  'x^2-4*x+1',
  '-x^2+4*x-1',
  '2*x^2+4*x+7',
  '-3*x^2+2*x-5',
  '0.5*x^2+0.5*x+1',
  '(x-2)^2+3',
  '(x+1)*(x-1)',
  '(-2)*(x-1)*(x+1)',
  '(x^2+1)/2',
  'x*x',
  '3*x-1',
  '-2*x+5',
  '0*x+4',
  '7'
];

function evaluate(expression: string, x: number): number {
  const result: unknown = math.evaluate(expression, { x });

  if (typeof result !== 'number' ||
      !Number.isFinite(result)) {
    throw new Error('Independent evaluation failed');
  }

  return result;
}

describe('Independent exact range verification', () => {
  it.each(expressions)(
    'checks coefficients and attainable outputs: %s',
    expression => {
      const result = proveExactRange(expression);

      expect(result.status).toBe('verified');
      if (result.status !== 'verified') return;

      expect(result.intervals).toHaveLength(1);

      const interval = result.intervals[0];

      // Reconstruct coefficients independently from
      // function values at -1, 0, 1.
      const fMinus = evaluate(expression, -1);
      const fZero = evaluate(expression, 0);
      const fPlus = evaluate(expression, 1);

      const a = (fPlus + fMinus - 2 * fZero) / 2;
      const b = (fPlus - fMinus) / 2;
      const c = fZero;

      if (Math.abs(a) > 1e-10) {
        const vertexX = -b / (2 * a);
        const vertexY = evaluate(expression, vertexX);

        const endpoint = a > 0
          ? interval.left
          : interval.right;

        expect(value(endpoint)).toBeCloseTo(vertexY, 9);

        if (a > 0) {
          expect(interval.leftClosed).toBe(true);
          expect(value(interval.right)).toBe(Infinity);
          expect(contains(interval, vertexY - 1)).toBe(false);
        } else {
          expect(interval.rightClosed).toBe(true);
          expect(value(interval.left)).toBe(-Infinity);
          expect(contains(interval, vertexY + 1)).toBe(false);
        }

        expect(contains(interval, vertexY)).toBe(true);
      } else if (Math.abs(b) > 1e-10) {
        expect(value(interval.left)).toBe(-Infinity);
        expect(value(interval.right)).toBe(Infinity);
      } else {
        expect(value(interval.left)).toBeCloseTo(c, 9);
        expect(value(interval.right)).toBeCloseTo(c, 9);
        expect(interval.leftClosed).toBe(true);
        expect(interval.rightClosed).toBe(true);
        expect(contains(interval, c + 1)).toBe(false);
      }

      for (const x of [-5, -2, -1, 0, 0.5, 1, 2, 5]) {
        const y = evaluate(expression, x);

        expect(
          contains(interval, y),
          `Range excluded f(${x})=${y}`
        ).toBe(true);
      }
    }
  );

  it.each([
    'sqrt(x)',
    'sin(x)',
    'log(x)',
    '1/x',
    '1/(x^2-4)',
    '(x^2-4)/(x-2)',
    'x^2+sin(x)',
    'x^2+y',
    'x^2=4',
    'x^(-1)'
  ])('never certifies an unsupported function: %s', expression => {
    expect(proveExactRange(expression).status)
      .toBe('unsupported');
  });
});
