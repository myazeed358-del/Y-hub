import { describe, expect, it } from 'vitest';
import { ExpressionParser } from '@/services/math/parser';
import { ASTNormalizer } from '@/services/math/parser/normalizer';
import { DerivativeEngine } from '@/services/math/symbolic/derivative';
import {
  analyzeDerivativeDomain,
  type DomainConstraint
} from '@/services/math/domain/derivativeDomainSafety';
import type { ConstraintCandidate } from '../services/domainConstraintSolver';
import {
  solveDerivativeConstraintCandidates
} from '../services/domainConstraintSolver';
import {
  intersectDomainCandidates
} from '../services/domainCandidateIntersection';

async function analyze(expression: string) {
  const parser = new ExpressionParser();
  const normalizer = new ASTNormalizer();

  const original = normalizer.normalize(
    parser.parse(expression)
  );

  const derivative = new DerivativeEngine().differentiate(
    original, 'x', []
  );

  const safety = analyzeDerivativeDomain(
    original, derivative, 'x'
  );

  const candidates = await solveDerivativeConstraintCandidates(
    original, derivative, 'x'
  );

  return {
    original: intersectDomainCandidates(
      candidates, safety.original, 'original'
    ),
    derivative: intersectDomainCandidates(
      candidates,
      safety.derivativeFormula,
      'derivative_formula'
    )
  };
}

describe('Domain candidate intersection', () => {
  it('intersects ln(x-2) and sqrt(x+1) as x>2', async () => {
    const result = await analyze(
      'ln(x-2)+sqrt(x+1)'
    );

    expect(result.original.status).toBe(
      'candidate_intervals'
    );

    if (result.original.status !== 'candidate_intervals') {
      return;
    }

    expect(result.original.intervals).toHaveLength(1);

    const interval = result.original.intervals[0];

    expect(interval.left.type).toBe('value');

    if (interval.left.type === 'value') {
      expect(interval.left.rational).toBeDefined();
      expect(
        Number(interval.left.rational!.num) /
        Number(interval.left.rational!.den)
      ).toBe(2);
    }

    expect(interval.leftClosed).toBe(false);
    expect(interval.right).toEqual({
      type: 'infinity',
      sign: 1
    });
  });

  it('does not claim a complete real domain for sin(x)', async () => {
    const result = await analyze('sin(x)');

    expect(result.original.status).toBe(
      'no_extracted_constraints'
    );
  });

  it('does not silently drop the x^x assumption', async () => {
    const result = await analyze('x^x');

    expect(result.original.status).toBe('undetermined');
  });

  it('does not certify unsupported inverse trig constraints', async () => {
    const result = await analyze('asin(x)');

    expect(result.original.status).toBe('undetermined');
  });

  it('rejects symbolically incomparable endpoints', () => {
    const candidate = (
      kind: 'denominator' | 'logarithm',
      name: string
    ): ConstraintCandidate => ({
      source: 'original',
      kind,
      expression: name,
      relation: kind === 'denominator' ? '!=' : '>',
      status: 'candidate_intervals',
      intervals: [{
        left: {
          type: 'value',
          ast: { type: 'Symbol', name }
        },
        right: { type: 'infinity', sign: 1 },
        leftClosed: false,
        rightClosed: false
      }]
    });

    const expected: DomainConstraint[] = [
      {
        kind: 'denominator',
        expression: 'a',
        condition: '(a) != 0',
        strength: 'necessary'
      },
      {
        kind: 'logarithm',
        expression: 'b',
        condition: '(b) > 0',
        strength: 'necessary'
      }
    ];

    const result = intersectDomainCandidates(
      [
        candidate('denominator', 'a'),
        candidate('logarithm', 'b')
      ],
      expected,
      'original'
    );

    expect(result.status).toBe('undetermined');
  });
});
