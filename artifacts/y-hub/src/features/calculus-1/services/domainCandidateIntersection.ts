import { SetEngine } from '@/services/math/symbolic/sets';
import type { Endpoint, Interval } from '@/services/math/types/set';
import type { DomainConstraint } from '@/services/math/domain/derivativeDomainSafety';
import type { ConstraintCandidate } from './domainConstraintSolver';

type ConstraintSource = ConstraintCandidate['source'];

export type DomainCandidateIntersection =
  | {
      status: 'candidate_intervals';
      source: ConstraintSource;
      intervals: Interval[];
      applied: number;
    }
  | {
      status: 'no_extracted_constraints';
      source: ConstraintSource;
      applied: 0;
    }
  | {
      status: 'undetermined';
      source: ConstraintSource;
      applied: number;
      reasons: string[];
    };

function comparable(
  intervals: readonly Interval[]
): boolean {
  const endpoints: Endpoint[] = [];

  for (const interval of intervals) {
    const order = SetEngine.exactCompare(
      interval.left,
      interval.right
    );

    if (order === null || order > 0) return false;

    if (
      order === 0 &&
      (!interval.leftClosed || !interval.rightClosed)
    ) {
      return false;
    }

    endpoints.push(interval.left, interval.right);
  }

  for (const a of endpoints) {
    for (const b of endpoints) {
      if (SetEngine.exactCompare(a, b) === null) {
        return false;
      }
    }
  }

  return true;
}

function matchesConstraint(
  candidate: ConstraintCandidate,
  constraint: DomainConstraint
): boolean {
  const relation: ConstraintCandidate['relation'] =
    constraint.kind === 'denominator'
      ? '!='
      : constraint.kind === 'logarithm'
        ? '>'
        : constraint.kind === 'even_root'
          ? '>='
          : null;

  return (
    relation !== null &&
    candidate.kind === constraint.kind &&
    candidate.expression === constraint.expression &&
    candidate.relation === relation
  );
}

export function intersectDomainCandidates(
  candidates: readonly ConstraintCandidate[],
  expected: readonly DomainConstraint[],
  source: ConstraintSource
): DomainCandidateIntersection {
  const selected = candidates.filter(
    candidate => candidate.source === source
  );

  const applied = selected.length;

  const unknown = (reason: string): DomainCandidateIntersection => ({
    status: 'undetermined',
    source,
    applied,
    reasons: [reason]
  });

  if (expected.some(
    constraint => constraint.kind === 'general_real_power'
  )) {
    return unknown(
      'Variable-power assumptions are not integrated into interval solving.'
    );
  }

  if (expected.length === 0 && selected.length === 0) {
    return {
      status: 'no_extracted_constraints',
      source,
      applied: 0
    };
  }

  if (expected.length === 0) {
    return unknown(
      'Candidate results have no corresponding extracted constraints.'
    );
  }

  if (selected.length !== expected.length) {
    return unknown(
      'Candidate count does not match extracted constraint count.'
    );
  }

  if (selected.some(candidate =>
    !expected.some(constraint =>
      matchesConstraint(candidate, constraint)
    )
  )) {
    return unknown(
      'Solver returned an unexpected constraint.'
    );
  }

  for (const constraint of expected) {
    const matched = selected.some(candidate =>
      matchesConstraint(candidate, constraint)
    );

    if (!matched) {
      return unknown(
        'At least one extracted constraint has no solver result.'
      );
    }
  }

  if (selected.some(
    candidate =>
      candidate.status !== 'candidate_intervals' ||
      !candidate.intervals
  )) {
    return unknown(
      'At least one constraint could not be solved.'
    );
  }

  const sets = selected.map(
    candidate => candidate.intervals!
  );

  const allIntervals = sets.flat();

  if (!comparable(allIntervals)) {
    return unknown(
      'Interval endpoints cannot all be compared exactly.'
    );
  }

  let intersection = [...sets[0]];

  for (const next of sets.slice(1)) {
    intersection = SetEngine.intersection(
      intersection,
      next
    );
  }

  if (!comparable(intersection)) {
    return unknown(
      'The resulting interval endpoints are not comparable.'
    );
  }

  return {
    status: 'candidate_intervals',
    source,
    intervals: intersection,
    applied
  };
}
