import { describe, expect, it } from 'vitest';
import { proveExactDomain } from '../services/exactDomainProof';

describe('Exact irrational quadratic domain proof', () => {
  it.each([
    ['sqrt(x^2-2)', 2, true],
    ['ln(x^2-3)', 2, false],
    ['1/(x^2-2)', 3, false],
    ['sqrt(2-x^2)', 1, true],
    ['ln(2-x^2)', 1, false],
    ['sqrt((x-1)^2-2)', 2, true],
    ['sqrt(2-(x-1)^2)', 1, true],
    ['sqrt(2*x^2-3)', 2, true]
  ])(
    'certifies irrational roots: %s',
    (expression, count, closed) => {
      const result = proveExactDomain(expression);

      expect(result.status).toBe('verified');
      if (result.status !== 'verified') return;

      expect(result.intervals).toHaveLength(count);
      expect(result.domain.join(' ')).toContain('sqrt(');

      const algebraicBoundaries = result.intervals
        .flatMap(item => [
          { endpoint: item.left, closed: item.leftClosed },
          { endpoint: item.right, closed: item.rightClosed }
        ])
        .filter(item =>
          item.endpoint.type === 'value' &&
          item.endpoint.algebraic?.degree === 2
        );

      expect(algebraicBoundaries.length).toBeGreaterThan(0);

      expect(
        algebraicBoundaries.every(
          item => item.closed === closed
        )
      ).toBe(true);
    }
  );

  it.each([
    'sqrt(x^2-2)/(x-3)',
    'sqrt(x^2-2)+ln(x+3)',
    'x^x',
    '1/(x^3-2)'
  ])('rejects unproved combinations: %s', expression => {
    expect(proveExactDomain(expression).status)
      .toBe('unsupported');
  });
});
