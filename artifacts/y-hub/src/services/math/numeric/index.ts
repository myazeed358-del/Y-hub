import { CanonicalAST } from '../types/ast';
import { ASTEvaluator } from '../symbolic/evaluator';
import { DerivativeEngine } from '../symbolic/derivative';
import { MathStep } from '../types/step';

export class NumericSolver {
  private evaluator = new ASTEvaluator();
  private derivativeEngine = new DerivativeEngine();

  public solveNewton(ast: CanonicalAST, variable: string, initialGuess: number = 0, tolerance: number = 1e-7, maxIterations: number = 100): { root: number, residual: number, iterations: number } | null {
    const derivAST = this.derivativeEngine.differentiate(ast, variable, []);
    
    let x = initialGuess;
    for (let i = 0; i < maxIterations; i++) {
      try {
        const fx = this.evaluator.evaluate(ast, { [variable]: x });
        if (Math.abs(fx) < tolerance) {
          return { root: x, residual: Math.abs(fx), iterations: i };
        }
        
        const dfx = this.evaluator.evaluate(derivAST, { [variable]: x });
        if (Math.abs(dfx) < 1e-12) {
          break; // Derivative is zero, Newton fails
        }
        
        x = x - fx / dfx;
      } catch (e) {
        break; // Out of domain
      }
    }
    
    return null;
  }
}
