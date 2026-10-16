import { describe, expect, it } from 'vitest';
import {
  proveQuarticMonotonicity as prove
} from '../services/quarticMonotonicityProof';

describe('Exact quartic monotonicity proof', () => {
  it('proves three stationary points and their extrema', () => {
    const result = prove('x^4-2*x^2');

    expect(result.status).toBe('verified');
    if (result.status !== 'verified') return;

    expect(result.criticalPoints).toEqual([
      '-1', '0', '1'
    ]);

    expect(result.increasingIntervals).toEqual([
      '(-1, 0)',
      '(1, +infinity)'
    ]);

    expect(result.decreasingIntervals).toEqual([
      '(-infinity, -1)',
      '(0, 1)'
    ]);

    expect(result.extrema).toEqual([
      { type: 'local_minimum', x: '-1', y: '-1' },
      { type: 'local_maximum', x: '0', y: '0' },
      { type: 'local_minimum', x: '1', y: '-1' }
    ]);
  });

  it('proves a unique minimum when only one root is real', () => {
    const result = prove('x^4+x^2');

    expect(result.status).toBe('verified');
    if (result.status !== 'verified') return;

    expect(result.criticalPoints).toEqual(['0']);
    expect(result.extrema).toEqual([
      { type: 'local_minimum', x: '0', y: '0' }
    ]);
  });

  it('handles a triple derivative root', () => {
    const result = prove('x^4');

    expect(result.status).toBe('verified');
    if (result.status !== 'verified') return;

    expect(result.criticalPoints).toEqual(['0']);
    expect(result.extrema).toEqual([
      { type: 'local_minimum', x: '0', y: '0' }
    ]);
  });

  it('reverses signs for a negative quartic', () => {
    const result = prove('-x^4');

    expect(result.status).toBe('verified');
    if (result.status !== 'verified') return;

    expect(result.extrema).toEqual([
      { type: 'local_maximum', x: '0', y: '0' }
    ]);
  });

  it('does not invent an extremum at a double root', () => {
    const result = prove('x^4+x^3');

    expect(result.status).toBe('verified');
    if (result.status !== 'verified') return;

    expect(result.criticalPoints).toEqual([
      '-3/4', '0'
    ]);

    expect(result.extrema).toEqual([
      {
        type: 'local_minimum',
        x: '-3/4',
        y: '-27/256'
      }
    ]);

    expect(result.increasingIntervals).toEqual([
      '(-3/4, +infinity)'
    ]);
  });

  it('handles three distinct fractional or integer roots', () => {
    const result = prove('x^4+2*x^3+x^2');

    expect(result.status).toBe('verified');
    if (result.status !== 'verified') return;

    expect(result.criticalPoints).toEqual([
      '-1', '-1/2', '0'
    ]);
    expect(result.extrema).toHaveLength(3);
  });

  it('handles a shifted fourth power', () => {
    const result = prove('(x-1)^4');

    expect(result.status).toBe('verified');
    if (result.status !== 'verified') return;

    expect(result.criticalPoints).toEqual(['1']);
    expect(result.extrema).toEqual([
      { type: 'local_minimum', x: '1', y: '0' }
    ]);
  });

  it.each([
    'x^4-x^2',
    'x^4+x',
    'x^5',
    'x^3',
    'sin(x)',
    '1/x',
    'x^4+y',
    'x^4=1',
    'x^4-x^4+3*x'
  ])('refuses incomplete or invalid exact proofs for %s', expression => {
    expect(prove(expression).status).toBe('unsupported');
  });
});
