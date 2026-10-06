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

  describe('1. Factoring & Safe Cancellation', () => {
    it('solves lim x->0 (x^2 - 4x)/x = -4', () => {
      const res = engine.evaluateLimit(createReq('(x^2 - 4*x) / x', 'x', 0));
      expect(res.classification).toBe('finite');
      expect((res.value as any).value).toBe('-4');
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
      expect(numericValue(res.value)).toBeCloseTo(0.5, 5);
    });

    it('solves lim x->4 (sqrt(x) - 2)/(x - 4) = 1/4', () => {
      const res = engine.evaluateLimit(createReq('(sqrt(x) - 2) / (x - 4)', 'x', 4));
      expect(res.classification).toBe('finite');
      expect(numericValue(res.value)).toBeCloseTo(0.25, 5);
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

  describe('4. Integrated Strategy Handoff', () => {
    it('hands sin(x)/x to the stronger final pipeline', () => {
      const res = engine.evaluateLimit(createReq('sin(x) / x', 'x', 0));
      expect(res.classification).toBe('finite');
      expect((res.value as any).value).toBe('1');
    });

    it('hands transcendental 0/0 forms to the stronger final pipeline', () => {
      const res = engine.evaluateLimit(createReq('(exp(x) - 1) / x', 'x', 0));
      expect(res.classification).toBe('finite');
      expect(numericValue(res.value)).toBeCloseTo(1, 10);
    });
  });
});
