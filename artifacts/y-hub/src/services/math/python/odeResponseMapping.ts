import type { CanonicalAST } from '../types/ast';
import type { ODERequest, ODEResult, ODEStep, SystemODERequest, SystemODEResult } from '../types/ode';
import type { PhaseMathResponse } from './phaseClient';

/** Reject truncated or malformed ASTs before exposing a Python result as solved. */
function isAST(value: unknown, depth = 0): value is CanonicalAST {
  if (!value || typeof value !== 'object' || Array.isArray(value) || depth > 64) return false;
  const node = value as Record<string, unknown>;
  const sub = (child: unknown) => isAST(child, depth + 1);
  const children = (items: unknown) => Array.isArray(items) && items.every(sub);
  switch (node.type) {
    case 'Number': return typeof node.value === 'string';
    case 'Symbol':
    case 'Constant': return typeof node.name === 'string';
    case 'Operator': return typeof node.operator === 'string' && children(node.args);
    case 'Function': return typeof node.name === 'string' && children(node.args);
    case 'Parenthesis': return sub(node.content);
    case 'Equation':
    case 'Inequality': return sub(node.lhs) && sub(node.rhs);
    case 'Matrix': return Array.isArray(node.rows) && node.rows.every(children);
    case 'Vector': return children(node.elements);
    default: return false;
  }
}

function steps(response: PhaseMathResponse, original: CanonicalAST, resulting: CanonicalAST): ODEStep[] {
  if (!Array.isArray(response.steps)) return [];
  return response.steps.map(step => {
    const text = step && typeof step === 'object' &&
      typeof (step as Record<string, unknown>).description === 'string'
      ? (step as { description: string }).description : 'Python symbolic solution';
    return {
      strategy: 'Python SymPy', inputExpression: original,
      transformation: text, resultingExpression: resulting,
    };
  });
}

/** Python phase 7 returns right-hand-side ASTs, not ODESolution objects. */
export function mapExactODE(req: ODERequest, response: PhaseMathResponse): ODEResult | null {
  if (response.phase !== '7' || response.operation !== 'solve_ode' ||
      response.status !== 'solved' || !Array.isArray(response.result) ||
      !response.result.length || !response.result.every(isAST)) return null;
  const solutions: ODEResult['solutions'] = response.result.map(rhs => ({
    type: 'explicit',
    equation: { type: 'Equation', lhs: { type: 'Symbol', name: req.dependentVariable }, rhs },
    domain: null,
    assumptions: [],
  }));
  return {
    request: req,
    classification: req.higherDerivatives?.length ? 'HIGHER_ORDER' : 'FIRST_ORDER',
    solutions,
    trace: steps(response, req.equation, solutions[0].equation),
    warnings: response.warnings || [],
    status: 'exact_symbolic',
  };
}

/** Python phase 9 returns one RHS AST per dependent variable. */
export function mapExactSystemODE(req: SystemODERequest, response: PhaseMathResponse): SystemODEResult | null {
  if (response.phase !== '9' || response.operation !== 'solve_system_ode' ||
      response.status !== 'solved' || !Array.isArray(response.result) ||
      response.result.length !== req.dependentVariables.length ||
      !response.result.length || !response.result.every(isAST)) return null;
  const equations: CanonicalAST[] = response.result.map((rhs, index) => ({
    type: 'Equation', lhs: { type: 'Symbol', name: req.dependentVariables[index] }, rhs,
  }));
  return {
    request: req,
    classification: 'SYSTEM_FIRST_ORDER',
    solutions: [{ type: 'explicit', equations }],
    trace: steps(response, req.equations[0], equations[0]),
    warnings: response.warnings || [],
    status: 'exact_symbolic',
  };
}
