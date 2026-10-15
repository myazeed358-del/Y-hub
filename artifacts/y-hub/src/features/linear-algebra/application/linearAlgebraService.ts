import { linearAlgebraPort } from '@/services/math/ports';
import type { CanonicalAST } from '@/services/math/types/ast';
import type {
  LinearAlgebraRequest,
  LinearAlgebraResult,
} from '@/services/math/linear_algebra/types';

export type BasicLinearAlgebraOperation =
  | 'determinant'
  | 'inverse'
  | 'rref'
  | 'solve_system';

export interface LinearAlgebraFormInput {
  operation: BasicLinearAlgebraOperation;
  matrix: readonly (readonly string[])[];
  vector?: readonly string[];
}

const MAX_DIMENSION = 10;

function parseCell(raw: string): CanonicalAST {
  const value = raw.trim();

  const decimal = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/;
  const fraction = /^([+-]?\d+)\/([+-]?\d+)$/;

  if (decimal.test(value)) {
    return { type: 'Number', value };
  }

  const match = value.match(fraction);

  if (match) {
    if (BigInt(match[2]) === 0n) {
      throw new Error('Matrix entry has a zero denominator');
    }

    return { type: 'Number', value };
  }

  throw new Error(`Invalid matrix entry: ${value || '(empty)'}`);
}

export function buildLinearAlgebraRequest(
  input: LinearAlgebraFormInput
): LinearAlgebraRequest {
  const { matrix, operation, vector } = input;

  if (!Array.isArray(matrix) || matrix.length === 0) {
    throw new Error('Matrix must not be empty');
  }

  const columns = matrix[0]?.length ?? 0;

  if (
    columns === 0 ||
    matrix.length > MAX_DIMENSION ||
    columns > MAX_DIMENSION ||
    matrix.some(row => row.length !== columns)
  ) {
    throw new Error('Invalid matrix dimensions');
  }

  if (
    (operation === 'determinant' || operation === 'inverse') &&
    matrix.length !== columns
  ) {
    throw new Error('This operation requires a square matrix');
  }

  const request: LinearAlgebraRequest = {
    operation,
    matrices: [matrix.map(row => row.map(parseCell))],
    mode: 'exact',
  };

  if (operation === 'solve_system') {
    if (!vector || vector.length !== matrix.length) {
      throw new Error('Vector size must match matrix row count');
    }

    request.vectors = [vector.map(parseCell)];
  }

  return request;
}

export async function solveLinearAlgebra(
  input: LinearAlgebraFormInput
): Promise<LinearAlgebraResult> {
  const request = buildLinearAlgebraRequest(input);
  return linearAlgebraPort.execute(request);
}
