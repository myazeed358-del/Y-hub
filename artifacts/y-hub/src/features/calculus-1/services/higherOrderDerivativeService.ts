import * as math from 'mathjs';
import { ExpressionParser } from '@/services/math/parser';
import { ASTNormalizer } from '@/services/math/parser/normalizer';
import { DerivativeEngine } from '@/services/math/symbolic/derivative';
import { ASTUtils } from '@/services/math/symbolic/utils';
import {
  analyzeDerivativeDomain
} from '@/services/math/domain/derivativeDomainSafety';
import type { CanonicalAST } from '@/services/math/types/ast';
import type { MathStep } from '@/services/math/types/step';
import type { Calculus1Result } from './calculus1Service';

const MAX_ORDER = 6;

export function solveCalculus1HigherOrderDerivative(
  expression: string,
  order: number
): Calculus1Result {
  if (!expression.trim()) {
    throw new Error('Mathematical expression is required.');
  }

  if (
    !Number.isSafeInteger(order) ||
    order < 1 ||
    order > MAX_ORDER
  ) {
    throw new Error(
      `Derivative order must be an integer from 1 to ${MAX_ORDER}.`
    );
  }

  const parser = new ExpressionParser();
  const normalizer = new ASTNormalizer();

  const original = normalizer.normalize(
    parser.parse(expression)
  );

  if (
    original.type === 'Equation' ||
    original.type === 'Inequality'
  ) {
    throw new Error(
      'Enter a function, not an equation or inequality.'
    );
  }

  const engine = new DerivativeEngine();
  const steps: MathStep[] = [];

  let current: CanonicalAST = original;

  for (let n = 1; n <= order; n++) {
    const orderSteps: MathStep[] = [];

    current = engine.differentiate(
      current,
      'x',
      orderSteps
    );

    const currentExpression = ASTUtils.serialize(current);

    steps.push({
      id: `higher_order_derivative_${n}`,
      title: `Derivative order ${n}`,
      explanation:
        `Calculated the derivative of order ${n} ` +
        `with respect to x: ${currentExpression}.`,
      subSteps: orderSteps
    });
  }

  const domain = analyzeDerivativeDomain(
    original,
    current,
    'x'
  );

  const expressionResult = ASTUtils.serialize(current)
    .replace(/\bln\s*\(/g, 'log(');

  const originalLatex = math.parse(
    ASTUtils.serialize(original)
  ).toTex();

  const resultLatex = math.parse(
    expressionResult
  ).toTex();

  const notation = order === 1
    ? String.raw`\frac{d}{dx}`
    : String.raw`\frac{d^{${order}}}{dx^{${order}}}`;

  return {
    status: 'computed',
    latex:
      `${notation}` +
      String.raw`\left(${originalLatex}\right)` +
      ` = ${resultLatex}`,
    expression: expressionResult,
    method: 'higher_order_derivative_engine',
    steps,
    domain,
    warnings: [
      ...domain.original.map(item =>
        `Original function condition: ${item.condition}`
      ),
      ...domain.derivativeFormula.map(item =>
        `Final formula condition: ${item.condition}`
      ),
      'The complete domain of the higher-order derivative ' +
      'and differentiability at exceptional points have not ' +
      'been independently established.'
    ]
  };
}
