import type { CanonicalAST } from '../types/ast';
import type { LinearAlgebraRequest, LinearAlgebraResult, SVDResult } from '../linear_algebra/types';
import type { PhaseMathResponse } from './phaseClient';

/** Refuse to send symbolic entries as numeric zeros to Python. */
export function toPythonMatrix(matrix: CanonicalAST[][], numerical: boolean): (number | string)[][] | null {
  const rows: (number | string)[][] = [];
  if (!matrix.length || !matrix[0]?.length) return null;
  const width = matrix[0].length;
  for (const row of matrix) {
    if (row.length !== width) return null;
    const converted: (number | string)[] = [];
    for (const cell of row) {
      const text = finiteNumericExpression(cell);
      if (text === null) return null;
      if (numerical) {
        const [n, d] = text.split('/').map(Number);
        const value = d === undefined ? n : n / d;
        if (!Number.isFinite(value)) return null;
        converted.push(value);
      } else {
        converted.push(text);
      }
    }
    rows.push(converted);
  }
  return rows;
}

function finiteNumericExpression(node: CanonicalAST): string | null {
  if (node.type === 'Number') {
    const value = node.value.trim();
    const numeric = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
    const fraction = /^([+-]?\d+)\/([1-9]\d*)$/;
    if (numeric.test(value) && Number.isFinite(Number(value))) return value;
    const match = value.match(fraction);
    if (match && Number.isFinite(Number(match[1]) / Number(match[2]))) return value;
    return null;
  }
  // Preserve the standard CanonicalAST representation for a signed constant.
  if (node.type === 'Operator' && node.operator === '-' && node.args.length === 2 &&
      node.args[0].type === 'Number' && node.args[0].value === '0') {
    const part = finiteNumericExpression(node.args[1]);
    if (part === null) return null;
    // Negate the exact textual rational instead of rounding via Number.
    return part.startsWith('-') ? part.slice(1) : `-${part}`;
  }
  if (node.type === 'Operator' && node.operator === '/' && node.args.length === 2) {
    const a = finiteNumericExpression(node.args[0]);
    const b = finiteNumericExpression(node.args[1]);
    if (a === null || b === null || Number(b) === 0) return null;
    // Keep exact rational expressions intact when the AST contains integers.
    if (/^[+-]?\d+$/.test(a) && /^[+-]?\d+$/.test(b)) return `${a}/${b}`;
    const value = Number(a) / Number(b);
    return Number.isFinite(value) ? String(value) : null;
  }
  return null;
}

export function fromPythonScalar(value: unknown): CanonicalAST | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  // JSON cannot represent large integers exactly as JavaScript numbers.
  if (typeof value === 'number' && Number.isInteger(value) && !Number.isSafeInteger(value)) return null;
  const text = String(value).trim();
  if (/^[+-]?\d+\/[1-9]\d*$/.test(text)) {
    const [numerator, denominator] = text.split('/');
    if (numerator.startsWith('-')) {
      return { type: 'Operator', operator: '-', args: [
        { type: 'Number', value: '0' },
        { type: 'Operator', operator: '/', args: [
          { type: 'Number', value: numerator.slice(1) },
          { type: 'Number', value: denominator },
        ] },
      ] };
    }
    return { type: 'Operator', operator: '/', args: [
      { type: 'Number', value: numerator },
      { type: 'Number', value: denominator },
    ] };
  }
  if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text) &&
      Number.isFinite(Number(text))) {
    return { type: 'Number', value: text };
  }
  return null;
}

function astMatrix(value: unknown): CanonicalAST[][] | null {
  if (!Array.isArray(value) || !value.length) return null;
  const matrix: CanonicalAST[][] = [];
  let width: number | null = null;
  for (const row of value) {
    if (!Array.isArray(row) || !row.length) return null;
    if (width !== null && row.length !== width) return null;
    width = row.length;
    const mapped = row.map(fromPythonScalar);
    if (mapped.some(v => v === null)) return null;
    matrix.push(mapped as CanonicalAST[]);
  }
  return matrix;
}

function finiteNumberMatrix(value: unknown): value is number[][] {
  return Array.isArray(value) && value.length > 0 && value.every(row =>
    Array.isArray(row) && row.length > 0 && row.every((x: unknown) =>
      typeof x === 'number' && Number.isFinite(x))
  );
}

function svdResult(value: unknown): SVDResult | null {
  if (!value || typeof value !== 'object') return null;
  const obj = value as Record<string, unknown>;
  if (!finiteNumberMatrix(obj.U) || !finiteNumberMatrix(obj.V) ||
      !Array.isArray(obj.Sigma) || !obj.Sigma.length ||
      !obj.Sigma.every(x => typeof x === 'number' && Number.isFinite(x)) ||
      typeof obj.rank !== 'number' || !Number.isInteger(obj.rank) || obj.rank < 0) return null;
  const sigma = obj.Sigma as number[];
  if (obj.rank > sigma.length) return null;
  return { U: obj.U, Sigma: sigma, V: obj.V, rank: obj.rank };
}

/** Only accept successful responses if their mathematical result was fully mapped. */
export function mapLinearAlgebraResponse(
  req: LinearAlgebraRequest,
  response: PhaseMathResponse,
): LinearAlgebraResult | null {
  if (response.operation !== req.operation || response.phase !== '10' ||
      (response.status !== 'solved' && response.status !== 'completed') ||
      (response.errors?.length ?? 0) > 0) return null;
  const base = {
    operation: req.operation,
    status: 'solved' as const,
    exactness: response.exactness || 'exact_symbolic' as const,
    explanationSteps: response.steps || [],
    warnings: response.warnings || [],
  };
  switch (req.operation) {
    case 'rref':
    case 'inverse': {
      const resultMatrix = astMatrix(response.result);
      return resultMatrix ? { ...base, resultMatrix } : null;
    }
    case 'determinant': {
      const resultScalar = fromPythonScalar(response.result);
      return resultScalar ? { ...base, resultScalar } : null;
    }
    case 'svd': {
      if (req.mode !== 'numerical') return null;
      const svd = svdResult(response.result);
      return svd ? { ...base, svd, exactness: 'numerical_approximation' } : null;
    }
    // Exact eigen and system solution payloads need dedicated AST/Rational mapping.
    // Do not return a shell marked as solved: let the TS implementation handle them.
    default:
      return null;
  }
}
