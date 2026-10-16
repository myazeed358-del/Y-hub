import { describe, expect, it } from 'vitest';
import {
  proveExactRange
} from '../services/exactRangeProof';

describe('Calculus 1 exact quartic range v3', () => {
  it.each([
    ['x^4', '[0, +infinity)'],
    ['-x^4', '(-infinity, 0]'],
    ['x^4-2*x^2', '[-1, +infinity)'],
    ['-x^4+2*x^2', '(-infinity, 1]'],
    ['x^4-4*x^2+3', '[-1, +infinity)'],
    ['-x^4+4*x^2-3', '(-infinity, 1]'],
    ['x^4-2*x^2+1', '[0, +infinity)'],
    ['(x^2-2)^2', '[0, +infinity)'],
    ['x^4+2*x^2+1', '[1, +infinity)'],
    ['-x^4-2*x^2-1', '(-infinity, -1]'],
    ['3*x^4+4*x^3-12*x^2', '[-32, +infinity)'],
    ['-3*x^4-4*x^3+12*x^2', '(-infinity, 32]']
  ])('proves exact global range for %s', (
    expression, expected
  ) => {
    const result = proveExactRange(expression);

    expect(result.status).toBe('verified');
    if (result.status !== 'verified') return;

    expect(result.scope)
      .toBe('verified_quartic_global_range');
    expect(result.range).toEqual([expected]);

    expect(result.steps.some(
      step => step.id === 'quartic_range_global_comparison'
    )).toBe(true);

    expect(result.steps.some(
      step => step.id === 'quartic_range_attainability'
    )).toBe(true);
  });

  it.each([
    'x^5',
    'x^6',
    '1/(x^4+1)',
    'sqrt(x^4)',
    'x^4+y',
    'x^4=1',
    'x^4+x'
  ])('does not claim unsupported range: %s', expression => {
    const result = proveExactRange(expression);
    expect(result.status).toBe('unsupported');
  });

  it('preserves previous cubic and quadratic proofs', () => {
    const cubic = proveExactRange('x^3-3*x');
    const quadratic = proveExactRange('x^2-4*x+1');

    expect(cubic.status).toBe('verified');
    expect(quadratic.status).toBe('verified');

    if (
      cubic.status !== 'verified' ||
      quadratic.status !== 'verified'
    ) return;

    expect(cubic.range).toEqual([
      '(-infinity, +infinity)'
    ]);

    expect(quadratic.range).toEqual([
      '[-3, +infinity)'
    ]);
  });
});
