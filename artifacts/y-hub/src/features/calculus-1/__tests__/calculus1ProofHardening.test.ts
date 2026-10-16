import { describe, expect, it } from 'vitest';
import {
  proveQuarticMonotonicity
} from '../services/quarticMonotonicityProof';
import {
  proveEvenQuarticMonotonicity
} from '../services/evenQuarticMonotonicityProof';
import {
  proveQuarticConcavity
} from '../services/quarticConcavityProof';

describe('Calculus 1 independent mathematical hardening', () => {
  it('classifies all three extrema of a non-even quartic', () => {
    const result = proveQuarticMonotonicity(
      'x^4+4*x^3+4*x^2'
    );

    expect(result.status).toBe('verified');
    if (result.status !== 'verified') return;

    expect(result.criticalPoints).toEqual([
      '-2', '-1', '0'
    ]);

    expect(result.extrema).toEqual([
      { type: 'local_minimum', x: '-2', y: '0' },
      { type: 'local_maximum', x: '-1', y: '1' },
      { type: 'local_minimum', x: '0', y: '0' }
    ]);
  });

  it('does not classify a repeated f-second root as an inflection', () => {
    const result = proveQuarticConcavity(
      '(x+1)^4'
    );

    expect(result.status).toBe('verified');
    if (result.status !== 'verified') return;

    expect(result.inflectionPoints).toEqual([]);
    expect(result.concaveUpIntervals).toEqual([
      '(-infinity, +infinity)'
    ]);
    expect(result.concaveDownIntervals).toEqual([]);
  });

  it('preserves stationary roots after vertical translation', () => {
    const result = proveEvenQuarticMonotonicity(
      'x^4-x^2+7'
    );

    expect(result.status).toBe('verified');
    if (result.status !== 'verified') return;

    expect(result.criticalPoints).toEqual([
      '-sqrt(1/2)', '0', 'sqrt(1/2)'
    ]);

    expect(result.extrema).toEqual([
      {
        type: 'local_minimum',
        x: '-sqrt(1/2)',
        y: '27/4'
      },
      {
        type: 'local_maximum',
        x: '0',
        y: '7'
      },
      {
        type: 'local_minimum',
        x: 'sqrt(1/2)',
        y: '27/4'
      }
    ]);
  });

  it('preserves inflection x-coordinates after vertical translation', () => {
    const result = proveQuarticConcavity(
      'x^4-x^2+7'
    );

    expect(result.status).toBe('verified');
    if (result.status !== 'verified') return;

    expect(result.inflectionPoints).toEqual([
      {
        x: '-(1/24)*sqrt(96)',
        y: '247/36'
      },
      {
        x: '(1/24)*sqrt(96)',
        y: '247/36'
      }
    ]);
  });

  it('reverses extrema under reflection and preserves exact values', () => {
    const result = proveEvenQuarticMonotonicity(
      '-x^4+x^2+3'
    );

    expect(result.status).toBe('verified');
    if (result.status !== 'verified') return;

    expect(result.extrema).toEqual([
      {
        type: 'local_maximum',
        x: '-sqrt(1/2)',
        y: '13/4'
      },
      {
        type: 'local_minimum',
        x: '0',
        y: '3'
      },
      {
        type: 'local_maximum',
        x: 'sqrt(1/2)',
        y: '13/4'
      }
    ]);
  });

  it('reverses concavity under reflection', () => {
    const result = proveQuarticConcavity(
      '-x^4+2*x^2'
    );

    expect(result.status).toBe('verified');
    if (result.status !== 'verified') return;

    expect(result.concaveUpIntervals).toEqual([
      '(-(1/24)*sqrt(192), (1/24)*sqrt(192))'
    ]);

    expect(result.concaveDownIntervals).toEqual([
      '(-infinity, -(1/24)*sqrt(192))',
      '((1/24)*sqrt(192), +infinity)'
    ]);

    expect(result.inflectionPoints).toEqual([
      {
        x: '-(1/24)*sqrt(192)',
        y: '5/9'
      },
      {
        x: '(1/24)*sqrt(192)',
        y: '5/9'
      }
    ]);
  });

  it('does not claim a complete unsupported cubic-derivative proof', () => {
    const result = proveQuarticMonotonicity(
      'x^4-x^2+x'
    );

    expect(result.status).toBe('unsupported');
  });

  it('rejects a quartic that cancels to lower degree', () => {
    const input = 'x^4-x^4+x^2';

    expect(
      proveQuarticMonotonicity(input).status
    ).toBe('unsupported');

    expect(
      proveEvenQuarticMonotonicity(input).status
    ).toBe('unsupported');

    expect(
      proveQuarticConcavity(input).status
    ).toBe('unsupported');
  });
});
