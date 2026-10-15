import { describe, expect, it } from 'vitest';
import { ExpressionParser } from '@/services/math/parser';
import { ASTNormalizer } from '@/services/math/parser/normalizer';
import {
  proveAbsoluteValueAtZero
} from '../services/absoluteValueZeroProof';

function prove(expression: string) {
  const parser = new ExpressionParser();
  const normalizer = new ASTNormalizer();
  const ast = normalizer.normalize(
    parser.parse(expression)
  );

  return proveAbsoluteValueAtZero(ast, 'x');
}

describe('Exact absolute value proof at zero', () => {
  it('proves abs(x) is not differentiable', () => {
    const result = prove('abs(x)');

    expect(result.status).toBe('proved_not_differentiable');

    if (result.status === 'proved_not_differentiable') {
      expect(result.leftDerivative).toBe('-1');
      expect(result.rightDerivative).toBe('1');
    }
  });

  it('proves abs(x^2) is differentiable', () => {
    const result = prove('abs(x^2)');

    expect(result.status).toBe('proved_differentiable');

    if (result.status === 'proved_differentiable') {
      expect(result.derivative).toBe('0');
    }
  });

  it('proves abs(x^3) is differentiable at zero', () => {
    const result = prove('abs(x^3)');
    expect(result.status).toBe('proved_differentiable');
  });

  it('proves abs(2*x) has distinct one-sided derivatives', () => {
    const result = prove('abs(2*x)');

    expect(result.status).toBe('proved_not_differentiable');

    if (result.status === 'proved_not_differentiable') {
      expect(result.leftDerivative).toBe('-2');
      expect(result.rightDerivative).toBe('2');
    }
  });

  it('handles nonzero polynomial values', () => {
    const result = prove('abs(1-x)');

    expect(result.status).toBe('proved_differentiable');

    if (result.status === 'proved_differentiable') {
      expect(result.derivative).toBe('-1');
    }
  });

  it('does not claim a proof for abs(sin(x))', () => {
    expect(prove('abs(sin(x))').status).toBe('not_proven');
  });

  it('does not mistake sqrt(x^2) for an explicit abs', () => {
    expect(prove('sqrt(x^2)').status).toBe('not_proven');
  });

  it('rejects unsupported rational functions', () => {
    expect(prove('abs(1/x)').status).toBe('not_proven');
  });
});
