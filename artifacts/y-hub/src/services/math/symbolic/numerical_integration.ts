import { CanonicalAST } from '../types/ast';
import { NumericalIntegrationRequest, NumericalIntegrationResult, NumericalIntegrationClassification, NumericalIntegrationStep } from '../types/integration';
import { DomainAnalyzer } from '../domain';
import { SetEngine } from './sets';
import { InequalityEngine } from './inequality';
import { ASTEvaluator } from './evaluator';

export class NumericalIntegrationEngine {
  private domainAnalyzer = new DomainAnalyzer();
  private inequalityEngine = new InequalityEngine();
  private evaluator = new ASTEvaluator();

  public evaluateNumericalIntegral(req: NumericalIntegrationRequest): NumericalIntegrationResult {
    let trace: NumericalIntegrationStep[] = [];
    let warnings: string[] = [];

    // 1. Initial configuration and bounds
    const maxEvaluations = req.maxEvaluations || 10000;
    const maxRecursionDepth = req.maxRecursionDepth || 20;

    const valA = this.evaluateNumeric(req.lowerBound);
    const valB = this.evaluateNumeric(req.upperBound);

    if (isNaN(valA) || isNaN(valB) || !isFinite(valA) || !isFinite(valB)) {
        return this.buildResult(req, 'requires_improper', null, null, null, null, null, 0, 0, 0, trace, warnings);
    }

    const minBnd = Math.min(valA, valB);
    const maxBnd = Math.max(valA, valB);
    const orientation = valA < valB ? 1 : (valA > valB ? -1 : 0);

    if (orientation === 0) {
        return this.buildResult(req, 'converged', 0, 0, req.tolerance || null, valA, valB, 0, 0, 0, trace, warnings);
    }

    // 2. Original Domain Analysis
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

    // Check interval [minBnd, maxBnd] against domain
    let domainClass: NumericalIntegrationClassification | null = null;
    let contained = false;

    for (const interval of originalDomain.intervals) {
        const min = interval.left.type === 'infinity' ? -Infinity : Number(interval.left.rational!.num)/Number(interval.left.rational!.den);
        const max = interval.right.type === 'infinity' ? Infinity : Number(interval.right.rational!.num)/Number(interval.right.rational!.den);
        
        if (minBnd >= min && maxBnd <= max) {
            // It's mostly inside. Check boundaries carefully.
            if (minBnd === min && !interval.leftClosed) {
                domainClass = 'endpoint_singularity';
                break;
            }
            if (maxBnd === max && !interval.rightClosed) {
                domainClass = 'endpoint_singularity';
                break;
            }
            contained = true;
            break;
        } else if (minBnd < max && maxBnd > min) {
            // Overlaps partially, so it crosses a boundary
            domainClass = 'singularity_detected';
            break;
        }
    }

    if (!contained && !domainClass) {
        domainClass = 'domain_invalid';
    }

    if (domainClass) {
        return this.buildResult(req, domainClass, null, null, null, valA, valB, orientation, 0, 0, trace, warnings);
    }

    // 3. Evaluation Setup
    const evalState = { count: 0, max: maxEvaluations };
    const evaluate = (x: number) => {
        if (evalState.count >= evalState.max) throw new Error('RESOURCE_LIMIT');
        evalState.count++;
        const res = this.evaluator.evaluate(req.integrand, { [req.variable]: x });
        if (typeof res !== 'number' || isNaN(res) || !isFinite(res)) throw new Error('NON_FINITE_EVALUATION');
        return res;
    };

    try {
        let finalValue = 0;
        let estimatedError: number | null = null;
        let subdivisionCount = 0;

        if (req.method === 'trapezoidal') {
            const n = req.subdivisions || 100;
            if (n <= 0) return this.buildResult(req, 'invalid_subdivision_count', null, null, null, valA, valB, orientation, 0, 0, trace, warnings);
            subdivisionCount = n;
            
            const h = (maxBnd - minBnd) / n;
            let sum = (evaluate(minBnd) + evaluate(maxBnd)) / 2;
            for (let i = 1; i < n; i++) {
                sum += evaluate(minBnd + i * h);
            }
            finalValue = sum * h;
            
            trace.push({
                method: 'Composite Trapezoidal',
                interval: [minBnd, maxBnd],
                subdivisionCount: n,
                evaluationCount: evalState.count,
                approximation: finalValue,
                estimatedError: 0, // Not explicitly estimated in standard composite without f''
                tolerance: null
            });

        } else if (req.method === 'simpson') {
            const n = req.subdivisions || 100;
            if (n <= 0) return this.buildResult(req, 'invalid_subdivision_count', null, null, null, valA, valB, orientation, 0, 0, trace, warnings);
            if (n % 2 !== 0) return this.buildResult(req, 'requires_even_subdivision_count', null, null, null, valA, valB, orientation, 0, 0, trace, warnings);
            subdivisionCount = n;

            const h = (maxBnd - minBnd) / n;
            let sum = evaluate(minBnd) + evaluate(maxBnd);
            for (let i = 1; i < n; i += 2) sum += 4 * evaluate(minBnd + i * h);
            for (let i = 2; i < n - 1; i += 2) sum += 2 * evaluate(minBnd + i * h);
            finalValue = sum * h / 3;

            trace.push({
                method: 'Composite Simpson 1/3',
                interval: [minBnd, maxBnd],
                subdivisionCount: n,
                evaluationCount: evalState.count,
                approximation: finalValue,
                estimatedError: 0,
                tolerance: null
            });

        } else if (req.method === 'adaptive_simpson') {
            const tol = req.tolerance !== undefined ? req.tolerance : 1e-6;
            if (tol <= 0) return this.buildResult(req, 'invalid_tolerance', null, null, null, valA, valB, orientation, 0, 0, trace, warnings);
            
            const minWidth = 1e-12; // Safety limit
            let errorSum = 0;

            const adaptiveSimpsonCore = (a: number, b: number, eps: number, depth: number, fa: number, fm: number, fb: number, S: number): number => {
                if (depth > maxRecursionDepth) throw new Error('RESOURCE_LIMIT');
                const h = b - a;
                if (h < minWidth) throw new Error('TOLERANCE_NOT_MET');

                const c = (a + b) / 2;
                const m1 = (a + c) / 2;
                const m2 = (c + b) / 2;
                const fm1 = evaluate(m1);
                const fm2 = evaluate(m2);

                const Sleft = (h / 2) / 6 * (fa + 4 * fm1 + fm);
                const Sright = (h / 2) / 6 * (fm + 4 * fm2 + fb);
                const delta = Sleft + Sright - S;

                if (Math.abs(delta) <= 15 * eps) {
                    errorSum += Math.abs(delta) / 15;
                    return Sleft + Sright + delta / 15;
                }

                subdivisionCount += 2;
                return adaptiveSimpsonCore(a, c, eps / 2, depth + 1, fa, fm1, fm, Sleft) +
                       adaptiveSimpsonCore(c, b, eps / 2, depth + 1, fm, fm2, fb, Sright);
            };

            const fa = evaluate(minBnd);
            const fb = evaluate(maxBnd);
            const m = (minBnd + maxBnd) / 2;
            const fm = evaluate(m);
            const S0 = (maxBnd - minBnd) / 6 * (fa + 4 * fm + fb);
            
            subdivisionCount = 2; // Initial
            finalValue = adaptiveSimpsonCore(minBnd, maxBnd, tol, 1, fa, fm, fb, S0);
            estimatedError = errorSum;
            
            trace.push({
                method: 'Adaptive Simpson',
                interval: [minBnd, maxBnd],
                subdivisionCount,
                evaluationCount: evalState.count,
                approximation: finalValue,
                estimatedError: errorSum,
                tolerance: tol
            });
        }

        if (orientation === -1) {
            finalValue = -finalValue;
        }

        return this.buildResult(req, 'converged', finalValue, estimatedError, req.tolerance || null, valA, valB, orientation, subdivisionCount, evalState.count, trace, warnings);

    } catch (e: any) {
        if (e.message === 'RESOURCE_LIMIT') return this.buildResult(req, 'resource_limit', null, null, req.tolerance || null, valA, valB, orientation, 0, evalState.count, trace, warnings);
        if (e.message === 'NON_FINITE_EVALUATION') return this.buildResult(req, 'non_finite_evaluation', null, null, req.tolerance || null, valA, valB, orientation, 0, evalState.count, trace, warnings);
        if (e.message === 'TOLERANCE_NOT_MET') return this.buildResult(req, 'tolerance_not_met', null, null, req.tolerance || null, valA, valB, orientation, 0, evalState.count, trace, warnings);
        return this.buildResult(req, 'unresolved', null, null, null, valA, valB, orientation, 0, evalState.count, trace, warnings);
    }
  }

  private evaluateNumeric(node: CanonicalAST): number {
     if (node.type === 'Symbol' && (node.name === 'infinity' || node.name === 'inf' || node.name === '\\infty')) return Infinity;
     if (node.type === 'Operator' && node.operator === '*' && node.args.length === 2 && node.args[0].type === 'Number' && node.args[0].value === '-1' && node.args[1].type === 'Symbol' && (node.args[1].name === 'infinity' || node.args[1].name === 'inf')) return -Infinity;
     
     try {
        const val = this.evaluator.evaluate(node, {});
        if (typeof val === 'number') return val;
        return NaN;
     } catch {
        return NaN;
     }
  }

  private buildResult(
    req: NumericalIntegrationRequest, classification: NumericalIntegrationClassification, numericalValue: number | null, estimatedError: number | null, tolerance: number | null,
    lowerBound: number | null, upperBound: number | null, orientation: 1 | -1 | 0, subdivisionCount: number, evaluationCount: number, trace: NumericalIntegrationStep[], warnings: string[]
  ): NumericalIntegrationResult {
    return {
        request: req,
        classification,
        numericalValue,
        estimatedError,
        tolerance,
        method: req.method,
        lowerBound,
        upperBound,
        orientation,
        subdivisionCount,
        evaluationCount,
        trace,
        warnings
    };
  }
}
