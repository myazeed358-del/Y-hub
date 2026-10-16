import { describe, expect, it } from 'vitest';
import * as math from 'mathjs';
import {
  studyCalculus1Function as study
} from '../services/functionStudyService';

describe('Calculus 1 function study v1', () => {
  it('returns the first and second derivatives', async () => {
    const result = await study('x^2');

    expect(result.status).toBe('candidate_results');
    expect(result.verification).toBe('not_proven');

    expect(
      math.evaluate(result.firstDerivative, { x: 3 })
    ).toBeCloseTo(6, 8);

    expect(
      math.evaluate(result.secondDerivative, { x: 3 })
    ).toBeCloseTo(2, 8);
  });

  it('exposes analysis candidates without completeness claims', async () => {
    const result = await study('x^3-3*x');

    expect(
      Array.isArray(result.criticalPointCandidates)
    ).toBe(true);

    expect(
      Array.isArray(result.increasingIntervalCandidates)
    ).toBe(true);

    expect(
      Array.isArray(result.extremaCandidates)
    ).toBe(true);

    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('attaches an exact quadratic proof separately from candidates', async () => {
    const result = await study('x^2-4*x+1');

    expect(result.verification).toBe('not_proven');
    expect(result.monotonicityProof.status).toBe('verified');

    if (result.monotonicityProof.status !== 'verified') {
      return;
    }

    expect(result.monotonicityProof.criticalPoints).toEqual(['2']);
    expect(result.monotonicityProof.extrema).toEqual([{
      type: 'global_minimum',
      x: '2',
      y: '-3'
    }]);
  });

  it('attaches an exact cubic proof separately from general candidates', async () => {
    const result = await study('x^3-3*x');

    expect(result.verification).toBe('not_proven');
    expect(result.monotonicityProof.status).toBe('verified');

    if (result.monotonicityProof.status !== 'verified') return;

    expect(result.monotonicityProof.degree).toBe(3);
    expect(result.monotonicityProof.criticalPoints).toEqual([
      '-1', '1'
    ]);
    expect(result.monotonicityProof.extrema).toEqual([
      { type: 'local_maximum', x: '-1', y: '2' },
      { type: 'local_minimum', x: '1', y: '-2' }
    ]);

    if (result.monotonicityProof.degree === 3) {
      expect(result.monotonicityProof.inflectionPoints).toEqual([
        { x: '0', y: '0' }
      ]);
    }
  });

  it('does not invent extrema at repeated stationary roots', async () => {
    const result = await study('x^3');

    expect(result.monotonicityProof.status).toBe('verified');

    if (result.monotonicityProof.status !== 'verified') return;

    expect(result.monotonicityProof.criticalPoints).toEqual(['0']);
    expect(result.monotonicityProof.extrema).toEqual([]);
  });

  it('attaches an exact proof for irrational cubic roots', async () => {
    const result = await study('x^3-x');

    expect(result.monotonicityProof.status).toBe('verified');
    expect(result.verification).toBe('not_proven');

    if (result.monotonicityProof.status !== 'verified') return;

    expect(result.monotonicityProof.degree).toBe(3);
    expect(result.monotonicityProof.extrema).toHaveLength(2);
    expect(result.monotonicityProof.criticalPoints[0])
      .toContain('sqrt(12)');
  });

  it('attaches exact quartic monotonicity proof', async () => {
    const result = await study('x^4-2*x^2');

    expect(result.monotonicityProof.status).toBe('verified');
    expect(result.verification).toBe('not_proven');

    if (result.monotonicityProof.status !== 'verified') {
      return;
    }

    expect(result.monotonicityProof.degree).toBe(4);

    expect(result.monotonicityProof.criticalPoints).toEqual([
      '-1', '0', '1'
    ]);

    expect(result.monotonicityProof.extrema).toEqual([
      { type: 'local_minimum', x: '-1', y: '-1' },
      { type: 'local_maximum', x: '0', y: '0' },
      { type: 'local_minimum', x: '1', y: '-1' }
    ]);
  });

  it('does not certify quartic roots without complete proof', async () => {
    const result = await study('x^4-x^2+x');

    expect(result.monotonicityProof.status).toBe('unsupported');
    expect(result.verification).toBe('not_proven');
  });
  it('certifies quartic concavity when monotonicity is unsupported', async () => {
    const result = await study('x^4-x^2+x');

    expect(result.monotonicityProof.status).toBe('unsupported');
    expect(result.concavityProof.status).toBe('verified');
    expect(result.verification).toBe('not_proven');

    // Unsupported candidate analysis must not erase
    // the independently verified concavity proof.
    expect(result.criticalPointCandidates).toEqual([]);
    expect(result.increasingIntervalCandidates).toEqual([]);
    expect(result.decreasingIntervalCandidates).toEqual([]);

    expect(result.warnings.some(warning =>
      warning.includes(
        'General candidate analysis is unavailable'
      )
    )).toBe(true);

    if (result.concavityProof.status !== 'verified') return;

    expect(result.concavityProof.inflectionPoints).toEqual([
      {
        x: '-(1/24)*sqrt(96)',
        y: '-5/36-(1/24)*sqrt(96)'
      },
      {
        x: '(1/24)*sqrt(96)',
        y: '-5/36+(1/24)*sqrt(96)'
      }
    ]);
  });
  it('certifies both quartic proofs independently', async () => {
    const result = await study('x^4-2*x^2');

    expect(result.monotonicityProof.status).toBe('verified');
    expect(result.concavityProof.status).toBe('verified');

    if (result.concavityProof.status !== 'verified') return;

    expect(result.concavityProof.inflectionPoints).toHaveLength(2);
    expect(result.concavityProof.concaveUpIntervals).toHaveLength(2);
  });

  it('keeps cubic curvature in the cubic proof', async () => {
    const result = await study('x^3-3*x');

    expect(result.monotonicityProof.status).toBe('verified');
    expect(result.concavityProof.status).toBe('unsupported');
  });

  it('certifies irrational stationary roots of an even quartic', async () => {
    const result = await study('x^4-x^2');

    expect(result.monotonicityProof.status).toBe('verified');
    expect(result.concavityProof.status).toBe('verified');
    expect(result.verification).toBe('not_proven');

    if (result.monotonicityProof.status !== 'verified') return;

    expect(result.monotonicityProof.degree).toBe(4);
    expect(result.monotonicityProof.criticalPoints).toEqual([
      '-sqrt(1/2)',
      '0',
      'sqrt(1/2)'
    ]);
    expect(result.monotonicityProof.extrema).toEqual([
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

  it('does not confuse missing candidates with proofs', async () => {
    const result = await study('x^2+1');

    expect(result.verification).toBe('not_proven');

    expect(
      result.warnings.some(message =>
        message.includes('empty candidate list')
      )
    ).toBe(true);
  });

  it.each([
    'sin(x)',
    '1/x',
    'abs(x)',
    'x^x',
    'x^2+y',
    'x^2=4'
  ])('rejects input outside polynomial scope: %s', async expression => {
    await expect(study(expression)).rejects.toThrow(
      /polynomial/
    );
  });
});
