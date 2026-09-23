export const MathSecurityLimits = {
  MAX_EXPRESSION_LENGTH: 500, // characters
  MAX_AST_DEPTH: 50,
  MAX_AST_NODES: 1000,
  MAX_MATRIX_DIMENSION: 100,
  MAX_NUMERICAL_ITERATIONS: 10000,
  TIMEOUT_MS_MAX: 10000, // absolute maximum, clamped by server
  TIMEOUT_MS_DEFAULT: 5000,
};

export class SecurityViolationError extends Error {
  constructor(message: string) {
    super(`Security Violation: ${message}`);
    this.name = 'SecurityViolationError';
  }
}
