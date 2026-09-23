import { LimitEngine } from '../symbolic/limit';
import { LimitRequest } from '../types/limit';
import { ExpressionParser } from '../parser';
import { ASTNormalizer } from '../parser/normalizer';

describe('CORE CALCULUS SUBPHASE 3F - Exponential and Logarithmic Limits', () => {
  const parser = new ExpressionParser();
  const normalizer = new ASTNormalizer();
  const engine = new LimitEngine();

  const createReq = (expr: string, variable: string, approach: any, direction: 'both' | 'left' | 'right' = 'both'): LimitRequest => ({
    expression: normalizer.normalize(parser.parse(expr)),
    variable,
    approach,
    direction
  });

  describe('1. Logarithmic Transformations', () => {
    it('solves 1^infinity: lim x->0 (1+x)^(1/x) = e', () => {
      const res = engine.evaluateLimit(createReq('(1 + x)^(1/x)', 'x', 0));
      expect(res.classification).toBe('finite');
      expect(parseFloat((res.value as any).value)).toBeCloseTo(Math.E, 5);
      
      const transformed = res.steps.some((s: any) => s.transformation && s.transformation.method === 'exponential_logarithmic_transformation');
      expect(transformed).toBe(true);
    });

    it('solves 0^0: lim x->0+ x^x = 1', () => {
      const res = engine.evaluateLimit(createReq('x^x', 'x', 0, 'right'));
      expect(res.classification).toBe('finite');
      expect(parseFloat((res.value as any).value)).toBeCloseTo(1, 5);
      
      const rearranged = res.steps.some((s: any) => s.transformation && s.transformation.method === 'product_rearrangement');
      expect(rearranged).toBe(true);
    });

    it('solves infinity^0: lim x->+infinity x^(1/x) = 1', () => {
      const res = engine.evaluateLimit(createReq('x^(1/x)', 'x', '+infinity'));
      expect(res.classification).toBe('finite');
      expect(parseFloat((res.value as any).value)).toBeCloseTo(1, 5);
    });
    
    it('rejects negative/sign-changing base for real logarithmic transformation', () => {
      const res = engine.evaluateLimit(createReq('x^x', 'x', 0, 'both'));
      // The left limit x->0- of x^x will fail the positivity check, 
      // thus it evaluates as unsupported/does_not_exist for both.
      expect(['does_not_exist', 'unsupported']).toContain(res.classification);
    });
  });

  describe('2. Direct Quotients and Products', () => {
    it('solves lim x->0 (e^x - 1)/x = 1', () => {
      const res = engine.evaluateLimit(createReq('(exp(x) - 1) / x', 'x', 0));
      expect(res.classification).toBe('finite');
      expect(parseFloat((res.value as any).value)).toBeCloseTo(1, 5);
    });

    it('solves lim x->0 (e^(3x) - 1)/x = 3', () => {
      const res = engine.evaluateLimit(createReq('(exp(3*x) - 1) / x', 'x', 0));
      expect(res.classification).toBe('finite');
      expect(parseFloat((res.value as any).value)).toBeCloseTo(3, 5);
    });

    it('solves lim x->0 ln(1+x)/x = 1', () => {
      const res = engine.evaluateLimit(createReq('ln(1 + x) / x', 'x', 0));
      expect(res.classification).toBe('finite');
      expect(parseFloat((res.value as any).value)).toBeCloseTo(1, 5);
    });

    it('solves lim x->0 ln(1+4x)/x = 4', () => {
      const res = engine.evaluateLimit(createReq('ln(1 + 4*x) / x', 'x', 0));
      expect(res.classification).toBe('finite');
      expect(parseFloat((res.value as any).value)).toBeCloseTo(4, 5);
    });
  });

  describe('3. Regressions', () => {
    it('regression: lim x->0 sin(x)/x = 1', () => {
      const res = engine.evaluateLimit(createReq('sin(x) / x', 'x', 0));
      expect(res.classification).toBe('finite');
      expect((res.value as any).value).toBe('1');
    });

    it('regression: lim x->0 (1-cos(x))/x^2 = 1/2', () => {
      const res = engine.evaluateLimit(createReq('(1 - cos(x)) / (x^2)', 'x', 0));
      expect(res.classification).toBe('finite');
      expect(parseFloat((res.value as any).value)).toBeCloseTo(0.5, 5);
    });

    it('regression: lim x->+infinity x/e^x = 0', () => {
      const res = engine.evaluateLimit(createReq('x / exp(x)', 'x', '+infinity'));
      expect(res.classification).toBe('finite');
      expect((res.value as any).value).toBe('0');
    });
  });
});
