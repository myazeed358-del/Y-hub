import { DomainAnalyzer } from '@/services/math/domain';
import type { DomainRestriction } from '@/services/math/domain';
import { inequalityPort } from '@/services/math/ports/defaultPorts';
import { ASTUtils } from '@/services/math/symbolic/utils';
import type {
  CanonicalAST,
  InequalityNode
} from '@/services/math/types/ast';
import type { Interval } from '@/services/math/types/set';

export interface ConstraintCandidate {
  source: 'original' | 'derivative_formula';
  kind: DomainRestriction['type'];
  expression: string;
  relation: InequalityNode['operator'] | null;
  status: 'candidate_intervals' | 'unsupported';
  intervals?: Interval[];
  reason?: string;
}

function relationFor(
  kind: DomainRestriction['type']
): InequalityNode['operator'] | null {
  switch (kind) {
    case 'denominator':
      return '!=';
    case 'logarithm':
      return '>';
    case 'even_root':
      return '>=';
    default:
      return null;
  }
}

export async function solveDerivativeConstraintCandidates(
  original: CanonicalAST,
  derivative: CanonicalAST,
  variable: string
): Promise<ConstraintCandidate[]> {
  const analyzer = new DomainAnalyzer();

  const restrictions = [
    ...analyzer.analyze(original).map(restriction => ({
      source: 'original' as const,
      restriction
    })),
    ...analyzer.analyze(derivative).map(restriction => ({
      source: 'derivative_formula' as const,
      restriction
    }))
  ];

  const candidates: ConstraintCandidate[] = [];

  for (const { source, restriction } of restrictions) {
    const relation = relationFor(restriction.type);
    const expression = ASTUtils.serialize(
      restriction.conditionAST
    );

    const base = {
      source,
      kind: restriction.type,
      expression,
      relation
    };

    if (relation === null) {
      candidates.push({
        ...base,
        status: 'unsupported',
        reason: 'Compound domain relation needs a separate solver.'
      });
      continue;
    }

    const inequality: InequalityNode = {
      type: 'Inequality',
      operator: relation,
      lhs: restriction.conditionAST,
      rhs: { type: 'Number', value: '0' }
    };

    try {
      const result = await inequalityPort.execute({
        expression: inequality,
        variable
      });

      if (result.kind === 'unsupported') {
        candidates.push({
          ...base,
          status: 'unsupported',
          reason: result.status
        });
        continue;
      }

      const unresolved = result.solution.domainRestrictions.some(
        message => /unsolved/i.test(message)
      );

      if (unresolved) {
        candidates.push({
          ...base,
          status: 'unsupported',
          reason: 'Nested domain restriction was not resolved.'
        });
        continue;
      }

      candidates.push({
        ...base,
        status: 'candidate_intervals',
        intervals: result.solution.intervals
      });

    } catch (error: unknown) {
      candidates.push({
        ...base,
        status: 'unsupported',
        reason: error instanceof Error
          ? error.message
          : 'Constraint solver failed.'
      });
    }
  }

  return candidates;
}
