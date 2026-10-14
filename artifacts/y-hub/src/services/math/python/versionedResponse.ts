import type { PythonMathResponse, PythonMathRequest } from './schema';

/** This contract is separate from phaseClient.ts's API contract. */
export function isVersionedMathResponse(
  input: unknown,
  operation: PythonMathRequest['operation'],
): input is PythonMathResponse {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return false;
  const response = input as Record<string, unknown>;
  if (typeof response.success !== 'boolean' ||
      response.operation_performed !== operation ||
      typeof response.computation_time_ms !== 'number' ||
      !Number.isFinite(response.computation_time_ms) ||
      !Array.isArray(response.steps) ||
      !Array.isArray(response.warnings) ||
      !response.warnings.every(item => typeof item === 'string')) return false;
  if (response.success) {
    const ast = response.result_ast;
    // Full recursive AST/domain validation belongs to the specialised operation.
    return !!ast && typeof ast === 'object' && !Array.isArray(ast) &&
      typeof (ast as Record<string, unknown>).type === 'string';
  }
  return typeof response.error === 'string' || typeof response.error_type === 'string';
}
