import { CanonicalAST } from '../types/ast';
import { VerificationResult } from '../types/step';
import { EquivalenceVerifier } from './equivalence';
import { ASTEvaluator } from '../symbolic/evaluator';
import { DerivativeEngine } from '../symbolic/derivative';
import { ASTUtils } from '../symbolic/utils';
import { SymbolicSimplifier } from '../symbolic/simplifier';

export class MathVerifier {
  private equivalence = new EquivalenceVerifier();
  private evaluator = new ASTEvaluator();
  private derivEngine = new DerivativeEngine();
  private simplifier = new SymbolicSimplifier();

  public verifyDerivative(original: CanonicalAST, resultAST: CanonicalAST, variable: string): VerificationResult {
    try {
      const h = 1e-5;
      const testPoints = [1.23, -0.45, 2.71, 3.14];
      let matches = 0;
      let attempts = 0;

      for (const p of testPoints) {
        try {
          const mapPlus = { [variable]: p + h };
          const mapMinus = { [variable]: p - h };
          const mapP = { [variable]: p };

          const fPlus = this.evaluator.evaluate(original, mapPlus);
          const fMinus = this.evaluator.evaluate(original, mapMinus);
          
          if (!Number.isFinite(fPlus) || !Number.isFinite(fMinus)) continue;

          const approxDeriv = (fPlus - fMinus) / (2 * h);
          const exactDeriv = this.evaluator.evaluate(resultAST, mapP);
          
          if (!Number.isFinite(exactDeriv)) continue;

          attempts++;
          
          if (Math.abs(approxDeriv - exactDeriv) < 1e-4) {
            matches++;
          }
        } catch(e) { /* domain issues at p, ignore */ }
      }

      if (attempts > 0 && matches === attempts) {
        return {
          status: 'numerically_consistent',
          methodUsed: 'independent_numerical_difference',
          explanation: 'Verified via independent numerical central-difference approximations. This provides strong evidence but is not formal symbolic proof.'
        };
      } else if (attempts > 0) {
        return {
          status: 'not_equivalent',
          methodUsed: 'independent_numerical_difference',
          explanation: 'Numerical finite-difference check contradicts the symbolic derivative.'
        };
      }
    } catch(e) {
      return {
        status: 'verification_failed',
        methodUsed: 'independent_numerical_difference',
        explanation: 'System error occurred during numerical verification.'
      };
    }

    return {
      status: 'not_proven',
      methodUsed: 'none',
      explanation: 'Could not independently verify derivative (domain issues or no valid test points).'
    };
  }

  public verifyIntegral(integrand: CanonicalAST, integralResult: CanonicalAST, variable: string): VerificationResult {
    const dResult = this.derivEngine.differentiate(integralResult, variable);
    const eq = this.equivalence.verify(integrand, dResult);
    
    if (eq === 'exactly_equivalent') {
      return { status: 'exactly_equivalent', methodUsed: 'differentiation', explanation: 'Differentiating the integral exactly reproduces the original integrand.' };
    }
    if (eq === 'numerically_consistent') {
      return { status: 'numerically_consistent', methodUsed: 'differentiation', explanation: 'Derivative of the result is numerically consistent with the original integrand.' };
    }
    return { status: 'not_proven', methodUsed: 'differentiation', explanation: 'Could not formally prove that the derivative of the result matches the integrand.' };
  }

  public verifyEquationRoot(lhs: CanonicalAST, rhs: CanonicalAST, variable: string, root: CanonicalAST): VerificationResult {
    const subLhs = this.simplifier.simplify(ASTUtils.substitute(lhs, variable, root));
    const subRhs = this.simplifier.simplify(ASTUtils.substitute(rhs, variable, root));
    
    const eq = this.equivalence.verify(subLhs, subRhs);
    
    if (eq === 'exactly_equivalent') {
      return { status: 'exactly_equivalent', methodUsed: 'substitution', explanation: 'Substituting the root back into the equation maintains strict equality.' };
    }
    if (eq === 'numerically_consistent') {
      return { status: 'numerically_consistent', methodUsed: 'substitution', explanation: 'Substituting the root back into the equation yields numerically consistent equality.' };
    }
    return { status: 'not_proven', methodUsed: 'substitution', explanation: 'Could not prove root correctness symbolically or numerically.' };
  }
}

export * from './equivalence';
