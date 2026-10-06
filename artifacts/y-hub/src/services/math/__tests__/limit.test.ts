import { LimitEngine } from '../symbolic/limit';
import { LimitRequest } from '../types/limit';
import { ExpressionParser } from '../parser';
import { ASTNormalizer } from '../parser/normalizer';

describe('CORE CALCULUS SUBPHASE 3A - Limit Engine Direct Substitution', () => {
  const parser = new ExpressionParser();
  const normalizer = new ASTNormalizer();
  const engine = new LimitEngine();

  const createReq = (expr: string, variable: string, approach: any, direction: 'both' | 'left' | 'right' = 'both'): LimitRequest => ({
    expression: normalizer.normalize(parser.parse(expr)),
    variable,
    approach,
    direction
  });

  describe('Direct Substitution - Finite & Continuous', () => {
    it('evaluates polynomial limits', () => {
      const res = engine.evaluateLimit(createReq('x^2 + 2*x + 1', 'x', 2));
      expect(res.classification).toBe('finite');
      expect((res.value as any).value).toBe('9'); // 2^2 + 4 + 1
    });

    it('evaluates exponential limits', () => {
      const res = engine.evaluateLimit(createReq('exp(x)', 'x', 0));
      expect(res.classification).toBe('finite');
      expect((res.value as any).value).toBe('1');
    });
  });

  describe('Vertical Asymptotes & Directional Infinities', () => {
    it('classifies 1/x at 0+ as +infinity', () => {
      const res = engine.evaluateLimit(createReq('1/x', 'x', 0, 'right'));
      expect(res.classification).toBe('+infinity');
    });

    it('classifies 1/x at 0- as -infinity', () => {
      const res = engine.evaluateLimit(createReq('1/x', 'x', 0, 'left'));
      expect(res.classification).toBe('-infinity');
    });

    it('classifies 1/x at 0 as does_not_exist', () => {
      const res = engine.evaluateLimit(createReq('1/x', 'x', 0, 'both'));
      expect(res.classification).toBe('does_not_exist');
    });

    it('classifies 1/x^2 at 0 as +infinity from both sides', () => {
      const res = engine.evaluateLimit(createReq('1/(x^2)', 'x', 0, 'both'));
      expect(res.classification).toBe('+infinity');
    });
  });

  describe('Resolved Indeterminate Forms', () => {
    it('solves sin(x)/x at 0', () => {
      const res = engine.evaluateLimit(createReq('sin(x)/x', 'x', 0));
      expect(res.classification).toBe('finite');
      expect((res.value as any).value).toBe('1');
    });

    it('solves removable 0/0 rational limits', () => {
      const res = engine.evaluateLimit(createReq('(x^2 - 1)/(x - 1)', 'x', 1));
      expect(res.classification).toBe('finite');
      expect((res.value as any).value).toBe('2');
    });

    it('solves infinity/infinity rational limits', () => {
      const res = engine.evaluateLimit(createReq('x / (x + 1)', 'x', '+infinity'));
      expect(res.classification).toBe('finite');
      expect(parseFloat((res.value as any).value)).toBeCloseTo(1, 10);
    });

    it('solves 0^0 form', () => {
      const res = engine.evaluateLimit(createReq('x^x', 'x', 0, 'right'));
      expect(res.classification).toBe('finite');
      expect(parseFloat((res.value as any).value)).toBeCloseTo(1, 10);
    });

    it('solves 1^infinity form', () => {
      const res = engine.evaluateLimit(createReq('(1 + x)^(1/x)', 'x', 0, 'right'));
      expect(res.classification).toBe('finite');
      expect(parseFloat((res.value as any).value)).toBeCloseTo(Math.E, 5);
    });
  });

  describe('Out of Domain / Undefined', () => {
    it('classifies sqrt(x) at -1 as undefined in real mode', () => {
      const res = engine.evaluateLimit(createReq('sqrt(x)', 'x', -1));
      expect(res.classification).toBe('undefined');
    });

    it('classifies sqrt(x) at 0- as undefined', () => {
      const res = engine.evaluateLimit(createReq('sqrt(x)', 'x', 0, 'left'));
      expect(res.classification).toBe('undefined');
    });

    it('classifies sqrt(x) at 0 (both) as does_not_exist due to left side', () => {
      const res = engine.evaluateLimit(createReq('sqrt(x)', 'x', 0, 'both'));
      expect(res.classification).toBe('does_not_exist');
    });
  });
});
