import { describe, expect, it } from 'vitest';
import { UndeterminedCoefficientsEngine } from '../undetermined_coefficients';
import { ForcingTrialBuilder } from '../forcingTrialBuilder';
import { UndeterminedCoefficientsCodec } from '../undeterminedCoefficientsCodec';
import { CoefficientSystemSolver } from '../coefficientSystemSolver';
import type { CanonicalAST } from '../../types/ast';

const n = (value: number): CanonicalAST => ({ type: 'Number', value: String(value) });

describe('undetermined coefficients composition', () => {
  it('identifies a constant forcing independently', () => {
    expect(new ForcingTrialBuilder().analyzeForcing(n(1), 'x')).toEqual({ kind: 'polynomial', degree: 0 });
  });

  it('does not lose exact rational coefficients', () => {
    const codec = new UndeterminedCoefficientsCodec();
    const exact = codec.parseRat(n(3));
    expect(exact?.num).toBe(3n);
    if (exact) expect(codec.ratToAST(exact)).toEqual(n(3));
  });

  it('solves a small coefficient system with exact arithmetic', () => {
    const nRat = (v: number) => ({ num: BigInt(v), den: 1n });
    const result = new CoefficientSystemSolver().solveLinearSystem(
      [[nRat(1), nRat(0)], [nRat(0), nRat(1)]], [nRat(2), nRat(3)],
    );
    expect(result).toEqual([nRat(2), nRat(3)]);
  });

  it('continues to compute a particular solution for y\'\' + y = 1', () => {
    const result = new UndeterminedCoefficientsEngine().solveParticular(
      {} as any, n(1), 'x', [n(1), n(0), n(1)],
    );
    expect(result).not.toBeNull();
    expect(result?.steps).toHaveLength(1);
  });
});
