import { EquationSolver } from '../symbolic/equation';
import { ExpressionParser } from '../parser';
import { ASTNormalizer } from '../parser/normalizer';

describe('CORE CALCULUS SUBPHASE 2 - Equation Solver Benchmarks', () => {
  const parser = new ExpressionParser();
  const normalizer = new ASTNormalizer();
  const solver = new EquationSolver();

  const parseToAST = (expr: string) => normalizer.normalize(parser.parse(expr));

  describe('Subphase 2A Corrections: Degenerate Quadratics & Verification', () => {
    it('handles a=0, b!=0 (Linear Fallback)', () => {
      const ast = parseToAST('0*x^2 + 2*x - 4 = 0');
      const { finalSolutions } = solver.solve(ast, 'x');
      expect(finalSolutions.length).toBe(1);
      expect((finalSolutions[0].value as any).value).toBe('2');
    });

    it('handles a=0, b=0, c=0 (Infinite)', () => {
      const ast = parseToAST('0*x^2 + 0*x + 0 = 0');
      expect(() => solver.solve(ast, 'x')).toThrow('INFINITE_SOLUTIONS');
    });

    it('handles a=0, b=0, c!=0 (None)', () => {
      const ast = parseToAST('0*x^2 + 0*x + 5 = 0');
      const { finalSolutions } = solver.solve(ast, 'x');
      expect(finalSolutions.length).toBe(0);
    });

    it('filters complex roots in REAL mode', () => {
      const ast = parseToAST('x^2 + 1 = 0');
      const { finalSolutions } = solver.solve(ast, 'x', { domain: 'real', mode: 'EXACT' });
      expect(finalSolutions.length).toBe(0);
    });

    it('allows complex roots in COMPLEX mode', () => {
      const ast = parseToAST('x^2 + 1 = 0');
      const { finalSolutions } = solver.solve(ast, 'x', { domain: 'complex', mode: 'EXACT' });
      expect(finalSolutions.length).toBe(2);
      expect(finalSolutions[0].value.type).toBe('Operator'); // AST containing i
    });
  });

  describe('Subphase 2B: Polynomial Equations', () => {
    it('solves cubic: x^3 - 6x^2 + 11x - 6 = 0', () => {
      const ast = parseToAST('x^3 - 6*x^2 + 11*x - 6 = 0');
      const { finalSolutions, completeness } = solver.solve(ast, 'x');
      const vals = finalSolutions.map(s => parseFloat((s.value as any).value));
      expect(vals.sort()).toEqual([1, 2, 3]);
      expect(finalSolutions[0].multiplicity).toBe(1);
      expect(completeness).toBe('all_roots_found');
    });

    it('solves quartic with rational root theorem: x^4 - 5x^2 + 4 = 0', () => {
      const ast = parseToAST('x^4 - 5*x^2 + 4 = 0');
      const { finalSolutions } = solver.solve(ast, 'x');
      const vals = finalSolutions.map(s => parseFloat((s.value as any).value));
      expect(vals.sort((a,b) => a-b)).toEqual([-2, -1, 1, 2]);
    });

    it('solves expanded polynomial with multiplicity: (x-2)^2 * (x+1) = 0', () => {
      // Expanded manually for test: x^3 - 3x^2 + 4 = 0
      const ast = parseToAST('x^3 - 3*x^2 + 4 = 0');
      const { finalSolutions } = solver.solve(ast, 'x');
      
      const root2 = finalSolutions.find(s => parseFloat((s.value as any).value) === 2);
      const root1 = finalSolutions.find(s => parseFloat((s.value as any).value) === -1);
      
      expect(root2?.multiplicity).toBe(2);
      expect(root1?.multiplicity).toBe(1);
    });

    it('finds all complex roots for x^3 - 1 = 0 in COMPLEX mode', () => {
      const ast = parseToAST('x^3 - 1 = 0');
      const { finalSolutions, completeness } = solver.solve(ast, 'x', { domain: 'complex', mode: 'EXACT' });
      
      // Should find x=1 via RRT, deflate to x^2 + x + 1, and find 2 complex roots
      expect(finalSolutions.length).toBe(3);
      expect(completeness).toBe('all_roots_found');
    });
  });

  describe('Subphase 2B: Rational Equations & Domain Hazards', () => {
    it('clears denominators and flags extraneous roots: (x-1)/(x-2) = 0', () => {
      const ast = parseToAST('(x-1)/(x-2) = 0');
      const { finalSolutions, rejectedSolutions } = solver.solve(ast, 'x');
      
      expect(finalSolutions.length).toBe(1);
      expect((finalSolutions[0].value as any).value).toBe('1');
      expect(rejectedSolutions.length).toBe(0);
    });

    it('flags x=2 as extraneous in: (x-2)/(x-2) = 0', () => {
      const ast = parseToAST('(x-2)/(x-2) = 0');
      const { finalSolutions, rejectedSolutions } = solver.solve(ast, 'x');
      
      expect(finalSolutions.length).toBe(0);
      expect(rejectedSolutions.length).toBe(1);
      expect(rejectedSolutions[0].extraneous).toBe(true);
      expect(rejectedSolutions[0].conditions.some(c => c.includes('Excluded by denominator'))).toBe(true);
    });

    it('extracts nested denominators securely', () => {
      const ast = parseToAST('1 / (1 / (x - 5)) = 0');
      const { rejectedSolutions } = solver.solve(ast, 'x');
      // x = 5 makes the inner denominator 0, it should be in the restriction list.
      // Equation simplifies to x - 5 = 0 => candidate x = 5.
      // So x = 5 should be rejected!
      expect(rejectedSolutions.some(s => parseFloat((s.value as any).value) === 5)).toBe(true);
    });
  });
});
