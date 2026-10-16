import { describe, expect, it } from 'vitest';
import * as math from 'mathjs';
import type { Endpoint } from '@/services/math/types/set';
import { proveExactRange } from '../services/exactRangeProof';

function endpointNumber(endpoint: Endpoint): number {
  if (endpoint.type === 'infinity') {
    return endpoint.sign === 1 ? Infinity : -Infinity;
  }

  if (!endpoint.rational) {
    throw new Error('Expected an exact rational range bound');
  }

  return (
    Number(endpoint.rational.num) /
    Number(endpoint.rational.den)
  );
}

function evaluate(expression: string, x: number): number {
  const result: unknown = math.evaluate(expression, { x });

  if (typeof result !== 'number' ||
      !Number.isFinite(result)) {
    throw new Error('Independent evaluation failed');
  }

  return result;
}

const known: Array<[string, number, 'min' | 'max']> = [
  ['x^4', 0, 'min'],
  ['-x^4', 0, 'max'],
  ['x^4-2*x^2', -1, 'min'],
  ['-x^4+2*x^2', 1, 'max'],
  ['x^4-4*x^2+3', -1, 'min'],
  ['-x^4+4*x^2-3', 1, 'max'],
  ['x^4-2*x^2+1', 0, 'min'],
  ['(x^2-2)^2', 0, 'min'],
  ['x^4+2*x^2+1', 1, 'min'],
  ['-x^4-2*x^2-1', -1, 'max'],
  ['3*x^4+4*x^3-12*x^2', -32, 'min'],
  ['-3*x^4-4*x^3+12*x^2', 32, 'max']
];

const probes = [
  -6, -4, -3, -2, -1.5, -1, -0.5,
  0, 0.5, 1, 1.5, 2, 3, 4, 6
];

describe('Independent quartic range hardening', () => {
  it.each(known)(
    'checks independently evaluated outputs for %s',
    (expression, expected, direction) => {
      const proof = proveExactRange(expression);

      expect(proof.status).toBe('verified');
      if (proof.status !== 'verified') return;

      expect(proof.scope)
        .toBe('verified_quartic_global_range');

      expect(proof.intervals).toHaveLength(1);

      const interval = proof.intervals[0];

      const bound = direction === 'min'
        ? endpointNumber(interval.left)
        : endpointNumber(interval.right);

      expect(bound).toBe(expected);

      if (direction === 'min') {
        expect(interval.leftClosed).toBe(true);
        expect(endpointNumber(interval.right)).toBe(Infinity);
      } else {
        expect(interval.rightClosed).toBe(true);
        expect(endpointNumber(interval.left)).toBe(-Infinity);
      }

      for (const x of probes) {
        const y = evaluate(expression, x);

        if (direction === 'min') {
          expect(
            y >= bound - 1e-8,
            `f(${x})=${y} lies below certified minimum ${bound}`
          ).toBe(true);
        } else {
          expect(
            y <= bound + 1e-8,
            `f(${x})=${y} exceeds certified maximum ${bound}`
          ).toBe(true);
        }
      }
    }
  );

  it.each([
    ['x^4', 0, 0],
    ['x^4-2*x^2', 1, -1],
    ['x^4-4*x^2+3', Math.SQRT2, -1],
    ['-x^4+4*x^2-3', Math.SQRT2, 1],
    ['3*x^4+4*x^3-12*x^2', -2, -32],
    ['-3*x^4-4*x^3+12*x^2', -2, 32],
    ['(x^2-2)^2', Math.SQRT2, 0],
    ['x^4+2*x^2+1', 0, 1]
  ])(
    'checks an independently chosen attaining point: %s',
    (expression, x, expected) => {
      expect(evaluate(expression, x))
        .toBeCloseTo(expected, 8);

      const proof = proveExactRange(expression);
      expect(proof.status).toBe('verified');
    }
  );

  it.each([
    ['x^4+4*x^3+6*x^2+4*x+1', '[0, +infinity)'],
    ['x^4-4*x^3+6*x^2-4*x+1', '[0, +infinity)'],
    ['2*x^4-8*x^2+6', '[-2, +infinity)'],
    ['-2*x^4+8*x^2-6', '(-infinity, 2]']
  ])(
    'never certifies an incorrect transformed range: %s',
    (expression, expected) => {
      const proof = proveExactRange(expression);

      if (proof.status === 'verified') {
        expect(proof.range).toEqual([expected]);
      } else {
        expect(proof.status).toBe('unsupported');
      }
    }
  );

  it.each([
    'x^5',
    'x^6',
    '1/(x^4+1)',
    'sqrt(x^4)',
    'x^4+y',
    'x^4=1'
  ])(
    'rejects noncertified function classes: %s',
    expression => {
      expect(proveExactRange(expression).status)
        .toBe('unsupported');
    }
  );
});
