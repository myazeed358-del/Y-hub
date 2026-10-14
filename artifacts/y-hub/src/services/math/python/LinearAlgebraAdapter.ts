import type { LinearAlgebraRequest, LinearAlgebraResult } from '../linear_algebra/types';
import { PHASE_MATH_ENDPOINT, postPhaseMath } from './phaseClient';
import { mapLinearAlgebraResponse, toPythonMatrix } from './linearAlgebraMapping';

/** Python acceleration is optional; an incomplete or unsupported result falls back to TS. */
export class LinearAlgebraAdapter {
  constructor(private readonly endpoint: string = PHASE_MATH_ENDPOINT) {}

  public async executePython(req: LinearAlgebraRequest): Promise<LinearAlgebraResult | null> {
    // Implemented, validated Python result mappings only. No partial 'solved' shells.
    if (!['rref', 'inverse', 'determinant', 'svd'].includes(req.operation)) return null;
    if (req.operation === 'svd' && req.mode !== 'numerical') return null;
    if (req.operation !== 'svd' && req.mode === 'numerical') return null;

    const numerical = req.mode === 'numerical';
    const matrices = [];
    for (const matrix of req.matrices) {
      const converted = toPythonMatrix(matrix, numerical);
      if (converted === null) return null; // Never fabricate zero for symbolic entries.
      matrices.push(converted);
    }
    if (!matrices.length) return null;

    const response = await postPhaseMath(this.endpoint, {
      operation: req.operation,
      phase: '10',
      mode: numerical ? 'numerical' : 'exact',
      input: { matrices },
    }, 10000);
    return response ? mapLinearAlgebraResponse(req, response) : null;
  }
}
