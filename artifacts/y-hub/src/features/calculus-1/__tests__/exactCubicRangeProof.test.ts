import { describe, expect, it } from 'vitest';
import {
  proveCubicMonotonicity
} from '../services/cubicMonotonicityProof';
import {
  proveExactRange
} from '../services/exactRangeProof';

describe('Calculus 1 exact cubic range v2', () => {
  it.each([
    'x^3',
    '-x^3',
    'x^3+x',
    'x^3-3*x',
    '-x^3+3*x',
    '2*x^3-6*x',
    'x^3+3*x^2+3*x+1'
  ])('proves cubic surjectivity: %s', expression => {
    const certificate = proveCubicMonotonicity(expression);
    expect(certificate.status).toBe('verified');

    const result = proveExactRange(expression);

    expect(result.status).toBe('verified');
    if (result.status !== 'verified') return;

    expect(result.scope)
      .toBe('verified_rational_cubic_surjectivity');

    expect(result.range).toEqual([
      '(-infinity, +infinity)'
    ]);

    expect(result.intervals).toHaveLength(1);
    expect(result.intervals[0].left)
      .toEqual({ type: 'infinity', sign: -1 });
    expect(result.intervals[0].right)
      .toEqual({ type: 'infinity', sign: 1 });

    expect(result.steps.some(step =>
      step.id === 'range_cubic_intermediate_value'
    )).toBe(true);
  });

  it.each([
    'sqrt(x)',
    '1/x',
    'x^3+y',
    'x^3=1'
  ])('does not certify outside this scope: %s', expression => {
    expect(proveExactRange(expression).status)
      .toBe('unsupported');
  });

  it('preserves exact quadratic range proof', () => {
    const result = proveExactRange('x^2-4*x+1');

    expect(result.status).toBe('verified');
    if (result.status !== 'verified') return;

    expect(result.scope)
      .toBe('real_polynomials_degree_0_to_2');
    expect(result.range).toEqual(['[-3, +infinity)']);
  });
});
