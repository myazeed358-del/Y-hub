import { describe, expect, it } from 'vitest';
import { Rat } from '@/services/math/symbolic/series';
import {
  proveExactIntercepts
} from '../services/exactInterceptProof';

describe('Calculus 1 irrational intercepts V2', () => {
  it.each([
    ['x^2-2', '-2', [
      '-sqrt(2)', 'sqrt(2)'
    ]],
    ['-x^2+2', '2', [
      '-sqrt(2)', 'sqrt(2)'
    ]],
    ['x^2+2*x-1', '-1', [
      '-1-sqrt(2)', '-1+sqrt(2)'
    ]],
    ['x^2-2*x-1', '-1', [
      '1-sqrt(2)', '1+sqrt(2)'
    ]],
    ['x^2-3*x+1', '1', [
      '3/2-sqrt(5/4)', '3/2+sqrt(5/4)'
    ]],
    ['2*x^2-3', '-3', [
      '-sqrt(3/2)', 'sqrt(3/2)'
    ]],
    ['-2*x^2+3', '3', [
      '-sqrt(3/2)', 'sqrt(3/2)'
    ]],
    ['4*x^2+4*x-1', '-1', [
      '-1/2-sqrt(1/2)', '-1/2+sqrt(1/2)'
    ]],
    ['x^2-5*x+1', '1', [
      '5/2-sqrt(21/4)', '5/2+sqrt(21/4)'
    ]],
    ['0.5*x^2-1', '-1', [
      '-sqrt(2)', 'sqrt(2)'
    ]]
  ])(
    'proves irrational roots for %s',
    (expression, expectedY, roots) => {
      const result = proveExactIntercepts(expression);

      expect(result.status).toBe('verified');
      if (result.status !== 'verified') return;

      expect(result.scope).toBe(
        'real_polynomials_degree_0_to_2_exact_roots'
      );

      expect(result.yIntercept).toEqual({
        x: '0',
        y: expectedY
      });

      expect(result.xIntercepts).toEqual({
        kind: 'finite',
        roots
      });

      expect(result.steps.some(
        step => step.id === 'intercept_two_irrational_roots'
      )).toBe(true);
    }
  );

  it('independently checks exact radical identities', () => {
    const samples = [
      [1n, 0n, -2n],
      [1n, 2n, -1n],
      [-1n, 0n, 2n],
      [2n, 0n, -3n],
      [4n, 4n, -1n],
      [1n, -3n, 1n]
    ] as const;

    for (const [A, B, C] of samples) {
      const a = { num: A, den: 1n };
      const b = { num: B, den: 1n };
      const c = { num: C, den: 1n };

      const two = { num: 2n, den: 1n };
      const four = { num: 4n, den: 1n };
      const minusOne = { num: -1n, den: 1n };

      const m = Rat.div(
        Rat.mul(minusOne, b),
        Rat.mul(two, a)
      );

      const D = Rat.sub(
        Rat.mul(b, b),
        Rat.mul(four, Rat.mul(a, c))
      );

      const q = Rat.div(
        D,
        Rat.mul(four, Rat.mul(a, a))
      );

      const linearPart = Rat.add(
        Rat.mul(two, Rat.mul(a, m)),
        b
      );

      const constantPart = Rat.add(
        Rat.add(
          Rat.mul(a, Rat.mul(m, m)),
          Rat.mul(b, m)
        ),
        Rat.add(c, Rat.mul(a, q))
      );

      expect(Rat.isZero(linearPart)).toBe(true);
      expect(Rat.isZero(constantPart)).toBe(true);
      expect(q.num > 0n).toBe(true);
    }
  });

  it.each([
    'sqrt(x)',
    '1/x',
    '(x^2-1)/(x-1)',
    'x^3-2',
    'x^4-2',
    'x^2+y',
    'x^x',
    ''
  ])(
    'rejects unsupported inputs: %s',
    expression => {
      expect(proveExactIntercepts(expression).status)
        .toBe('unsupported');
    }
  );

  it('preserves rational and repeated roots', () => {
    const rational = proveExactIntercepts('x^2-4');
    const repeated = proveExactIntercepts(
      'x^2-2*x+1'
    );

    expect(rational.status).toBe('verified');
    expect(repeated.status).toBe('verified');

    if (
      rational.status !== 'verified' ||
      repeated.status !== 'verified'
    ) return;

    expect(rational.xIntercepts).toEqual({
      kind: 'finite',
      roots: ['-2', '2']
    });

    expect(repeated.xIntercepts).toEqual({
      kind: 'finite',
      roots: ['1']
    });
  });
});
