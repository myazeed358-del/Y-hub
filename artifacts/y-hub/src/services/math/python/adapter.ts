import { PythonMathRequest, PythonMathResponse, MATH_PROTOCOL_VERSION } from './schema';
import { MathProblemRequest } from '../types/problem';
import { MathSecurityLimits } from '../types/security';
import { CanonicalAST } from '../types/ast';

export class PythonMathAdapter {
  private endpoint: string;

  constructor(endpoint: string = 'http://localhost:8000/api/v1/math/compute') {
    this.endpoint = endpoint;
  }

  public async compute(request: MathProblemRequest): Promise<PythonMathResponse> {
    if (!request.expression) {
      throw new Error("Python Adapter requires a valid Canonical AST expression.");
    }

    const payload: PythonMathRequest = {
      protocol_version: MATH_PROTOCOL_VERSION,
      operation: this.mapOperation(request.operation),
      expression_ast: request.expression,
      variables: request.variable ? [request.variable] : [],
      evaluation_points: request.point && request.variable ? { [request.variable]: request.point } : undefined,
      assumptions: request.assumptions,
      limits: {
        timeout_ms: MathSecurityLimits.TIMEOUT_MS_DEFAULT,
        max_iterations: MathSecurityLimits.MAX_NUMERICAL_ITERATIONS,
        max_matrix_dimension: MathSecurityLimits.MAX_MATRIX_DIMENSION,
        max_ast_depth: MathSecurityLimits.MAX_AST_DEPTH,
        max_ast_nodes: MathSecurityLimits.MAX_AST_NODES
      }
    };

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Python API Error: ${response.statusText}`);
      }

      const data: PythonMathResponse = await response.json();
      return data;
    } catch (e: any) {
      return {
        success: false,
        operation_performed: payload.operation,
        computation_time_ms: 0,
        steps: [],
        warnings: [],
        error: e.message || 'Unknown network error communicating with Python backend',
        error_type: 'network_error'
      };
    }
  }

  private mapOperation(op: string): PythonMathRequest['operation'] {
    // Maps TS MathOperation to Python allowed operation
    const valid: PythonMathRequest['operation'][] = [
      'evaluate', 'simplify', 'solve_equation', 'solve_inequality',
      'solve_ode', 'derive', 'integrate', 'limit', 'eigenvalues', 'matrix_rref'
    ];
    if (valid.includes(op as any)) {
      return op as PythonMathRequest['operation'];
    }
    // Fallback or throw
    return 'evaluate';
  }
}
