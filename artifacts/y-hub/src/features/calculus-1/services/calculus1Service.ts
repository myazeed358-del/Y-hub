import * as math from 'mathjs';
import { ExpressionParser } from '@/services/math/parser';
import { ASTNormalizer } from '@/services/math/parser/normalizer';
import { DerivativeEngine } from '@/services/math/symbolic/derivative';
import { ASTUtils } from '@/services/math/symbolic/utils';
import {
  analyzeDerivativeDomain,
  type DerivativeDomainSafety
} from '@/services/math/domain/derivativeDomainSafety';
import { evaluateCalculusLimit } from '@/utils/calculusLimitBridge';
import type { MathStep } from '@/services/math/types/step';

export interface Calculus1Result {
  status: 'computed' | 'unresolved';
  latex: string | null;
  expression?: string;
  method: string;
  steps: MathStep[];
  warnings: string[];
  domain?: DerivativeDomainSafety;
}

function validateExpression(expression: string): void {
  if (!expression.trim()) {
    throw new Error('Mathematical expression is required.');
  }
}

export function solveCalculus1Limit(
  expression: string,
  point: string,
  direction: 'left' | 'right' | 'both'
): Calculus1Result {
  validateExpression(expression);

  const result = evaluateCalculusLimit(expression, point, direction);

  const computed =
    ['finite', '+infinity', '-infinity'].includes(result.classification)
    && result.valueLatex !== null;

  return {
    status: computed ? 'computed' : 'unresolved',
    latex: computed ? result.valueLatex : null,
    method: result.strategy,
    steps: result.steps,
    warnings: [
      ...result.conditions,
      ...result.warnings,
    ],
  };
}

export function solveCalculus1Derivative(
  expression: string
): Calculus1Result {
  validateExpression(expression);

  const parser = new ExpressionParser();
  const normalizer = new ASTNormalizer();
  const ast = normalizer.normalize(parser.parse(expression));

  if (ast.type === 'Equation' || ast.type === 'Inequality') {
    throw new Error('Enter a function, not an equation or inequality.');
  }

  const steps: MathStep[] = [];
  const derivative = new DerivativeEngine().differentiate(
    ast,
    'x',
    steps
  );

  const domain = analyzeDerivativeDomain(
    ast,
    derivative,
    'x'
  );

  const canonicalExpression = ASTUtils.serialize(derivative);

  // MathJS uses log(x) for the natural logarithm.
  // Keep the engine's canonical AST unchanged.
  const resultExpression = canonicalExpression.replace(
    /\bln\s*\(/g,
    'log('
  );

  return {
    status: 'computed',
    latex: math.parse(canonicalExpression).toTex(),
    expression: resultExpression,
    method: 'local_derivative_engine',
    steps,
    domain,
    warnings: [
      ...domain.original.map(condition =>
        condition.strength === 'sufficient'
          ? `Sufficient real-domain assumption: ${condition.condition}`
          : `Original function requires: ${condition.condition}`
      ),
      ...domain.derivativeFormula.map(condition =>
        `Displayed derivative formula requires: ${condition.condition}`
      ),
      ...(domain.original.length > 0 ||
          domain.derivativeFormula.length > 0
        ? ['Domain checks are partial, not a complete differentiability proof.']
        : [])
    ],
  };
}
