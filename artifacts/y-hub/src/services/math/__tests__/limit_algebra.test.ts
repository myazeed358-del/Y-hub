import { LimitEngine } from '../symbolic/limit';
import { LimitRequest } from '../types/limit';
import { ExpressionParser } from '../parser';
import { ASTNormalizer } from '../parser/normalizer';

describe('CORE CALCULUS SUBPHASE 3B - Algebraic Limit Resolution', () => {
  const parser = new ExpressionParser();
  const normalizer = new ASTNormalizer();
  const engine = new LimitEngine();

  const createReq = (expr: string, variable: string, approach: any, direction: 'both' | 'left' | 'right' = 'both'): LimitRequest => ({
    expression: normalizer.normalize(parser.parse(expr)),
    variable,
    approach,
    direction
  });

  describe('1. Factoring & Safe Cancellation', () => {
    it('solves lim x->0 (x^2 - 4x)/x = -4', () => {
      const res = engine.evaluateLimit(createReq('(x^2 - 4*x) / x', 'x', 0));
      expect(res.classification).toBe('finite');
      expect((res.value as any).value).toBe('-4');
      expect(res.strategy).toBe('algebraic_resolution');
      expect(res.conditions).toContain('x != 0');
    });

    it('solves lim x->2 (x^2 - 4)/(x - 2) = 4', () => {
      const res = engine.evaluateLimit(createReq('(x^2 - 4) / (x - 2)', 'x', 2));
      expect(res.classification).toBe('finite');
      expect((res.value as any).value).toBe('4');
      expect(res.conditions).toContain('x != 2');
    });

    it('solves lim x->1 (x^2 - 1)/(x - 1) = 2', () => {
      const res = engine.evaluateLimit(createReq('(x^2 - 1) / (x - 1)', 'x', 1));
      expect(res.classification).toBe('finite');
      expect((res.value as any).value).toBe('2');
      expect(res.conditions).toContain('x != 1');
    });
  });

  describe('2. Rationalization', () => {
    it('solves lim x->0 (sqrt(x + 1) - 1)/x = 1/2', () => {
      const res = engine.evaluateLimit(createReq('(sqrt(x + 1) - 1) / x', 'x', 0));
      expect(res.classification).toBe('finite');
      expect(parseFloat((res.value as any).value)).toBeCloseTo(0.5, 5);
      expect(res.strategy).toBe('algebraic_resolution');
    });

    it('solves lim x->4 (sqrt(x) - 2)/(x - 4) = 1/4', () => {
      const res = engine.evaluateLimit(createReq('(sqrt(x) - 2) / (x - 4)', 'x', 4));
      expect(res.classification).toBe('finite');
      expect(parseFloat((res.value as any).value)).toBeCloseTo(0.25, 5);
      expect(res.strategy).toBe('algebraic_resolution');
    });
  });

  describe('3. Absolute Value Constraints', () => {
    it('simplifies |x| when x -> 2 to x', () => {
      const res = engine.evaluateLimit(createReq('abs(x) / x', 'x', 2));
      expect(res.classification).toBe('finite');
      expect((res.value as any).value).toBe('1');
    });

    it('simplifies |x| when x -> -2 to -x', () => {
      const res = engine.evaluateLimit(createReq('abs(x) / x', 'x', -2));
      expect(res.classification).toBe('finite');
      expect((res.value as any).value).toBe('-1');
    });

    it('identifies does_not_exist for lim x->0 abs(x)/x', () => {
      const res = engine.evaluateLimit(createReq('abs(x) / x', 'x', 0));
      expect(res.classification).toBe('does_not_exist');
    });
  });

  describe('4. Deliberately Unsupported (3B Limits)', () => {
    it('leaves sin(x)/x as indeterminate', () => {
      const res = engine.evaluateLimit(createReq('sin(x) / x', 'x', 0));
      expect(res.classification).toBe('indeterminate');
      expect(res.indeterminateForm).toBe('0/0');
      // Should NOT use L'Hopital yet or numeric probing as formal proof
      expect(res.strategy).toBe('direct_substitution');
    });

    it('leaves unsolvable factorizations as indeterminate', () => {
      // E.g., an arbitrary non-polynomial indeterminate form without conjugate
      const res = engine.evaluateLimit(createReq('(exp(x) - 1) / x', 'x', 0));
      expect(res.classification).toBe('indeterminate');
      expect(res.indeterminateForm).toBe('0/0');
    });
  });
});
