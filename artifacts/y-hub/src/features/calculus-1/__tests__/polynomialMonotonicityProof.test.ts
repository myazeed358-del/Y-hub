import { describe, expect, it } from 'vitest';
import {
  provePolynomialMonotonicity as prove
} from '../services/polynomialMonotonicityProof';

describe('Exact polynomial monotonicity proof', () => {
  it('proves a quadratic minimum and both sign intervals', () => {
    const result = prove('x^2-4*x+1');

    expect(result.status).toBe('verified');

    if (result.status !== 'verified') return;

    expect(result.criticalPoints).toEqual(['2']);
    expect(result.increasingIntervals).toEqual([
      '(2, +infinity)'
    ]);
    expect(result.decreasingIntervals).toEqual([
      '(-infinity, 2)'
    ]);
    expect(result.extrema).toEqual([{
      type: 'global_minimum',
      x: '2',
      y: '-3'
    }]);
  });

  it('proves a quadratic maximum', () => {
    const result = prove('-x^2+4*x+1');

    expect(result.status).toBe('verified');

    if (result.status !== 'verified') return;

    expect(result.extrema).toEqual([{
      type: 'global_maximum',
      x: '2',
      y: '5'
    }]);
    expect(result.increasingIntervals).toEqual([
      '(-infinity, 2)'
    ]);
  });

  it('preserves an exact fractional vertex', () => {
    const result = prove('x^2+x+1');

    expect(result.status).toBe('verified');

    if (result.status !== 'verified') return;

    expect(result.criticalPoints).toEqual(['-1/2']);
    expect(result.extrema[0].y).toBe('3/4');
  });

  it('proves increasing linear functions', () => {
    const result = prove('3*x+2');

    expect(result.status).toBe('verified');

    if (result.status !== 'verified') return;

    expect(result.degree).toBe(1);
    expect(result.criticalPoints).toEqual([]);
    expect(result.extrema).toEqual([]);
    expect(result.increasingIntervals).toEqual([
      '(-infinity, +infinity)'
    ]);
  });

  it('proves decreasing linear functions', () => {
    const result = prove('-2*x+1');

    expect(result.status).toBe('verified');

    if (result.status !== 'verified') return;

    expect(result.decreasingIntervals).toEqual([
      '(-infinity, +infinity)'
    ]);
  });

  it('recognizes cancellation to a linear function', () => {
    const result = prove('x^2-x^2+3*x');

    expect(result.status).toBe('verified');

    if (result.status !== 'verified') return;

    expect(result.degree).toBe(1);
  });

  it.each([
    'x^3',
    'sin(x)',
    '1/x',
    'abs(x)',
    'x^2+y',
    'x^2=4',
    '7'
  ])('does not fabricate proof for %s', expression => {
    expect(prove(expression).status).toBe('unsupported');
  });
});
