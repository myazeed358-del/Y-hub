import { CanonicalAST } from '../types/ast';
import { ASTUtils } from '../symbolic/utils';
import { SymbolicSimplifier } from '../symbolic/simplifier';
import { ASTEvaluator } from '../symbolic/evaluator';

export type EquivalenceResult = 'exactly_equivalent' | 'numerically_consistent' | 'not_proven' | 'not_equivalent';

export class EquivalenceVerifier {
  private simplifier = new SymbolicSimplifier();
  private evaluator = new ASTEvaluator();

  public verify(ast1: CanonicalAST, ast2: CanonicalAST, checkVariables: string[] = ['x', 'y', 't']): EquivalenceResult {
    // 1. Strict Structural Equality
    if (ASTUtils.structuralEquals(ast1, ast2)) {
      return 'exactly_equivalent';
    }

    // 2. Canonical Simplification Equality
    const sim1 = this.simplifier.simplify(ASTUtils.clone(ast1));
    const sim2 = this.simplifier.simplify(ASTUtils.clone(ast2));
    if (ASTUtils.structuralEquals(sim1, sim2)) {
      return 'exactly_equivalent';
    }
    
    // 3. Numerical Spot Check (Supporting evidence ONLY)
    try {
      const varsIn1 = ASTUtils.extractSymbols(ast1);
      const varsIn2 = ASTUtils.extractSymbols(ast2);
      const allVars = Array.from(new Set([...varsIn1, ...varsIn2]));
      
      if (allVars.length > 0) {
        let matches = 0;
        let attempts = 0;
        // Test 5 random points avoiding obvious poles (e.g. 0 or 1)
        const testPoints = [2.718, 3.141, -0.5, 1.618, -2.5];
        
        for (const pt of testPoints) {
          const evalMap: Record<string, number> = {};
          allVars.forEach(v => evalMap[v] = pt);
          
          try {
            const v1 = this.evaluator.evaluate(ast1, evalMap);
            const v2 = this.evaluator.evaluate(ast2, evalMap);
            if (Number.isFinite(v1) && Number.isFinite(v2)) {
              attempts++;
              // Relative tolerance check
              if (Math.abs(v1 - v2) < 1e-6 * (Math.abs(v1) + 1)) {
                matches++;
              }
            }
          } catch(e) { /* Skip point if out of domain */ }
        }
        
        if (attempts > 0 && matches === attempts) {
          return 'numerically_consistent';
        } else if (attempts > 0) {
          return 'not_equivalent';
        }
      }
    } catch(e) {
      console.warn("Numerical verification failed internally");
    }

    return 'not_proven';
  }
}
