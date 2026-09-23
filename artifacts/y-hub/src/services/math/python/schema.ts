import { CanonicalAST } from '../types/ast';
import { Assumption } from '../types/problem';
import { MathStep } from '../types/step';

export const MATH_PROTOCOL_VERSION = "1.0.0";

/**
 * Defines the strict, validated JSON schema that the Python backend will accept.
 * Maps directly to PythonMathRequest in Pydantic.
 */
export interface PythonMathRequest {
  protocol_version: string; // Must match MATH_PROTOCOL_VERSION
  
  operation: 
    | 'evaluate' | 'simplify' | 'solve_equation' | 'solve_inequality'
    | 'solve_ode' | 'derive' | 'integrate' | 'limit' | 'eigenvalues' | 'matrix_rref';
  
  expression_ast: CanonicalAST;
  
  variables: string[];
  
  evaluation_points?: Record<string, CanonicalAST | number>;
  
  assumptions: Assumption[];
  
  limits: {
    timeout_ms: number;
    max_iterations: number;
    max_matrix_dimension: number;
    max_ast_depth: number;
    max_ast_nodes: number;
  };
}

export interface PythonMathResponse {
  success: boolean;
  operation_performed: string;
  result_ast?: CanonicalAST;
  result_latex?: string;
  computation_time_ms: number;
  steps: MathStep[];
  warnings: string[];
  error?: string;
  error_type?: string;
}
