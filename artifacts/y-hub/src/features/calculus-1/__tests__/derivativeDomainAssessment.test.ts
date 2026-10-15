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
    original, 'x', []
  );

  return assessDerivativeDomain(original, derivative, 'x');
}

describe('Derivative domain assessment orchestration', () => {
  it('combines multiple domain constraints', async () => {
    const result = await assess(
      'ln(x-2)+sqrt(x+1)'
    );

    expect(result.scope).toBe('candidate_constraints');
    expect(result.originalDomain.status).toBe(
      'candidate_intervals'
    );

    if (result.originalDomain.status === 'candidate_intervals') {
      expect(result.originalDomain.intervals).toHaveLength(1);

      const left = result.originalDomain.intervals[0].left;

      expect(left.type).toBe('value');

      if (left.type === 'value') {
        expect(left.rational?.num).toBe(2n);
        expect(left.rational?.den).toBe(1n);
      }

      expect(
        result.originalDomain.intervals[0].leftClosed
      ).toBe(false);
    }

    expect(result.differentiability.status).toBe(
      'not_proven'
    );
  });

  it('keeps the sqrt domain separate from differentiability', async () => {
    const result = await assess('sqrt(x)');

    expect(result.originalDomain.status).toBe(
      'candidate_intervals'
    );

    expect(result.differentiability.exceptionalPoints).toBe(
      'not_checked'
    );
  });

  it('does not certify the cusp of abs(x)', async () => {
    const result = await assess('abs(x)');

    expect(result.differentiability.status).toBe(
      'not_proven'
    );
  });

  it('does not reject the differentiable case abs(x^2)', async () => {
    const result = await assess('abs(x^2)');

    expect(result.differentiability.status).toBe(
      'not_proven'
    );
  });

  it('preserves unresolved variable-power assumptions', async () => {
    const result = await assess('x^x');

    expect(result.originalDomain.status).toBe(
      'undetermined'
    );
  });

  it('does not mistake missing constraints for a proof', async () => {
    const result = await assess('sin(x)');

    expect(result.originalDomain.status).toBe(
      'no_extracted_constraints'
    );

    expect(result.differentiability.status).toBe(
      'not_proven'
    );
  });
});
