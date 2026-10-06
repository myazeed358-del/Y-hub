import { LimitEngine } from '../symbolic/limit';
import { LimitRequest } from '../types/limit';
import { ExpressionParser } from '../parser';
import { ASTNormalizer } from '../parser/normalizer';
import { ASTUtils } from '../symbolic/utils';
import { CanonicalAST } from '../types/ast';

describe('CORE CALCULUS 3G - EXACT Local Series Engine', () => {
  const parser = new ExpressionParser();
  const normalizer = new ASTNormalizer();
  const engine = new LimitEngine();

  const createReq = (expr: string, variable: string, approach: any, direction: 'both' | 'left' | 'right' = 'both'): LimitRequest => ({
    expression: normalizer.normalize(parser.parse(expr)),
    variable,
    approach,
    direction
  });

  const expectExactValue = (res: any, astExpected: CanonicalAST) => {
    expect(res.classification).toBe('finite');
    expect(ASTUtils.structuralEquals(res.value, astExpected)).toBe(true);
  };

  const frac = (num: string, den: string): CanonicalAST => ({
    type: 'Operator',
    operator: '/',
    args: [
      { type: 'Number', value: num },
      { type: 'Number', value: den }
    ]
  });
  
  const num = (val: string): CanonicalAST => ({
    type: 'Number',
    value: val
  });
  
  const negFrac = (numStr: string, denStr: string): CanonicalAST => ({
    type: 'Operator',
    operator: '*',
    args: [
      { type: 'Number', value: '-1' },
      frac(numStr, denStr)
    ]
  });

  describe('1. Exact Coefficient Verification', () => {
    it('solves (x - sin(x))/x^3 = exactly 1/6', () => {
      const res = engine.evaluateLimit(createReq('(x - sin(x)) / (x^3)', 'x', 0));
      expectExactValue(res, frac('1', '6'));
    });

    it('solves (sin(x) - x + x^3/6)/x^5 = exactly 1/120', () => {
      const res = engine.evaluateLimit(createReq('(sin(x) - x + (x^3)/6) / (x^5)', 'x', 0));
      expectExactValue(res, frac('1', '120'));
    });

    it('solves (e^x - 1 - x)/x^2 = exactly 1/2', () => {
      const res = engine.evaluateLimit(createReq('(exp(x) - 1 - x) / (x^2)', 'x', 0));
      expectExactValue(res, frac('1', '2'));
    });

    it('solves (ln(1+x) - x)/x^2 = exactly -1/2', () => {
      const res = engine.evaluateLimit(createReq('(ln(1 + x) - x) / (x^2)', 'x', 0));
      expectExactValue(res, negFrac('1', '2'));
    });
  });
});
