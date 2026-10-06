import { LimitEngine } from '../symbolic/limit';
import { LimitRequest } from '../types/limit';
import { ExpressionParser } from '../parser';
import { ASTNormalizer } from '../parser/normalizer';

describe('CORE CALCULUS SUBPHASE 3E - Standard Trigonometric Limits', () => {
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

  const expectNoLHopital = (res: any) => {
    const lhopitalUsed = res.steps.some((s: any) => s.transformation && s.transformation.method === 'l_hopital');
    expect(lhopitalUsed).toBe(false);
  };

  describe('1. Sine Identity', () => {
    it('solves lim x->0 sin(x)/x = 1', () => {
      const res = engine.evaluateLimit(createReq('sin(x) / x', 'x', 0));
      expect(res.classification).toBe('finite');
      expect((res.value as any).value).toBe('1');
      expectNoLHopital(res);
      expect(res.strategy).toBe('standard_trigonometric_limit');
    });

    it('solves lim x->0 sin(3x)/x = 3', () => {
      const res = engine.evaluateLimit(createReq('sin(3*x) / x', 'x', 0));
      expect(res.classification).toBe('finite');
      expect((res.value as any).value).toBe('3');
      expectNoLHopital(res);
    });

    it('solves lim x->0 sin(5x)/(5x) = 1', () => {
      const res = engine.evaluateLimit(createReq('sin(5*x) / (5*x)', 'x', 0));
      expect(res.classification).toBe('finite');
      expect((res.value as any).value).toBe('1');
      expectNoLHopital(res);
    });

    it('solves lim x->0 sin(2x)/sin(3x) = 2/3', () => {
      const res = engine.evaluateLimit(createReq('sin(2*x) / sin(3*x)', 'x', 0));
      expect(res.classification).toBe('finite');
      expect(numericValue(res.value)).toBeCloseTo(2/3, 5);
      expectNoLHopital(res);
    });
  });

  describe('2. Tangent Identity', () => {
    it('solves lim x->0 tan(x)/x = 1', () => {
      const res = engine.evaluateLimit(createReq('tan(x) / x', 'x', 0));
      expect(res.classification).toBe('finite');
      expect((res.value as any).value).toBe('1');
      expectNoLHopital(res);
      expect(res.conditions).toContain('cos(x) != 0'); 
    });

    it('solves lim x->0 tan(2x)/tan(3x) = 2/3', () => {
      const res = engine.evaluateLimit(createReq('tan(2*x) / tan(3*x)', 'x', 0));
      expect(res.classification).toBe('finite');
      expect(numericValue(res.value)).toBeCloseTo(2/3, 5);
      expectNoLHopital(res);
    });
  });

  describe('3. Cosine Identity (1 - cos(x))', () => {
    it('solves lim x->0 (1 - cos(x))/x^2 = 1/2', () => {
      const res = engine.evaluateLimit(createReq('(1 - cos(x)) / (x^2)', 'x', 0));
      expect(res.classification).toBe('finite');
      expect(numericValue(res.value)).toBeCloseTo(0.5, 5);
      expectNoLHopital(res);
    });

    it('solves lim x->0 (1 - cos(4x))/x^2 = 8', () => {
      const res = engine.evaluateLimit(createReq('(1 - cos(4*x)) / (x^2)', 'x', 0));
      expect(res.classification).toBe('finite');
      expect((res.value as any).value).toBe('8');
      expectNoLHopital(res);
    });

    it('solves lim x->0 (1 - cos(2x))/(1 - cos(3x)) = 4/9', () => {
      const res = engine.evaluateLimit(createReq('(1 - cos(2*x)) / (1 - cos(3*x))', 'x', 0));
      expect(res.classification).toBe('finite');
      expect(numericValue(res.value)).toBeCloseTo(4/9, 5);
      expectNoLHopital(res);
    });
  });

  describe('4. Structural Rejections & Scope', () => {
    it('hands structurally unsupported trig forms to the remaining exact pipeline', () => {
      const res = engine.evaluateLimit(createReq('(x - sin(x)) / (x^3)', 'x', 0));
      expect(res.classification).toBe('finite');
      expect(numericValue(res.value)).toBeCloseTo(1/6, 5);
    });
  });
});
