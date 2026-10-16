import { describe, expect, it } from 'vitest';
import { ExpressionParser } from '@/services/math/parser';
import { ASTNormalizer } from '@/services/math/parser/normalizer';
import { DerivativeEngine } from '@/services/math/symbolic/derivative';
import type { Endpoint } from '@/services/math/types/set';
import {
  solveDerivativeConstraintCandidates
} from '../services/domainConstraintSolver';

async function analyze(expression: string) {
  const parser = new ExpressionParser();
  const normalizer = new ASTNormalizer();

  const original = normalizer.normalize(
    parser.parse(expression)
  );

  const derivative = new DerivativeEngine().differentiate(
    original, 'x', []
  );

  return solveDerivativeConstraintCandidates(
    original, derivative, 'x'
  );
}

function finiteValue(endpoint: Endpoint): number {
  if (endpoint.type !== 'value') {
    throw new Error('Expected finite endpoint');
  }

  if (endpoint.rational) {
    return Number(endpoint.rational.num) /
      Number(endpoint.rational.den);
  }

  if (endpoint.ast.type === 'Number') {
    return Number(endpoint.ast.value);
  }

  throw new Error('Endpoint cannot be verified numerically');
}

describe('Domain constraint semantic boundaries', () => {
  it('solves ln(x-2) as (2, infinity)', async () => {
    const candidates = await analyze('ln(x-2)');

    const log = candidates.find(
      item => item.source === 'original' &&
        item.kind === 'logarithm'
    );

    expect(log?.status).toBe('candidate_intervals');
    expect(log?.intervals).toHaveLength(1);

    const interval = log!.intervals![0];

    expect(finiteValue(interval.left)).toBe(2);
    expect(interval.leftClosed).toBe(false);
    expect(interval.right).toEqual({
      type: 'infinity',
      sign: 1
    });
  });

  it('solves sqrt(x) as [0, infinity)', async () => {
    const candidates = await analyze('sqrt(x)');

    const root = candidates.find(
      item => item.source === 'original' &&
        item.kind === 'even_root'
    );

    expect(root?.status).toBe('candidate_intervals');
    expect(root?.intervals).toHaveLength(1);

    const interval = root!.intervals![0];

    expect(finiteValue(interval.left)).toBe(0);
    expect(interval.leftClosed).toBe(true);
    expect(interval.right).toEqual({
      type: 'infinity',
      sign: 1
    });
  });

  it('excludes zero from both sides of 1/x', async () => {
    const candidates = await analyze('1/x');

    const denominator = candidates.find(
      item => item.source === 'original' &&
        item.kind === 'denominator'
    );

    expect(denominator?.status).toBe(
      'candidate_intervals'
    );
    expect(denominator?.intervals).toHaveLength(2);

    const intervals = denominator!.intervals!;

    expect(intervals[0].left).toEqual({
      type: 'infinity',
      sign: -1
    });
    expect(finiteValue(intervals[0].right)).toBe(0);
    expect(intervals[0].rightClosed).toBe(false);

    expect(finiteValue(intervals[1].left)).toBe(0);
    expect(intervals[1].leftClosed).toBe(false);
    expect(intervals[1].right).toEqual({
      type: 'infinity',
      sign: 1
    });
  });

  it('keeps simultaneous constraints separate', async () => {
    const candidates = await analyze(
      'ln(x-2)+sqrt(x+1)'
    );

    const originals = candidates.filter(
      item => item.source === 'original'
    );

    expect(originals).toHaveLength(2);
    expect(originals.every(
      item => item.status === 'candidate_intervals'
    )).toBe(true);
  });

  it('does not silently certify asin(x)', async () => {
    const candidates = await analyze('asin(x)');

    const inverse = candidates.find(
      item => item.source === 'original' &&
        item.kind === 'inverse_trig'
    );

    expect(inverse?.status).toBe('unsupported');
    expect(inverse?.intervals).toBeUndefined();
  });
});
