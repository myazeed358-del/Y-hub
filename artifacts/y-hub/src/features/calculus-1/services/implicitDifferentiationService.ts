import * as math from 'mathjs';
import { ExpressionParser } from '@/services/math/parser';
import { ASTNormalizer } from '@/services/math/parser/normalizer';
import { DerivativeEngine } from '@/services/math/symbolic/derivative';
import { ASTUtils } from '@/services/math/symbolic/utils';
import type { CanonicalAST } from '@/services/math/types/ast';
import type { MathStep } from '@/services/math/types/step';
import type { Calculus1Result } from './calculus1Service';

function supportedPolynomial(
  node: CanonicalAST,
  budget: { left: number }
): boolean {
  budget.left--;

  if (budget.left < 0) return false;

  if (node.type === 'Number') {
    return /^-?\d+(?:\.\d+)?$/.test(node.value) &&
      Number.isFinite(Number(node.value));
  }

  if (node.type === 'Symbol') {
    return node.name === 'x' || node.name === 'y';
  }

  if (node.type === 'Parenthesis') {
    return supportedPolynomial(node.content, budget);
  }

  if (node.type !== 'Operator') return false;

  if (node.operator === '^') {
    if (node.args.length !== 2) return false;

    const exponent = node.args[1];

    return exponent.type === 'Number' &&
      /^\d+$/.test(exponent.value) &&
      Number(exponent.value) <= 12 &&
      supportedPolynomial(node.args[0], budget);
  }

  if (
    !['+', '-', '*', 'implicit_multiply']
      .includes(node.operator)
  ) {
    return false;
  }

  if (
    node.operator === '-' &&
    ![1, 2].includes(node.args.length)
  ) {
    return false;
  }

  return node.args.length > 0 &&
    node.args.every(arg =>
      supportedPolynomial(arg, budget)
    );
}

export function solveCalculus1ImplicitDerivative(
  equation: string
): Calculus1Result {
  if (!equation.trim()) {
    throw new Error('An equation is required.');
  }

  const parser = new ExpressionParser();
  const normalizer = new ASTNormalizer();

  const ast = normalizer.normalize(
    parser.parse(equation)
  );

  if (ast.type !== 'Equation') {
    throw new Error(
      'Implicit differentiation requires an equation with =.'
    );
  }

  if (
    !supportedPolynomial(ast.lhs, { left: 150 }) ||
    !supportedPolynomial(ast.rhs, { left: 150 })
  ) {
    throw new Error(
      'This version supports polynomial equations in x and y only.'
    );
  }

  const expression: CanonicalAST = {
    type: 'Operator',
    operator: '-',
    args: [ast.lhs, ast.rhs]
  };

  const engine = new DerivativeEngine();

  const xSteps: MathStep[] = [];
  const ySteps: MathStep[] = [];

  const partialX = engine.differentiate(
    expression, 'x', xSteps
  );

  const partialY = engine.differentiate(
    expression, 'y', ySteps
  );

  const fx = ASTUtils.serialize(partialX);
  const fy = ASTUtils.serialize(partialY);

  const steps: MathStep[] = [
    {
      id: 'implicit_equation_normalization',
      title: 'Write the equation as F(x,y) = 0',
      explanation:
        `Move all terms to the left: ` +
        `F(x,y) = ${ASTUtils.serialize(expression)}.`
    },
    {
      id: 'implicit_partial_x',
      title: 'Differentiate with respect to x',
      explanation:
        `Treat y as constant to obtain F_x = ${fx}.`,
      subSteps: xSteps
    },
    {
      id: 'implicit_partial_y',
      title: 'Differentiate with respect to y',
      explanation:
        `Treat x as constant to obtain F_y = ${fy}.`,
      subSteps: ySteps
    },
    {
      id: 'implicit_chain_rule',
      title: 'Apply the implicit chain rule',
      explanation:
        'Along a differentiable curve, ' +
        'F_x + F_y * (dy/dx) = 0.'
    }
  ];

  if (
    partialY.type === 'Number' &&
    Number(partialY.value) === 0
  ) {
    return {
      status: 'unresolved',
      latex: null,
      method: 'implicit_partial_derivatives',
      steps,
      warnings: [
        'F_y is identically zero after simplification. ' +
        'Cannot isolate dy/dx using -F_x/F_y.'
      ]
    };
  }

  const derivative: CanonicalAST = {
    type: 'Operator',
    operator: '/',
    args: [
      {
        type: 'Operator',
        operator: '*',
        args: [
          { type: 'Number', value: '-1' },
          partialX
        ]
      },
      partialY
    ]
  };

  const resultExpression = ASTUtils.serialize(derivative);

  steps.push({
    id: 'implicit_isolate_derivative',
    title: 'Isolate dy/dx',
    explanation:
      `dy/dx = -F_x/F_y = ${resultExpression}, ` +
      'provided F_y is nonzero.'
  });

  return {
    status: 'computed',
    latex:
      String.raw`\frac{dy}{dx} = ` +
      math.parse(resultExpression).toTex(),
    expression: resultExpression,
    method: 'implicit_partial_derivatives',
    steps,
    warnings: [
      'Valid at points on the original equation where F_y != 0.',
      'The equation must define a differentiable local branch ' +
      'y(x) at the point being considered.'
    ]
  };
}
