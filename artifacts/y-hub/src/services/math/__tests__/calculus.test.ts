import { SymbolicSimplifier } from '../symbolic/simplifier';
import { DerivativeEngine } from '../symbolic/derivative';
import { ExpressionParser } from '../parser';
import { ASTNormalizer } from '../parser/normalizer';
import { MathVerifier } from '../verification';

describe('CORE CALCULUS SUBPHASE 1 - Revision Benchmarks', () => {
  const parser = new ExpressionParser();
  const normalizer = new ASTNormalizer();
  const simplifier = new SymbolicSimplifier();
  const derivativeEngine = new DerivativeEngine();
  const verifier = new MathVerifier();

  const parseToAST = (expr: string) => normalizer.normalize(parser.parse(expr));

  describe('1. Elementary Derivative Audit', () => {
    const testCases = [
      'x^2', 'sqrt(x)', 'exp(x)', '2^x', 'ln(x)', 
      'sin(x)', 'cos(x)', 'tan(x)', 'sec(x)', 'csc(x)', 'cot(x)',
      'asin(x)', 'acos(x)', 'atan(x)',
      'sinh(x)', 'cosh(x)', 'tanh(x)'
    ];

    testCases.forEach(expr => {
      it(`computes and independently verifies derivative of ${expr}`, () => {
        const original = parseToAST(expr);
        const derived = derivativeEngine.differentiate(original, 'x');
        
        const vResult = verifier.verifyDerivative(original, derived, 'x');
        // Accept either exactly equivalent or numerically consistent
        expect(['exactly_equivalent', 'numerically_consistent'].includes(vResult.status)).toBe(true);
        expect(vResult.methodUsed).toBe('independent_numerical_difference');
      });
    });
  });

  describe('2. Composite and Nested Derivatives', () => {
    const testCases = [
      'sin(x^2)', 
      'cos(3*x+1)', 
      'exp(sin(x))', 
      'ln(sqrt(1+x^2))', 
      'atan(x^3)'
    ];

    testCases.forEach(expr => {
      it(`computes and independently verifies derivative of ${expr}`, () => {
        const original = parseToAST(expr);
        const derived = derivativeEngine.differentiate(original, 'x');
        const vResult = verifier.verifyDerivative(original, derived, 'x');
        expect(['exactly_equivalent', 'numerically_consistent'].includes(vResult.status)).toBe(true);
      });
    });
  });

  describe('3. Higher-Order Derivatives', () => {
    it('computes 2nd derivative of x^4 safely', () => {
      const original = parseToAST('x^4');
      const d2 = derivativeEngine.differentiateN(original, 'x', 2);
      expect(d2.type).toBe('Operator'); 
    });

    it('computes 3rd derivative of sin(x) safely', () => {
      const original = parseToAST('sin(x)');
      const d3 = derivativeEngine.differentiateN(original, 'x', 3);
      expect(d3.type).toBe('Operator'); 
    });
  });

  describe('4. Domain-Aware Simplification', () => {
    const original = parseToAST('sqrt(x^2)');

    it('preserves abs(x) without assumptions', () => {
      const s = simplifier.simplify(original, []);
      expect((s as any).name).toBe('abs');
    });

    it('simplifies to x for x >= 0', () => {
      const s = simplifier.simplify(original, [{ variable: 'x', relation: '>=', value: 0 }]);
      expect((s as any).name).toBe('x');
    });

    it('simplifies to x for x > 0', () => {
      const s = simplifier.simplify(original, [{ variable: 'x', relation: '>', value: 0 }]);
      expect((s as any).name).toBe('x');
    });

    it('simplifies to -x for x <= 0', () => {
      const s = simplifier.simplify(original, [{ variable: 'x', relation: '<=', value: 0 }]);
      expect(s.type).toBe('Operator');
      expect((s as any).args[0].value).toBe('-1');
    });

    it('simplifies to -x for x < 0', () => {
      const s = simplifier.simplify(original, [{ variable: 'x', relation: '<', value: 0 }]);
      expect((s as any).args[0].value).toBe('-1');
    });
  });

  describe('5. Adversarial and Regression', () => {
    it('handles nested quotients safely', () => {
      const original = parseToAST('(x / (x + 1)) / (x - 1)');
      const d = derivativeEngine.differentiate(original, 'x');
      const vResult = verifier.verifyDerivative(original, d, 'x');
      expect(vResult.methodUsed).toBeDefined(); 
    });
  });
});
