import type { CanonicalAST } from '@/services/math/types/ast';
import {
  analyzeDerivativeDomain,
  type DerivativeDomainSafety
} from '@/services/math/domain/derivativeDomainSafety';
import {
  solveDerivativeConstraintCandidates
} from './domainConstraintSolver';
import {
  intersectDomainCandidates,
  type DomainCandidateIntersection
} from './domainCandidateIntersection';
import {
  proveAbsoluteValueAtZero,
  type AbsoluteValueZeroProof
} from './absoluteValueZeroProof';

export interface DerivativeDomainAssessment {
  scope: 'candidate_constraints';
  constraints: DerivativeDomainSafety;
  originalDomain: DomainCandidateIntersection;
  derivativeFormulaDomain: DomainCandidateIntersection;
  differentiability: {
    // Global differentiability remains unproven.
    status: 'not_proven';
    exceptionalPoints: 'not_checked' | 'zero_checked';
    zeroPoint?: AbsoluteValueZeroProof;
  };
}

export async function assessDerivativeDomain(
  original: CanonicalAST,
  derivative: CanonicalAST,
  variable: string
): Promise<DerivativeDomainAssessment> {
  const constraints = analyzeDerivativeDomain(
    original, derivative, variable
  );

  const candidates = await solveDerivativeConstraintCandidates(
    original, derivative, variable
  );

  const zeroPoint =
    original.type === 'Function' &&
    original.name === 'abs' &&
    original.args.length === 1
      ? proveAbsoluteValueAtZero(original, variable)
      : undefined;

  return {
    scope: 'candidate_constraints',
    constraints,
    originalDomain: intersectDomainCandidates(
      candidates,
      constraints.original,
      'original'
    ),
    derivativeFormulaDomain: intersectDomainCandidates(
      candidates,
      constraints.derivativeFormula,
      'derivative_formula'
    ),
    differentiability: {
      status: 'not_proven',
      exceptionalPoints:
        zeroPoint && zeroPoint.status !== 'not_proven'
          ? 'zero_checked'
          : 'not_checked',
      ...(zeroPoint ? { zeroPoint } : {})
    }
  };
}
