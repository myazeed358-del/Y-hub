import { describe, expect, it } from 'vitest';
import type { DomainConstraint } from '@/services/math/domain/derivativeDomainSafety';
import type { ConstraintCandidate } from '../services/domainConstraintSolver';
import { intersectDomainCandidates } from '../services/domainCandidateIntersection';

const expected: DomainConstraint = {
  kind: 'logarithm',
  expression: 'x',
  condition: '(x) > 0',
  strength: 'necessary'
};

const candidate: ConstraintCandidate = {
  source: 'original',
  kind: 'logarithm',
  expression: 'x',
  relation: '>',
  status: 'candidate_intervals',
  intervals: [{
    left: {
      type: 'value',
      ast: { type: 'Number', value: '0' },
      rational: { num: 0n, den: 1n }
    },
    right: { type: 'infinity', sign: 1 },
    leftClosed: false,
    rightClosed: false
  }]
};

describe('Domain candidate integrity', () => {
  it('accepts the expected constraint', () => {
    const result = intersectDomainCandidates(
      [candidate], [expected], 'original'
    );

    expect(result.status).toBe('candidate_intervals');
  });

  it('rejects an incorrect inequality direction', () => {
    const result = intersectDomainCandidates(
      [{ ...candidate, relation: '>=' }],
      [expected],
      'original'
    );

    expect(result.status).toBe('undetermined');
  });

  it('rejects duplicated candidate results', () => {
    const result = intersectDomainCandidates(
      [candidate, candidate],
      [expected],
      'original'
    );

    expect(result.status).toBe('undetermined');
  });

  it('rejects an unexpected constraint', () => {
    const result = intersectDomainCandidates(
      [{
        ...candidate,
        kind: 'denominator',
        relation: '!='
      }],
      [expected],
      'original'
    );

    expect(result.status).toBe('undetermined');
  });

  it('rejects missing solver results', () => {
    const result = intersectDomainCandidates(
      [],
      [expected],
      'original'
    );

    expect(result.status).toBe('undetermined');
  });
});
