import { ExpressionParser } from '@/services/math/parser';
import { ASTNormalizer } from '@/services/math/parser/normalizer';
import { odePort } from '@/services/math/ports';
import type { CanonicalAST } from '@/services/math/types/ast';
import type { ODERequest } from '@/services/math/types/ode';

export interface OdeFormInput {
  expression: string;
  mode: 'symbolic' | 'numerical';
  includeInitialConditions: boolean;
  x0: string;
  y0: string;
  method: 'euler' | 'heun' | 'rk4';
  stepSize: string;
  steps: string;
}

function normalizeDerivativeNotation(text: string): string {
  return text
    .replace(/y'''/g, 'y_triple_prime')
    .replace(/y''/g, 'y_double_prime')
    .replace(/y'/g, 'y_prime');
}

function normalizeUnary(node: CanonicalAST): CanonicalAST {
  switch (node.type) {
    case 'Operator': {
      const args = node.args.map(normalizeUnary);
      if (node.operator === '-' && args.length === 1) {
        return {
          type: 'Operator',
          operator: '-',
          args: [{ type: 'Number', value: '0' }, args[0]],
        };
      }
      return { ...node, args };
    }
    case 'Equation':
      return {
        ...node,
        lhs: normalizeUnary(node.lhs),
        rhs: normalizeUnary(node.rhs),
      };
    case 'Function':
      return { ...node, args: node.args.map(normalizeUnary) };
    case 'Parenthesis':
      return { ...node, content: normalizeUnary(node.content) };
    default:
      return node;
  }
}

function numericField(text: string, name: string): number {
  if (!text.trim()) throw new Error(`${name} is required`);
  const value = Number(text);
  if (!Number.isFinite(value) || Math.abs(value) > 1_000_000) {
    throw new Error(`Invalid value for ${name}`);
  }
  return value;
}

export function buildOdeRequest(input: OdeFormInput): ODERequest {
  const expression = normalizeDerivativeNotation(input.expression.trim());

  if (!expression || expression.length > 500) {
    throw new Error('Enter an equation of at most 500 characters');
  }

  if (!/\by_(?:prime|double_prime|triple_prime)\b/.test(expression)) {
    throw new Error("Include y', y'' or y''' in the equation");
  }

  const parsed = normalizeUnary(
    new ASTNormalizer().normalize(
      new ExpressionParser().parse(expression),
      true,
    ),
  );

  if (parsed.type !== 'Equation') {
    throw new Error('Enter an equation with an equals sign');
  }

  const thirdOrder = /\by_triple_prime\b/.test(expression);
  const secondOrder = /\by_double_prime\b/.test(expression);

  if (input.mode === 'numerical' && (thirdOrder || secondOrder)) {
    throw new Error('Numerical mode currently supports first-order ODEs');
  }

  const request: ODERequest = {
    equation: parsed,
    independentVariable: 'x',
    dependentVariable: 'y',
    derivativeVariable: 'y_prime',
    mode: input.mode,
    maxDepth: 10,
    maxAttempts: 20,
    maxTransformations: 50,
  };

  if (thirdOrder) {
    request.higherDerivatives = [
      'y_double_prime',
      'y_triple_prime',
    ];
  } else if (secondOrder) {
    request.higherDerivatives = ['y_double_prime'];
  }

  if (input.includeInitialConditions || input.mode === 'numerical') {
    request.initialCondition = {
      x0: {
        type: 'Number',
        value: String(numericField(input.x0, 'x0')),
      },
      y0: {
        type: 'Number',
        value: String(numericField(input.y0, 'y0')),
      },
    };
  }

  if (input.mode === 'numerical') {
    const stepSize = numericField(input.stepSize, 'step size');
    const steps = numericField(input.steps, 'number of steps');

    if (
      stepSize <= 0 || stepSize > 2 ||
      !Number.isInteger(steps) || steps < 1 || steps > 1000
    ) {
      throw new Error('Use 0 < step size <= 2 and 1–1000 steps');
    }

    request.numericalConfig = {
      method: input.method,
      stepSize,
      steps,
    };
  }

  return request;
}

export async function solveODE(input: OdeFormInput) {
  return odePort.execute(buildOdeRequest(input));
}
