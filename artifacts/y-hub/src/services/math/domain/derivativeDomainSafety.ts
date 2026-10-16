import { DomainAnalyzer } from './index';
import type { DomainRestriction } from './index';
import type { CanonicalAST } from '../types/ast';
import { ASTUtils } from '../symbolic/utils';

export type DomainConstraint = {
  kind: DomainRestriction['type'] | 'general_real_power';
  expression: string;
  condition: string;
  strength: 'necessary' | 'sufficient';
};

export interface DerivativeDomainSafety {
  scope: 'constraints_only';
  original: DomainConstraint[];
  derivativeFormula: DomainConstraint[];
  notes: string[];
}

function convertRestriction(
  restriction: DomainRestriction
): DomainConstraint {
  const expression = ASTUtils.serialize(
    restriction.conditionAST
  );

  let condition: string;

  switch (restriction.type) {
    case 'denominator':
      condition = `(${expression}) != 0`;
      break;
    case 'logarithm':
      condition = `(${expression}) > 0`;
      break;
    case 'even_root':
      condition = `(${expression}) >= 0`;
      break;
    case 'inverse_trig':
      condition = `-1 <= (${expression}) <= 1`;
      break;
    case 'inverse_sec_csc':
      condition =
        `(${expression}) <= -1 OR (${expression}) >= 1`;
      break;
  }

  return {
    kind: restriction.type,
    expression,
    condition,
    strength: 'necessary'
  };
}

function collectVariablePowers(
  node: CanonicalAST,
  variable: string,
  constraints: DomainConstraint[]
): void {
  if (
    node.type === 'Operator' &&
    node.operator === '^' &&
    node.args.length === 2
  ) {
    const [base, exponent] = node.args;

    if (
      ASTUtils.containsVariable(base, variable) &&
      ASTUtils.containsVariable(exponent, variable)
    ) {
      const expression = ASTUtils.serialize(base);

      constraints.push({
        kind: 'general_real_power',
        expression,
        condition: `(${expression}) > 0`,
        strength: 'sufficient'
      });
    }
  }

  if (node.type === 'Operator' || node.type === 'Function') {
    node.args.forEach(arg =>
      collectVariablePowers(arg, variable, constraints)
    );
  } else if (node.type === 'Parenthesis') {
    collectVariablePowers(
      node.content,
      variable,
      constraints
    );
  }
}

function unique(
  constraints: DomainConstraint[]
): DomainConstraint[] {
  const seen = new Set<string>();

  return constraints.filter(item => {
    const key =
      `${item.kind}:${item.condition}:${item.strength}`;

    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function analyzeDerivativeDomain(
  original: CanonicalAST,
  derivative: CanonicalAST,
  variable: string
): DerivativeDomainSafety {
  const analyzer = new DomainAnalyzer();

  const originalConstraints = analyzer
    .analyze(original)
    .map(convertRestriction);

  collectVariablePowers(
    original,
    variable,
    originalConstraints
  );

  const derivativeConstraints = analyzer
    .analyze(derivative)
    .map(convertRestriction);

  return {
    scope: 'constraints_only',
    original: unique(originalConstraints),
    derivativeFormula: unique(derivativeConstraints),
    notes: [
      'Extracted constraints do not establish the complete real domain.',
      'Derivative-expression constraints do not prove differentiability.',
      'A derivative formula may omit points where the derivative exists.',
      'Variable-base power conditions are sufficient real-branch assumptions.'
    ]
  };
}
