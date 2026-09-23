import { LimitEngine } from '../symbolic/limit';
import { LimitRequest } from '../types/limit';
import { ExpressionParser } from '../parser';
import { ASTNormalizer } from '../parser/normalizer';

describe('CORE CALCULUS SUBPHASE 3D - L\'Hôpital\'s Rule', () => {
  const parser = new ExpressionParser();
  const normalizer = new ASTNormalizer();
  const engine = new LimitEngine();

  const createReq = (expr: string, variable: string, approach: any, direction: 'both' | 'left' | 'right' = 'both'): LimitRequest => ({
    expression: normalizer.normalize(parser.parse(expr)),
    variable,
    approach,
    direction
  });

  describe('1. Standard L\'Hôpital Limits (0/0)', () => {
    it('solves lim x->0 sin(x)/x = 1', () => {
      const res = engine.evaluateLimit(createReq('sin(x) / x', 'x', 0));
      expect(res.classification).toBe('finite');
      expect((res.value as any).value).toBe('1');
      expect(res.strategy).toBe('l_hopital');
    });

    it('solves lim x->0 (exp(x) - 1)/x = 1', () => {
      const res = engine.evaluateLimit(createReq('(exp(x) - 1) / x', 'x', 0));
      expect(res.classification).toBe('finite');
      expect((res.value as any).value).toBe('1');
      expect(res.strategy).toBe('l_hopital');
    });

    it('solves lim x->1 ln(x)/(x - 1) = 1', () => {
      const res = engine.evaluateLimit(createReq('ln(x) / (x - 1)', 'x', 1, 'right'));
      expect(res.classification).toBe('finite');
      expect((res.value as any).value).toBe('1');
      expect(res.strategy).toBe('l_hopital');
    });
  });

  describe('2. Repeated L\'Hôpital Limits', () => {
    it('solves lim x->0 (x - sin(x))/x^3 = 1/6 using multiple applications', () => {
      const res = engine.evaluateLimit(createReq('(x - sin(x)) / (x^3)', 'x', 0));
      expect(res.classification).toBe('finite');
      expect(parseFloat((res.value as any).value)).toBeCloseTo(1/6, 5);
      expect(res.strategy).toBe('l_hopital');
    });
  });

  describe('3. Infinity / Infinity Limits', () => {
    it('solves lim x->+infinity x/exp(x) = 0', () => {
      const res = engine.evaluateLimit(createReq('x / exp(x)', 'x', '+infinity'));
      expect(res.classification).toBe('finite');
      expect((res.value as any).value).toBe('0');
      expect(res.strategy).toBe('l_hopital');
    });

    it('solves lim x->+infinity ln(x)/x = 0', () => {
      const res = engine.evaluateLimit(createReq('ln(x) / x', 'x', '+infinity'));
      expect(res.classification).toBe('finite');
      expect((res.value as any).value).toBe('0');
      expect(res.strategy).toBe('l_hopital');
    });
  });

  describe('4. Protection and Unsupported Cases', () => {
    it('rejects 0 * infinity directly (must rearrange)', () => {
      const res = engine.evaluateLimit(createReq('x * ln(x)', 'x', 0, 'right'));
      expect(res.classification).toBe('unsupported');
      expect(res.warnings).toContain('requires_algebraic_rearrangement');
    });

    it('rejects exponential indeterminate forms like 1^inf', () => {
      const res = engine.evaluateLimit(createReq('(1 + x)^(1/x)', 'x', 0, 'right'));
      expect(res.classification).toBe('unsupported');
      expect(res.warnings).toContain('requires_exponential_form_strategy');
    });
    
    it('stops iterating if L\'Hôpital limit is exceeded (e.g. forced endless derivative)', () => {
      // Just test that the loop limit exists. We construct an expression that loops 
      // (exp(x) - x^4 - ...)/(x^4) would take 4 derivatives, but we set limit to 3.
      const res = engine.evaluateLimit(createReq('(exp(x) - 1 - x - (x^2)/2 - (x^3)/6 - (x^4)/24) / (x^5)', 'x', 0));
      expect(res.classification).toBe('unsupported');
      expect(res.warnings).toContain('l_hopital_iteration_limit_reached');
    });

    it('preserves absolute value behavior without blind L\'Hôpital |x|/x', () => {
      const res = engine.evaluateLimit(createReq('abs(x) / x', 'x', 0));
      expect(res.classification).toBe('does_not_exist');
    });
  });
});
