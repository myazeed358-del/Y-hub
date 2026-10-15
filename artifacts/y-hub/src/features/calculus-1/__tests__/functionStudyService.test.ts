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

  it('does not promote cubic candidates to exact proofs', async () => {
    const result = await study('x^3-3*x');

    expect(result.monotonicityProof.status).toBe('unsupported');
    expect(result.verification).toBe('not_proven');
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
