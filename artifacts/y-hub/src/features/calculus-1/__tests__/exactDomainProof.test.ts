import { describe, expect, it } from 'vitest';
import { proveExactDomain } from '../services/exactDomainProof';

describe('Calculus 1 exact real-domain proof v1', () => {
  it.each([
    ['x^2+3*x+1', ['(-infinity, +infinity)']],
    ['x^4-4*x^2+1', ['(-infinity, +infinity)']],
    ['sin(x)', ['(-infinity, +infinity)']],
    ['exp(x)', ['(-infinity, +infinity)']],
    ['1/(x-2)', [
      '(-infinity, 2)', '(2, +infinity)'
    ]],
    ['sqrt(x-3)', ['[3, +infinity)']],
    ['ln(x+2)', ['(-2, +infinity)']],
    ['sqrt(x-3)/(x-5)', [
      '[3, 5)', '(5, +infinity)'
    ]],
    ['ln(x-2)+sqrt(x+1)', ['(2, +infinity)']],
    ['sqrt(3-x)', ['(-infinity, 3]']],
    ['sqrt(x-3)+ln(5-x)', ['[3, 5)']],
    ['(x-2)/(x-2)', [
      '(-infinity, 2)', '(2, +infinity)'
    ]],
    ['sqrt(-1)', ['empty set']],
    ['1/0', ['empty set']]
  ])('certifies the domain of %s', (expression, expected) => {
    const result = proveExactDomain(expression);

    expect(result.status).toBe('verified');

    if (result.status !== 'verified') return;

    expect(result.domain).toEqual(expected);
    expect(result.steps.length).toBeGreaterThan(0);
  });

  it.each([
    'x^x',
    'tan(x)',
    'asin(x)',
    'ln((x+1)/(x-1))',
    'x^(-1)',
    'x+y',
    'x^2=4'
  ])('does not certify unsupported input %s', expression => {
    const result = proveExactDomain(expression);

    expect(result.status).toBe('unsupported');
  });
});
