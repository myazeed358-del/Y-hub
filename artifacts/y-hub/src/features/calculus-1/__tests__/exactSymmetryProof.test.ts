import { describe, expect, it } from 'vitest';
import {
  proveExactSymmetry
} from '../services/exactSymmetryProof';

describe('Calculus 1 exact symmetry proof V1', () => {
  it.each([
    ['x^2', 'even'],
    ['-x^2', 'even'],
    ['x^2+1', 'even'],
    ['2*x^2-3', 'even'],
    ['0.5*x^2+7', 'even'],
    ['7', 'even'],
    ['-4', 'even'],
    ['x', 'odd'],
    ['-x', 'odd'],
    ['3*x', 'odd'],
    ['0.5*x', 'odd'],
    ['0', 'both'],
    ['0*x+0', 'both'],
    ['x^2+x', 'neither'],
    ['x^2+x+1', 'neither'],
    ['x+1', 'neither'],
    ['-2*x^2+3*x-1', 'neither']
  ] as const)(
    'proves symmetry for %s',
    (expression, expected) => {
      const result = proveExactSymmetry(expression);

      expect(result.status).toBe('verified');
      if (result.status !== 'verified') return;

      expect(result.symmetry).toBe(expected);
      expect(result.even).toBe(
        expected === 'even' || expected === 'both'
      );
      expect(result.odd).toBe(
        expected === 'odd' || expected === 'both'
      );
      expect(result.steps).toHaveLength(5);
    }
  );

  it(
    'independently checks all 343 integer coefficient triples',
    () => {
      let checked = 0;

      for (let a = -3; a <= 3; a++) {
        for (let b = -3; b <= 3; b++) {
          for (let c = -3; c <= 3; c++) {
            const expression =
              `(${a})*x^2+(${b})*x+(${c})`;

            const result = proveExactSymmetry(expression);

            expect(
              result.status,
              `Expected verification for ${expression}`
            ).toBe('verified');

            if (result.status !== 'verified') continue;

            const even = b === 0;
            const odd = a === 0 && c === 0;

            expect(result.even).toBe(even);
            expect(result.odd).toBe(odd);

            expect(result.symmetry).toBe(
              even && odd
                ? 'both'
                : even
                  ? 'even'
                  : odd
                    ? 'odd'
                    : 'neither'
            );

            checked++;
          }
        }
      }

      expect(checked).toBe(343);
    }
  );

  it.each([
    'x^3',
    'x^4',
    'sin(x)',
    'cos(x)',
    'abs(x)',
    'sqrt(x)',
    '1/x',
    'x^2+y',
    'x^2=1',
    'x^x',
    ''
  ])('refuses unsupported symmetry: %s', expression => {
    expect(proveExactSymmetry(expression).status)
      .toBe('unsupported');
  });

  it('explains why x^2+x is neither even nor odd', () => {
    const result = proveExactSymmetry('x^2+x');

    expect(result.status).toBe('verified');
    if (result.status !== 'verified') return;

    expect(result.symmetry).toBe('neither');

    expect(result.steps.some(
      step => step.id === 'symmetry_even_identity'
    )).toBe(true);

    expect(result.steps.some(
      step => step.id === 'symmetry_odd_identity'
    )).toBe(true);
  });
});
