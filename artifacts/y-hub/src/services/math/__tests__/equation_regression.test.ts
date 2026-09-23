import { EquationSolver } from '../symbolic/equation';
import { ExpressionParser } from '../parser';
import { ASTNormalizer } from '../parser/normalizer';

describe('CORE CALCULUS SUBPHASE 2 - Equation Solver Benchmarks', () => {
  const parser = new ExpressionParser();
  const normalizer = new ASTNormalizer();
  const solver = new EquationSolver();

  const parseToAST = (expr: string) => normalizer.normalize(parser.parse(expr));

  // ... (previous tests stay exactly the same, appending Subphase 2B Mathematical Corrections)
  describe('Subphase 2B Corrections: Exact Transformed Equations', () => {
    it('correctly transforms 11/(x-5) = 0 to 11 = 0, yielding no solutions', () => {
      const ast = parseToAST('11/(x-5) = 0');
      const { finalSolutions, rejectedSolutions } = solver.solve(ast, 'x');
      
      // The equation becomes 11 = 0, so there are NO candidate solutions generated at all.
      expect(finalSolutions.length).toBe(0);
      expect(rejectedSolutions.length).toBe(0); // It shouldn't even generate x=5 to reject it
    });

    it('correctly isolates x in 1/(1/(x-5)) = 0 yielding x=5 but rejecting it via original domain', () => {
      const ast = parseToAST('1 / (1 / (x - 5)) = 0');
      const { finalSolutions, rejectedSolutions } = solver.solve(ast, 'x');
      
      // This mathematically evaluates to x-5=0 -> cand 5 -> but violates original 1/(x-5) denominator.
      expect(finalSolutions.length).toBe(0);
      expect(rejectedSolutions.length).toBe(1);
      expect((rejectedSolutions[0].value as any).value).toBe('5');
    });
  });
});
