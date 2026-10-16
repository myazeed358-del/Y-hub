import { describe, expect, it } from 'vitest';
import { ExpressionParser } from '@/services/math/parser';
import { ASTNormalizer } from '@/services/math/parser/normalizer';
import { DerivativeEngine } from '@/services/math/symbolic/derivative';
import { solveDerivativeConstraintCandidates } from '../services/domainConstraintSolver';

async function analyze(expression: string) {
  const parser = new ExpressionParser();
  const normalizer = new ASTNormalizer();
  const original = normalizer.normalize(parser.parse(expression));
  const derivative = new DerivativeEngine().differentiate(
    original, 'x', []
  );

  return solveDerivativeConstraintCandidates(
    original, derivative, 'x'
  );
}

describe('Domain constraint solver integration', () => {
  it('uses inequality engine for ln(x-2)', async () => {
    const result = await analyze('ln(x-2)');
    const log = result.find(
      item => item.source === 'original' &&
        item.kind === 'logarithm'
    );

    expect(log?.status).toBe('candidate_intervals');
    expect(log?.relation).toBe('>');
    expect(log?.intervals).toHaveLength(1);
    expect(log?.intervals?.[0].leftClosed).toBe(false);
  });

  it('solves the input constraint of sqrt(x)', async () => {
    const result = await analyze('sqrt(x)');
    const root = result.find(
      item => item.source === 'original' &&
        item.kind === 'even_root'
    );

    expect(root?.status).toBe('candidate_intervals');
    expect(root?.intervals).toHaveLength(1);
    expect(root?.intervals?.[0].leftClosed).toBe(true);
  });

  it('separately handles the denominator of 1/x', async () => {
    const result = await analyze('1/x');
    const denominator = result.find(
      item => item.source === 'original' &&
        item.kind === 'denominator'
    );

    expect(denominator?.status).toBe('candidate_intervals');
    expect(denominator?.intervals).toHaveLength(2);
  });

  it('does not invent constraints for sin(x)', async () => {
    const result = await analyze('sin(x)');
    expect(result).toEqual([]);
  });

  it('does not certify unsupported inverse-trig constraints', async () => {
    const result = await analyze('asin(x)');
    const inverseTrig = result.find(
      item => item.source === 'original' &&
        item.kind === 'inverse_trig'
    );

    expect(inverseTrig?.status).toBe('unsupported');
  });
});
