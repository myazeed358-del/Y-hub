import { describe, expect, it } from 'vitest';
import {
  proveEvenQuarticMonotonicity as prove
} from '../services/evenQuarticMonotonicityProof';

describe('Even quartic exact irrational-root proof', () => {
  it('proves all extrema of x^4-x^2', () => {
    const result = prove('x^4-x^2');

    expect(result.status).toBe('verified');
    if (result.status !== 'verified') return;

    expect(result.criticalPoints).toEqual([
      '-sqrt(1/2)', '0', 'sqrt(1/2)'
    ]);

    expect(result.increasingIntervals).toEqual([
      '(-sqrt(1/2), 0)',
      '(sqrt(1/2), +infinity)'
    ]);

    expect(result.decreasingIntervals).toEqual([
      '(-infinity, -sqrt(1/2))',
      '(0, sqrt(1/2))'
    ]);

    expect(result.extrema).toEqual([
      {
        type: 'local_minimum',
        x: '-sqrt(1/2)',
        y: '-1/4'
      },
      {
        type: 'local_maximum',
        x: '0',
        y: '0'
      },
      {
        type: 'local_minimum',
        x: 'sqrt(1/2)',
        y: '-1/4'
      }
    ]);
  });

  it('reverses the sign pattern for a negative quartic', () => {
    const result = prove('-x^4+x^2');

    expect(result.status).toBe('verified');
    if (result.status !== 'verified') return;

    expect(result.extrema.map(item => item.type)).toEqual([
      'local_maximum',
      'local_minimum',
      'local_maximum'
    ]);

    expect(result.extrema[0].y).toBe('1/4');
  });

  it('preserves exact fractional coefficients', () => {
    const result = prove('x^4-3*x^2+2');

    expect(result.status).toBe('verified');
    if (result.status !== 'verified') return;

    expect(result.criticalPoints).toEqual([
      '-sqrt(3/2)', '0', 'sqrt(3/2)'
    ]);

    expect(result.extrema[0].y).toBe('-1/4');
    expect(result.extrema[1].y).toBe('2');
  });

  it('supports nested polynomial expressions', () => {
    const result = prove('(x^2)^2-x^2');

    expect(result.status).toBe('verified');
    if (result.status !== 'verified') return;

    expect(result.criticalPoints).toHaveLength(3);
  });

  it.each([
    'x^4-2*x^2',
    'x^4+x^2',
    'x^4',
    'x^4-x^2+x',
    'x^4+x^3-x^2',
    'x^5',
    'x^3',
    'sin(x)',
    '1/x',
    'x^4+y',
    'x^4=1',
    'x^4-x^4+x^2'
  ])('does not certify unsupported input %s', expression => {
    expect(prove(expression).status).toBe('unsupported');
  });
});
