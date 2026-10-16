import { describe, expect, it } from 'vitest';
import { proveExactDomain } from '../services/exactDomainProof';

describe('Calculus 1 exact quadratic domains', () => {
  it.each([
    ['1/(x^2-4)', [
      '(-infinity, -2)',
      '(-2, 2)',
      '(2, +infinity)'
    ]],
    ['sqrt(x^2-4)', [
      '(-infinity, -2]',
      '[2, +infinity)'
    ]],
    ['sqrt(4-x^2)', ['[-2, 2]']],
    ['ln(x^2-1)', [
      '(-infinity, -1)',
      '(1, +infinity)'
    ]],
    ['1/(x^2+1)', ['(-infinity, +infinity)']],
    ['1/(x^2)', [
      '(-infinity, 0)',
      '(0, +infinity)'
    ]],
    ['sqrt(-x^2)', ['[0, 0]']],
    ['sqrt((x-2)^2)', ['(-infinity, +infinity)']],
    ['ln((x-2)^2)', [
      '(-infinity, 2)',
      '(2, +infinity)'
    ]],
    ['1/(x^2+2*x+1)', [
      '(-infinity, -1)',
      '(-1, +infinity)'
    ]],
    ['sqrt(x^2-4)/(x-3)', [
      '(-infinity, -2]',
      '[2, 3)',
      '(3, +infinity)'
    ]],
    ['sqrt(x^2-4)+ln(9-x^2)', [
      '(-3, -2]',
      '[2, 3)'
    ]],
    ['sqrt(-x^2-1)', ['empty set']],
    ['sqrt(x^2-2*x+2)', [
      '(-infinity, +infinity)'
    ]],
    ['ln(-x^2)', ['empty set']],
    ['ln(4-x^2)', ['(-2, 2)']],
    ['sqrt((x^2-4)/2)', [
      '(-infinity, -2]',
      '[2, +infinity)'
    ]]
  ])('proves domain of %s', (expression, domain) => {
    const result = proveExactDomain(expression);

    expect(result.status).toBe('verified');
    if (result.status !== 'verified') return;

    expect(result.domain).toEqual(domain);
  });

  it.each([
    'sqrt(x^3-1)',
    '1/(x^3-1)',
    'sqrt(sin(x))',
    'x^x'
  ])('rejects an unproved case: %s', expression => {
    expect(proveExactDomain(expression).status)
      .toBe('unsupported');
  });
});
