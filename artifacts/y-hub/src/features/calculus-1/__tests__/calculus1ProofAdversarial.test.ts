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
import {
  studyCalculus1Function
} from '../services/functionStudyService';

describe('Calculus 1 adversarial proof certification', () => {
  const asymmetric = 'x^4+x^3+x';

  it('finds the unique exact critical point', () => {
    const result = proveQuarticMonotonicity(asymmetric);

    expect(result.status).toBe('verified');
    if (result.status !== 'verified') return;

    expect(result.criticalPoints).toEqual(['-1']);
    expect(result.decreasingIntervals).toEqual([
      '(-infinity, -1)'
    ]);
    expect(result.increasingIntervals).toEqual([
      '(-1, +infinity)'
    ]);
    expect(result.extrema).toEqual([
      { type: 'local_minimum', x: '-1', y: '-1' }
    ]);
  });

  it('proves exact inflections of an asymmetric quartic', () => {
    const result = proveQuarticConcavity(asymmetric);

    expect(result.status).toBe('verified');
    if (result.status !== 'verified') return;

    expect(result.inflectionPoints).toEqual([
      { x: '-1/2', y: '-9/16' },
      { x: '0', y: '0' }
    ]);
    expect(result.concaveDownIntervals).toEqual([
      '(-1/2, 0)'
    ]);
    expect(result.concaveUpIntervals).toEqual([
      '(-infinity, -1/2)',
      '(0, +infinity)'
    ]);
  });

  it('reverses a unique extremum under reflection', () => {
    const result = proveQuarticMonotonicity(
      '-x^4-x^3-x'
    );

    expect(result.status).toBe('verified');
    if (result.status !== 'verified') return;

    expect(result.criticalPoints).toEqual(['-1']);
    expect(result.extrema).toEqual([
      { type: 'local_maximum', x: '-1', y: '1' }
    ]);
  });

  it('preserves inflection coordinates after a vertical shift', () => {
    const result = proveQuarticConcavity(
      'x^4+x^3+x+7'
    );

    expect(result.status).toBe('verified');
    if (result.status !== 'verified') return;

    expect(result.inflectionPoints).toEqual([
      { x: '-1/2', y: '103/16' },
      { x: '0', y: '7' }
    ]);
  });

  it('proves an irrational-root even quartic with scale factor', () => {
    const result = proveEvenQuarticMonotonicity(
      '3*x^4-3*x^2'
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
        y: '-3/4'
      },
      {
        type: 'local_maximum',
        x: '0',
        y: '0'
      },
      {
        type: 'local_minimum',
        x: 'sqrt(1/2)',
        y: '-3/4'
      }
    ]);
  });

  it('does not create false extrema at repeated roots', () => {
    const result = proveQuarticMonotonicity(
      'x^4+x^3'
    );

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
  });

  it('keeps both exact proofs when general analysis is unavailable', async () => {
    const result = await studyCalculus1Function(
      asymmetric
    );

    expect(result.monotonicityProof.status).toBe('verified');
    expect(result.concavityProof.status).toBe('verified');
    expect(result.verification).toBe('not_proven');

    if (result.monotonicityProof.status !== 'verified') return;
    if (result.concavityProof.status !== 'verified') return;

    expect(result.monotonicityProof.criticalPoints).toEqual([
      '-1'
    ]);
    expect(result.concavityProof.inflectionPoints).toEqual([
      { x: '-1/2', y: '-9/16' },
      { x: '0', y: '0' }
    ]);
  });
});
