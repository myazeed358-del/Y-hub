import { CanonicalAST } from '../types/ast';
import { OrchestrationRequest, IntegrationMode } from '../types/integration';
import { DomainAnalyzer } from '../domain';


import { ASTUtils } from './utils';
import { SetEngine } from './sets';
import { InequalityEngine } from './inequality';


import { ASTEvaluator } from './evaluator';
/** Classifies integration bounds and singularities before strategy dispatch. */
export class IntegrationModeClassifier {
  private domainAnalyzer = new DomainAnalyzer();
  private inequalityEngine = new InequalityEngine();
  public classifyRequest(req: OrchestrationRequest): IntegrationMode {
    if (!req.lowerBound || !req.upperBound) {
      return 'symbolic_indefinite';
    }

    // Check bounds for Infinity
    const lInf = ASTUtils.isInfinity(req.lowerBound);
    const uInf = ASTUtils.isInfinity(req.upperBound);
    if (lInf || uInf) {
      return 'symbolic_improper';
    }

    // Ensure bounds are constant (we don't do purely algebraic definite classification yet)
    // For orchestration purposes, if we can evaluate the bounds, we check singularities.
    let valA = NaN;
    let valB = NaN;
    try {
        const ev = new ASTEvaluator();
        valA = ev.evaluate(req.lowerBound, {});
        valB = ev.evaluate(req.upperBound, {});
    } catch {
        // If they are purely symbolic (e.g. ∫_a^b), default to definite and let 6G handle it.
        return 'symbolic_definite';
    }

    if (isNaN(valA) || isNaN(valB)) {
        return 'symbolic_definite'; // Could be symbolic bounds
    }

    // Check domain for interior or endpoint singularities
    const restrictions = this.domainAnalyzer.analyze(req.integrand);
    if (restrictions.length > 0) {
       let domainSet = SetEngine.createRealLine();
       for (const r of restrictions) {
          if (r.type === 'inverse_trig' || r.type === 'inverse_sec_csc') continue; // Simplified check for classification
          const ineq: CanonicalAST = { type: 'Inequality', operator: r.type === 'denominator' ? '!=' : (r.type === 'even_root' ? '>=' : '>'), lhs: r.conditionAST, rhs: { type: 'Number', value: '0' } };
          const solved = this.inequalityEngine.solve(ineq, req.variable);
          if (solved.kind === 'solution_set') {
             domainSet = { type: 'SolutionSet', variable: req.variable, domainRestrictions: [], intervals: SetEngine.intersection(domainSet.intervals, solved.solution.intervals) };
          }
       }

       const minBnd = Math.min(valA, valB);
       const maxBnd = Math.max(valA, valB);

       for (const interval of domainSet.intervals) {
           const min = interval.left.type === 'infinity' ? -Infinity : Number(interval.left.rational!.num)/Number(interval.left.rational!.den);
           const max = interval.right.type === 'infinity' ? Infinity : Number(interval.right.rational!.num)/Number(interval.right.rational!.den);

           if (minBnd >= min && maxBnd <= max) {
               if ((minBnd === min && !interval.leftClosed) || (maxBnd === max && !interval.rightClosed)) {
                   return 'symbolic_improper'; // Endpoint singularity
               }
           } else if (minBnd < max && maxBnd > min) {
               return 'symbolic_improper'; // Interior singularity or gap
           }
       }
    }

    return 'symbolic_definite';
  }
}
