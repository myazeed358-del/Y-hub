import { describe, expect, it } from 'vitest';
import {
  proveExactRange
} from '../services/exactRangeProof';

describe('Calculus 1 exact range proof v1', () => {
  it.each([
    ['x^2', ['[0, +infinity)']],
    ['-x^2', ['(-infinity, 0]']],
    ['x^2-4*x+1', ['[-3, +infinity)']],
    ['-x^2+4*x-1', ['(-infinity, 3]']],
    ['2*x^2+4*x+7', ['[5, +infinity)']],
    ['0.5*x^2+0.5*x+1', ['[7/8, +infinity)']],
    ['x^2+x', ['[-1/4, +infinity)']],
    ['x^2-2*x+1', ['[0, +infinity)']],
    ['x', ['(-infinity, +infinity)']],
    ['-3*x+1', ['(-infinity, +infinity)']],
    ['0*x+4', ['[4, 4]']],
    ['7', ['[7, 7]']],
    ['x*x', ['[0, +infinity)']],
    ['(x-2)^2+3', ['[3, +infinity)']],
    ['(x+1)*(x-1)', ['[-1, +infinity)']],
    ['(-2)*(x-1)*(x+1)', ['(-infinity, 2]']],
    ['(x^2+1)/2', ['[1/2, +infinity)']]
  ])('proves the range of %s', (expression, expected) => {
    const result = proveExactRange(expression);

    expect(result.status).toBe('verified');

    if (result.status !== 'verified') return;

    expect(result.range).toEqual(expected);
    expect(result.steps.length).toBeGreaterThan(0);
  });

  it.each([
    'sqrt(x)',
    'sin(x)',
    'ln(x)',
    '1/x',
    '1/(x^2+1)',
    'x^2+y',
    'x^2=1',
    'tan(x)',
    'x^x',
    ''
  ])('does not certify unsupported input: %s', expression => {
    expect(proveExactRange(expression).status)
      .toBe('unsupported');
  });

  it('distinguishes minima and maxima', () => {
    const min = proveExactRange('x^2');
    const max = proveExactRange('-x^2');

    expect(min.status).toBe('verified');
    expect(max.status).toBe('verified');

    if (min.status !== 'verified' ||
        max.status !== 'verified') return;

    expect(min.intervals[0].leftClosed).toBe(true);
    expect(max.intervals[0].rightClosed).toBe(true);

    expect(min.steps.some(
      step => step.explanation.includes('minimum')
    )).toBe(true);

    expect(max.steps.some(
      step => step.explanation.includes('maximum')
    )).toBe(true);
  });
});
