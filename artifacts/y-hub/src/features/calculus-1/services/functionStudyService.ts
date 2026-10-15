import { ExpressionParser } from '@/services/math/parser';
import { ASTNormalizer } from '@/services/math/parser/normalizer';
import { DerivativeEngine } from '@/services/math/symbolic/derivative';
import { ASTUtils } from '@/services/math/symbolic/utils';
import { functionAnalysisPort } from '@/services/math/ports/defaultPorts';
import type { CanonicalAST } from '@/services/math/types/ast';
import type { Endpoint, Interval } from '@/services/math/types/set';
import type { MathStep } from '@/services/math/types/step';
import {
  provePolynomialMonotonicity,
  type PolynomialMonotonicityProof
} from './polynomialMonotonicityProof';

export interface FunctionStudyResult {
  status: 'candidate_results';
  verification: 'not_proven';
  monotonicityProof: PolynomialMonotonicityProof;
  firstDerivative: string;
  secondDerivative: string;
  criticalPointCandidates: string[];
  increasingIntervalCandidates: string[];
  decreasingIntervalCandidates: string[];
  extremaCandidates: Array<{
    point: string;
    type: string;
  }>;
  concaveUpIntervalCandidates: string[];
  concaveDownIntervalCandidates: string[];
  inflectionCandidates: Array<{
    point: string;
    status: string;
  }>;
  steps: MathStep[];
  warnings: string[];
}

function isSupportedPolynomial(
  node: CanonicalAST,
  budget: { remaining: number }
): boolean {
  budget.remaining--;

  if (budget.remaining < 0) return false;

  if (node.type === 'Number') {
    return /^-?\d+(?:\.\d+)?$/.test(node.value) &&
      Number.isFinite(Number(node.value)) &&
      Math.abs(Number(node.value)) <= 1000000;
  }

  if (node.type === 'Symbol') {
    return node.name === 'x';
  }

  if (node.type === 'Parenthesis') {
    return isSupportedPolynomial(node.content, budget);
  }

  if (node.type !== 'Operator') return false;

  if (node.operator === '^') {
    if (node.args.length !== 2) return false;

    const exponent = node.args[1];

    return exponent.type === 'Number' &&
      /^\d+$/.test(exponent.value) &&
      Number(exponent.value) <= 12 &&
      isSupportedPolynomial(node.args[0], budget);
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
      isSupportedPolynomial(arg, budget)
    );
}

function endpointText(endpoint: Endpoint): string {
  if (endpoint.type === 'infinity') {
    return endpoint.sign === -1
      ? '-infinity'
      : '+infinity';
  }

  return ASTUtils.serialize(endpoint.ast);
}

function intervalText(interval: Interval): string {
  return (
    `${interval.leftClosed ? '[' : '('}` +
    `${endpointText(interval.left)}, ` +
    `${endpointText(interval.right)}` +
    `${interval.rightClosed ? ']' : ')'}`
  );
}

export async function studyCalculus1Function(
  expression: string
): Promise<FunctionStudyResult> {
  if (!expression.trim()) {
    throw new Error('Mathematical expression is required.');
  }

  const parser = new ExpressionParser();
  const normalizer = new ASTNormalizer();

  const original = normalizer.normalize(
    parser.parse(expression)
  );

  if (
    !isSupportedPolynomial(
      original,
      { remaining: 150 }
    )
  ) {
    throw new Error(
      'This version supports polynomial functions in x only.'
    );
  }

  // Fail explicitly rather than accepting an engine fallback
  // that might silently substitute a zero derivative.
  const derivativeEngine = new DerivativeEngine();
  const derivativeSteps: MathStep[] = [];

  const firstDerivative = derivativeEngine.differentiate(
    original,
    'x',
    derivativeSteps
  );

  const secondDerivative = derivativeEngine.differentiate(
    firstDerivative,
    'x',
    derivativeSteps
  );

  const monotonicityProof = provePolynomialMonotonicity(
    expression
  );

  const analysis = await functionAnalysisPort.execute({
    expression: original,
    variable: 'x',
    mode: 'real'
  });

  return {
    status: 'candidate_results',
    verification: 'not_proven',
    monotonicityProof,
    firstDerivative: ASTUtils.serialize(firstDerivative),
    secondDerivative: ASTUtils.serialize(secondDerivative),

    criticalPointCandidates: (
      analysis.criticalPoints ?? []
    ).map(item => endpointText(item.point)),

    increasingIntervalCandidates: (
      analysis.increasingIntervals ?? []
    ).map(intervalText),

    decreasingIntervalCandidates: (
      analysis.decreasingIntervals ?? []
    ).map(intervalText),

    extremaCandidates: (
      analysis.extrema ?? []
    ).map(item => ({
      point: endpointText(item.point),
      type: item.type
    })),

    concaveUpIntervalCandidates: (
      analysis.concaveUpIntervals ?? []
    ).map(intervalText),

    concaveDownIntervalCandidates: (
      analysis.concaveDownIntervals ?? []
    ).map(intervalText),

    inflectionCandidates: (
      analysis.inflectionPoints ?? []
    ).map(item => ({
      point: endpointText(item.point),
      status: item.status
    })),

    steps: [...derivativeSteps, ...analysis.steps],

    warnings: [
      'The candidate sections are not independently verified. Any separate exact proof applies only to its stated scope.',
      'An empty candidate list does not prove that no such points or intervals exist.',
      'Critical points, monotonicity and extrema require additional completeness checks.',
      'This version does not establish global extrema or a complete function study.'
    ]
  };
}
