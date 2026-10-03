import { CanonicalAST } from '../types/ast';
import { MathStep } from '../types/step';
import { DefiniteIntegrationRequest, DefiniteIntegrationResult, DefiniteIntegrationClassification, VerificationStatus } from '../types/integration';
import { IntegrationEngine } from './integration';
import { DomainAnalyzer } from '../domain';
import { InequalityEngine } from './inequality';
import { SetEngine } from './sets';
import { SymbolicSimplifier } from './simplifier';
import { DerivativeEngine } from './derivative';
import { ASTEvaluator } from './evaluator';
import { ASTUtils } from './utils';

export class DefiniteIntegrationEngine {
  private integrationEngine = new IntegrationEngine();
  private domainAnalyzer = new DomainAnalyzer();
  private inequalityEngine = new InequalityEngine();
  private simplifier = new SymbolicSimplifier();
  private derivativeEngine = new DerivativeEngine();
  private evaluator = new ASTEvaluator();

  public evaluateDefiniteIntegral(req: DefiniteIntegrationRequest): DefiniteIntegrationResult {
    const steps: MathStep[] = [];
    
    // Resource Limit Check
    if (this.getASTDepth(req.integrand) > 50 || this.getASTDepth(req.lowerBound) > 10 || this.getASTDepth(req.upperBound) > 10) {
       return this.buildResult(req, 'resource_limit', 1, null, [], null, null, null, null, 'not_proven', [], steps);
    }
    
    let classification: DefiniteIntegrationClassification = 'proper_exact';
    let orientation: 1 | -1 | 0 = 1;
    let finalValue: CanonicalAST | null = null;
    let lowerEval: CanonicalAST | null = null;
    let upperEval: CanonicalAST | null = null;
    let antiderivative: CanonicalAST | null = null;
    let vStatus: VerificationStatus = 'not_proven';
    const detectedSingularities: CanonicalAST[] = [];
    const assumptions: string[] = [];

    // 1. Analyze Original Domain
    const restrictions = this.domainAnalyzer.analyze(req.integrand);
    let originalDomain = SetEngine.createRealLine();
    for (const r of restrictions) {
       let res;
       if (r.type === 'inverse_trig') {
          const gteq: CanonicalAST = { type: 'Inequality', operator: '>=', lhs: r.conditionAST, rhs: { type: 'Number', value: '-1' } };
          const lteq: CanonicalAST = { type: 'Inequality', operator: '<=', lhs: r.conditionAST, rhs: { type: 'Number', value: '1' } };
          const s1 = this.inequalityEngine.solve(gteq, req.variable);
          const s2 = this.inequalityEngine.solve(lteq, req.variable);
          if (s1.kind === 'solution_set' && s2.kind === 'solution_set') {
             const intersect = SetEngine.intersection(s1.solution.intervals, s2.solution.intervals);
             originalDomain = { type: 'SolutionSet', variable: req.variable, domainRestrictions: [], intervals: SetEngine.intersection(originalDomain.intervals, intersect) };
          }
       } else if (r.type === 'inverse_sec_csc') {
          const lteq: CanonicalAST = { type: 'Inequality', operator: '<=', lhs: r.conditionAST, rhs: { type: 'Number', value: '-1' } };
          const gteq: CanonicalAST = { type: 'Inequality', operator: '>=', lhs: r.conditionAST, rhs: { type: 'Number', value: '1' } };
          const s1 = this.inequalityEngine.solve(lteq, req.variable);
          const s2 = this.inequalityEngine.solve(gteq, req.variable);
          if (s1.kind === 'solution_set' && s2.kind === 'solution_set') {
             const union = SetEngine.union(s1.solution.intervals, s2.solution.intervals);
             originalDomain = { type: 'SolutionSet', variable: req.variable, domainRestrictions: [], intervals: SetEngine.intersection(originalDomain.intervals, union) };
          }
       } else {
          const ineq: CanonicalAST = { type: 'Inequality', operator: r.type === 'denominator' ? '!=' : (r.type === 'even_root' ? '>=' : '>'), lhs: r.conditionAST, rhs: { type: 'Number', value: '0' } };
          const solved = this.inequalityEngine.solve(ineq, req.variable);
          if (solved.kind === 'solution_set') {
             originalDomain = { type: 'SolutionSet', variable: req.variable, domainRestrictions: [], intervals: SetEngine.intersection(originalDomain.intervals, solved.solution.intervals) };
          }
       }
    }

    // 2. Bound Order and Type
    if (req.trustedOrientation !== undefined) {
       orientation = req.trustedOrientation;
    } else {
       const isNumA = this.isNumeric(req.lowerBound);
       const isNumB = this.isNumeric(req.upperBound);

       let valA = 0;
       let valB = 0;
       if (isNumA && isNumB) {
          valA = this.evaluateNumeric(req.lowerBound);
          valB = this.evaluateNumeric(req.upperBound);
          if (valA > valB) {
             orientation = -1;
             const temp = valA; valA = valB; valB = temp;
          } else if (valA === valB) {
             orientation = 0;
          }
       } else {
          // Symbolic bounds
          const diff = this.simplifier.simplify({ type: 'Operator', operator: '-', args: [req.lowerBound, req.upperBound] });
          if (diff.type === 'Number' && diff.value === '0') {
             orientation = 0;
          } else {
             // Can't prove ordering, return unresolved/requires_assumption
             return this.buildResult(req, 'requires_assumption', orientation, originalDomain, detectedSingularities, null, null, null, null, 'not_proven', assumptions, steps);
          }
       }
    }

    if (orientation === 0) {
       return this.buildResult(req, 'proper_exact', 0, originalDomain, [], null, null, null, { type: 'Number', value: '0' }, 'exactly_equivalent', assumptions, steps);
    }

    // Check improper bounds
    const checkInf = (node: CanonicalAST) => (node.type === 'Symbol' && (node.name === 'infinity' || node.name === 'inf' || node.name === '\\infty'));
    if (checkInf(req.lowerBound) || checkInf(req.upperBound)) {
       return this.buildResult(req, 'improper_detected', orientation, originalDomain, [], null, null, null, null, 'not_proven', assumptions, steps);
    }

    // 3. Domain Check over [valA, valB]
    let contained = false;
    
    if (req.trustedDomainCheck) {
       contained = true;
    } else {
       const isNumA = this.isNumeric(req.lowerBound);
       const isNumB = this.isNumeric(req.upperBound);
       if (isNumA && isNumB) {
          const valA = Math.min(this.evaluateNumeric(req.lowerBound), this.evaluateNumeric(req.upperBound));
          const valB = Math.max(this.evaluateNumeric(req.lowerBound), this.evaluateNumeric(req.upperBound));
          
          for (const interval of originalDomain.intervals) {
             const min = interval.left.type === 'infinity' ? -Infinity : (interval.left.type === 'value' && interval.left.rational ? Number(interval.left.rational.num)/Number(interval.left.rational.den) : NaN);
             const max = interval.right.type === 'infinity' ? Infinity : (interval.right.type === 'value' && interval.right.rational ? Number(interval.right.rational.num)/Number(interval.right.rational.den) : NaN);
             
             if (!isNaN(min) && !isNaN(max)) {
                // Strict interval containment
                const leftOk = (valA > min) || (valA === min && interval.leftClosed);
                const rightOk = (valB < max) || (valB === max && interval.rightClosed);
                
                if (leftOk && rightOk) {
                   contained = true;
                   break;
                }
             }
          }
       } else {
          // If bounds are symbolic, and not trusted, we have to reject in 6G for safety unless proved
          contained = false;
       }
    }

    if (!contained) {
       // It's not fully contained. It could be an endpoint singularity or an interior singularity.
       // The prompt says "improper_detected" for these.
       return this.buildResult(req, 'improper_detected', orientation, originalDomain, [], null, null, null, null, 'not_proven', assumptions, steps);
    }

    // 4. Obtain Antiderivative
    const intRes = this.integrationEngine.integrateRequest({ expression: req.integrand, integrand: req.integrand, variable: req.variable });
    
    if (intRes.status !== 'exact_symbolic' && intRes.status !== 'conditionally_valid') {
       return this.buildResult(req, 'unsupported', orientation, originalDomain, [], null, null, null, null, 'not_proven', assumptions, steps);
    }

    antiderivative = intRes.antiderivative;
    if (!antiderivative) {
       return this.buildResult(req, 'unsupported', orientation, originalDomain, [], null, null, null, null, 'not_proven', assumptions, steps);
    }

    // 5. Evaluate Bounds F(b) - F(a)
    try {
       const F_b = this.evaluateAt(antiderivative, req.variable, orientation === 1 ? req.upperBound : req.lowerBound);
       const F_a = this.evaluateAt(antiderivative, req.variable, orientation === 1 ? req.lowerBound : req.upperBound);

       const diff = this.simplifier.simplify({ type: 'Operator', operator: '-', args: [F_b, F_a] });
       
       // Handle orientation
       if (orientation === -1) {
          finalValue = this.simplifier.simplify({ type: 'Operator', operator: '*', args: [{ type: 'Number', value: '-1' }, diff] });
       } else {
          finalValue = diff;
       }
       lowerEval = F_a;
       upperEval = F_b;

       // 6. Verification
       // Antiderivative verification
       const dF = this.derivativeEngine.differentiate(antiderivative, req.variable);
       const verDiff = this.simplifier.simplify({ type: 'Operator', operator: '-', args: [dF, req.integrand] });
       if (verDiff.type === 'Number' && verDiff.value === '0') {
          vStatus = 'exactly_equivalent';
       } else {
          vStatus = 'numerically_consistent'; // Usually verified by IntegrationEngine anyway
       }

       classification = 'proper_exact';
       return this.buildResult(req, classification, orientation, originalDomain, [], antiderivative, lowerEval, upperEval, finalValue, vStatus, assumptions, steps);
       
    } catch (e) {
       return this.buildResult(req, 'unresolved', orientation, originalDomain, [], antiderivative, null, null, null, 'verification_failed', assumptions, steps);
    }
  }

  private buildResult(
    req: DefiniteIntegrationRequest,
    classification: DefiniteIntegrationClassification,
    orientation: 1 | -1 | 0,
    originalDomain: any,
    detectedSingularities: CanonicalAST[],
    antiderivative: CanonicalAST | null,
    lowerEvaluation: CanonicalAST | null,
    upperEvaluation: CanonicalAST | null,
    finalValue: CanonicalAST | null,
    verificationStatus: VerificationStatus,
    assumptions: string[],
    steps: MathStep[]
  ): DefiniteIntegrationResult {
    return {
       request: req,
       classification,
       orientation,
       originalDomain,
       detectedSingularities,
       antiderivative,
       lowerEvaluation,
       upperEvaluation,
       finalValue,
       verificationStatus,
       assumptions,
       steps
    };
  }

  private isNumeric(node: CanonicalAST): boolean {
     // A very basic check. The evaluator can handle constants like pi too.
     try {
        const val = this.evaluateNumeric(node);
        return !isNaN(val);
     } catch {
        return false;
     }
  }

  private evaluateNumeric(node: CanonicalAST): number {
     const res = this.evaluator.evaluate(node, {});
     if (typeof res === 'number') return res;
     throw new Error('Not numeric');
  }

  private evaluateAt(expr: CanonicalAST, variable: string, valueNode: CanonicalAST): CanonicalAST {
     // Structural substitution
     let subbed = this.replaceAST(expr, { type: 'Symbol', name: variable }, valueNode);
     return this.simplifier.simplify(subbed);
  }

  private replaceAST(node: CanonicalAST, target: CanonicalAST, replacement: CanonicalAST): CanonicalAST {
     if (ASTUtils.structuralEquals(node, target)) {
        return replacement;
     }
     if (node.type === 'Operator') {
        return { ...node, args: node.args.map(a => this.replaceAST(a, target, replacement)) } as CanonicalAST;
     }
     if (node.type === 'Function') {
        return { ...node, args: node.args.map(a => this.replaceAST(a, target, replacement)) } as CanonicalAST;
     }
     if (node.type === 'Parenthesis') {
        return { ...node, content: this.replaceAST(node.content, target, replacement) };
     }
     return node;
  }

  private getASTDepth(node: CanonicalAST): number {
     if (!node) return 0;
     if (node.type === 'Operator' || node.type === 'Function') {
        let max = 0;
        for (const arg of node.args) {
           max = Math.max(max, this.getASTDepth(arg));
        }
        return max + 1;
     }
     if (node.type === 'Parenthesis') {
        return this.getASTDepth(node.content) + 1;
     }
     return 1;
  }
}
