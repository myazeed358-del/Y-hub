import { describe, expect, it } from 'vitest';
import { ExpressionParser } from '@/services/math/parser';
import { ASTNormalizer } from '@/services/math/parser/normalizer';
import { DerivativeEngine } from '@/services/math/symbolic/derivative';
import {
  assessDerivativeDomain
} from '../services/derivativeDomainAssessment';

async function assess(expression: string) {
  const parser = new ExpressionParser();
  const normalizer = new ASTNormalizer();

  const original = normalizer.normalize(
    parser.parse(expression)
  );

  const derivative = new DerivativeEngine().differentiate(
    original,
    'x',
    []
  );

  return assessDerivativeDomain(
    original,
    derivative,
    'x'
  );
}

describe('Zero-point proof integration', () => {
  it('proves abs(x) is not differentiable at zero', async () => {
    const result = await assess('abs(x)');

    expect(result.differentiability.exceptionalPoints)
      .toBe('zero_checked');

    expect(result.differentiability.zeroPoint?.status)
      .toBe('proved_not_differentiable');

    expect(result.differentiability.status)
      .toBe('not_proven');
  });

  it('proves abs(x^2) is differentiable at zero', async () => {
    const result = await assess('abs(x^2)');

    expect(result.differentiability.exceptionalPoints)
      .toBe('zero_checked');

    expect(result.differentiability.zeroPoint?.status)
      .toBe('proved_differentiable');

    const proof = result.differentiability.zeroPoint;

    if (proof?.status === 'proved_differentiable') {
      expect(proof.derivative).toBe('0');
    }

    expect(result.differentiability.status)
      .toBe('not_proven');
  });

  it('keeps unsupported absolute functions unresolved', async () => {
    const result = await assess('abs(sin(x))');

    expect(result.differentiability.zeroPoint?.status)
      .toBe('not_proven');

    expect(result.differentiability.exceptionalPoints)
      .toBe('not_checked');
  });

  it('does not fabricate a proof for sin(x)', async () => {
    const result = await assess('sin(x)');

    expect(result.differentiability.zeroPoint)
      .toBeUndefined();

    expect(result.differentiability.exceptionalPoints)
      .toBe('not_checked');
  });

  it('does not treat sqrt(x^2) as an explicit abs proof', async () => {
    const result = await assess('sqrt(x^2)');

    expect(result.differentiability.zeroPoint)
      .toBeUndefined();

    expect(result.differentiability.status)
      .toBe('not_proven');
  });
});
