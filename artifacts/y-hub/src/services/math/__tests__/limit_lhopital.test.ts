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


  const numericValue = (ast: any): number => {
    if (!ast) return NaN;

    if (ast.type === 'Number') {
      return Number(ast.value);
    }

    if (ast.type === 'Parenthesis') {
      return numericValue(ast.content);
    }

    if (ast.type === 'Operator') {
      const args = ast.args.map((arg: any) => numericValue(arg));

      switch (ast.operator) {
        case '+':
          return args.reduce((a: number, b: number) => a + b, 0);
        case '-':
          return args.length === 1
            ? -args[0]
            : args[0] - args[1];
        case '*':
        case 'implicit_multiply':
          return args.reduce((a: number, b: number) => a * b, 1);
        case '/':
          return args[0] / args[1];
        case '^':
          return Math.pow(args[0], args[1]);
      }
    }

    return NaN;
  };

  describe('1. Standard L\'Hôpital Limits (0/0)', () => {
    it('solves lim x->0 sin(x)/x = 1', () => {
      const res = engine.evaluateLimit(createReq('sin(x) / x', 'x', 0));
      expect(res.classification).toBe('finite');
      expect((res.value as any).value).toBe('1');
    });

    it('solves lim x->0 (exp(x) - 1)/x = 1', () => {
      const res = engine.evaluateLimit(createReq('(exp(x) - 1) / x', 'x', 0));
      expect(res.classification).toBe('finite');
      expect((res.value as any).value).toBe('1');
    });

    it('solves lim x->1 ln(x)/(x - 1) = 1', () => {
      const res = engine.evaluateLimit(createReq('ln(x) / (x - 1)', 'x', 1, 'right'));
      expect(res.classification).toBe('finite');
      expect((res.value as any).value).toBe('1');
    });
  });

  describe('2. Repeated L\'Hôpital Limits', () => {
    it('solves lim x->0 (x - sin(x))/x^3 = 1/6 using multiple applications', () => {
      const res = engine.evaluateLimit(createReq('(x - sin(x)) / (x^3)', 'x', 0));
      expect(res.classification).toBe('finite');
      expect(numericValue(res.value)).toBeCloseTo(1/6, 5);
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
    it('resolves 0 * infinity through the integrated pipeline', () => {
      const res = engine.evaluateLimit(createReq('x * ln(x)', 'x', 0, 'right'));
      expect(res.classification).toBe('finite');
      expect(numericValue(res.value)).toBeCloseTo(0, 10);
    });

    it('resolves exponential indeterminate forms before L\'Hôpital fallback', () => {
      const res = engine.evaluateLimit(createReq('(1 + x)^(1/x)', 'x', 0, 'right'));
      expect(res.classification).toBe('finite');
      expect(numericValue(res.value)).toBeCloseTo(Math.E, 5);
    });
    
    it('uses a stronger exact strategy before the L\'Hôpital iteration limit', () => {
      const res = engine.evaluateLimit(createReq('(exp(x) - 1 - x - (x^2)/2 - (x^3)/6 - (x^4)/24) / (x^5)', 'x', 0));
      expect(res.classification).toBe('finite');
      expect(res.warnings).not.toContain('l_hopital_iteration_limit_reached');
    });

    it('preserves absolute value behavior without blind L\'Hôpital |x|/x', () => {
      const res = engine.evaluateLimit(createReq('abs(x) / x', 'x', 0));
      expect(res.classification).toBe('does_not_exist');
    });
  });
});
