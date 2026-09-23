import { LimitEngine } from '../symbolic/limit';
import { LimitRequest } from '../types/limit';
import { ExpressionParser } from '../parser';
import { ASTNormalizer } from '../parser/normalizer';

describe('CORE CALCULUS SUBPHASE 3C - Asymptotic Limit Engine', () => {
  const parser = new ExpressionParser();
  const normalizer = new ASTNormalizer();
  const engine = new LimitEngine();

  const createReq = (expr: string, variable: string, approach: any, direction: 'both' | 'left' | 'right' = 'both'): LimitRequest => ({
    expression: normalizer.normalize(parser.parse(expr)),
    variable,
    approach,
    direction
  });

  describe('1. Polynomial Limits at Infinity', () => {
    it('solves polynomial -> +infinity', () => {
      const res = engine.evaluateLimit(createReq('3*x^2 + 5*x - 7', 'x', '+infinity'));
      expect(res.classification).toBe('+infinity');
    });

    it('solves polynomial -> -infinity', () => {
      const res = engine.evaluateLimit(createReq('3*x^2 + 5*x - 7', 'x', '-infinity'));
      expect(res.classification).toBe('+infinity'); // even degree
    });

    it('solves sign-sensitive cubic at -infinity', () => {
      const res = engine.evaluateLimit(createReq('x^3 - 4*x', 'x', '-infinity'));
      expect(res.classification).toBe('-infinity');
    });
  });

  describe('2. Rational Limits at Infinity', () => {
    it('solves rational with equal degree (3x^2+1)/(5x^2-7) -> 3/5', () => {
      const res = engine.evaluateLimit(createReq('(3*x^2 + 1) / (5*x^2 - 7)', 'x', '+infinity'));
      expect(res.classification).toBe('finite');
      expect(parseFloat((res.value as any).value)).toBeCloseTo(0.6, 5);
      expect(res.strategy).toBe('asymptotic_analysis');
    });

    it('solves rational with deg(num) < deg(den) (2x+1)/(x^2+4) -> 0', () => {
      const res = engine.evaluateLimit(createReq('(2*x + 1) / (x^2 + 4)', 'x', '+infinity'));
      expect(res.classification).toBe('finite');
      expect((res.value as any).value).toBe('0');
    });

    it('solves rational with deg(num) > deg(den) (x^3)/(x^2+1) at +infinity -> +infinity', () => {
      const res = engine.evaluateLimit(createReq('(x^3) / (x^2 + 1)', 'x', '+infinity'));
      expect(res.classification).toBe('+infinity');
    });

    it('solves rational with deg(num) > deg(den) (x^3)/(x^2+1) at -infinity -> -infinity', () => {
      const res = engine.evaluateLimit(createReq('(x^3) / (x^2 + 1)', 'x', '-infinity'));
      expect(res.classification).toBe('-infinity');
    });

    it('handles expressions needing safe normalization (x^3 - x)/(x^2 - x)', () => {
      const res = engine.evaluateLimit(createReq('(x^3 - x) / (x^2 - x)', 'x', '+infinity'));
      expect(res.classification).toBe('+infinity');
    });
  });

  describe('3. Radical Limits at Infinity', () => {
    it('evaluates sqrt(x^2)/x at +infinity to 1', () => {
      const res = engine.evaluateLimit(createReq('sqrt(x^2) / x', 'x', '+infinity'));
      expect(res.classification).toBe('finite');
      expect((res.value as any).value).toBe('1');
    });

    it('evaluates sqrt(x^2)/x at -infinity to -1 (via absolute value replacement)', () => {
      const res = engine.evaluateLimit(createReq('sqrt(x^2) / x', 'x', '-infinity'));
      expect(res.classification).toBe('finite');
      expect((res.value as any).value).toBe('-1');
    });

    it('rationalizes sqrt(x^2 + 1) - x at +infinity', () => {
      const res = engine.evaluateLimit(createReq('sqrt(x^2 + 1) - x', 'x', '+infinity'));
      expect(res.classification).toBe('finite');
      expect((res.value as any).value).toBe('0');
    });
  });

  describe('4. Identical Limit Simplification', () => {
    it('simplifies x/x at infinity to 1', () => {
      const res = engine.evaluateLimit(createReq('x / x', 'x', '+infinity'));
      expect(res.classification).toBe('finite');
      expect((res.value as any).value).toBe('1');
    });

    it('simplifies x^2 - x^2 at infinity to 0', () => {
      const res = engine.evaluateLimit(createReq('x^2 - x^2', 'x', '+infinity'));
      expect(res.classification).toBe('finite');
      expect((res.value as any).value).toBe('0');
    });
  });

  describe('5. Unsupported Cases', () => {
    it('leaves transcendental asymptotics unresolved', () => {
      const res = engine.evaluateLimit(createReq('exp(x) / x', 'x', '+infinity'));
      expect(res.classification).toBe('indeterminate');
      expect(res.indeterminateForm).toBe('inf/inf');
    });
  });
});
