import { CanonicalAST } from '../types/ast';
import { MathStep } from '../types/step';
import { DiscontinuityPoint } from '../types/analysis';
import { SolutionSet, Endpoint } from '../types/set';

import { SetEngine } from '../symbolic/sets';
import { InequalityEngine } from '../symbolic/inequality';
import { EquationSolver } from '../symbolic/equation';
import { LimitEngine } from '../symbolic/limit';
import { SymbolicSimplifier } from '../symbolic/simplifier';
import { ASTUtils } from '../symbolic/utils';
import { ASTEvaluator } from '../symbolic/evaluator';


import { AnalysisRationalCodec } from './AnalysisRationalCodec';
/** Domain, intercept and continuity analysis without UI dependencies. */
export class FunctionContinuityService {
  private inequalityEngine = new InequalityEngine();
  private equationSolver = new EquationSolver();
  private limitEngine = new LimitEngine();
  private simplifier = new SymbolicSimplifier();
  private evaluator = new ASTEvaluator();
  private readonly codec = new AnalysisRationalCodec();
public computeDomain(restrictions: any[], variable: string, steps: MathStep[]): SolutionSet {
    if (restrictions.length === 0) {
      return {
        type: 'SolutionSet',
        variable,
        domainRestrictions: [],
        intervals: [{ left: { type: 'infinity', sign: -1 }, right: { type: 'infinity', sign: 1 }, leftClosed: false, rightClosed: false }]
      };
    }

    let combinedDomain: SolutionSet = {
      type: 'SolutionSet',
      variable,
      domainRestrictions: [],
      intervals: [{ left: { type: 'infinity', sign: -1 }, right: { type: 'infinity', sign: 1 }, leftClosed: false, rightClosed: false }]
    };

    for (const r of restrictions) {
      let ineqAST: CanonicalAST;
      if (r.type === 'denominator') {
        ineqAST = { type: 'Inequality', operator: '!=', lhs: r.conditionAST, rhs: { type: 'Number', value: '0' } };
      } else if (r.type === 'logarithm') {
        ineqAST = { type: 'Inequality', operator: '>', lhs: r.conditionAST, rhs: { type: 'Number', value: '0' } };
      } else if (r.type === 'even_root') {
        ineqAST = { type: 'Inequality', operator: '>=', lhs: r.conditionAST, rhs: { type: 'Number', value: '0' } };
      } else if (r.type === 'inverse_trig') {
        // -1 <= cond <= 1 => cond >= -1 AND cond <= 1
        ineqAST = {
          type: 'Function', name: 'and', args: [
            { type: 'Inequality', operator: '>=', lhs: r.conditionAST, rhs: { type: 'Number', value: '-1' } },
            { type: 'Inequality', operator: '<=', lhs: r.conditionAST, rhs: { type: 'Number', value: '1' } }
          ]
        };
      } else {
        continue;
      }

      const res = this.inequalityEngine.solve(ineqAST, variable);
      if (res.kind === 'solution_set') {
        combinedDomain = {
          type: 'SolutionSet',
          variable,
          domainRestrictions: [],
          intervals: SetEngine.intersection(combinedDomain.intervals, res.solution.intervals)
        };
      }
    }
    return combinedDomain;
  }

public computeXIntercepts(ast: CanonicalAST, variable: string, domain: SolutionSet, steps: MathStep[]): Endpoint[] | 'root_isolation_incomplete' {
    const eq: CanonicalAST = { type: 'Equation', lhs: ast, rhs: { type: 'Number', value: '0' } };
    const solverRes = this.equationSolver.solve(eq, variable, { domain: 'real', mode: 'EXACT' });

    if (solverRes.completeness !== 'all_roots_found') {
      return 'root_isolation_incomplete';
    }

    const intercepts: Endpoint[] = [];
    for (const sol of solverRes.finalSolutions) {
      if (sol.exact) {
        const rat = this.codec.astToRational(sol.value);
        if (rat) {
          const pt: Endpoint = { type: 'value', ast: sol.value, rational: rat };
          if (SetEngine.containsEndpoint(domain.intervals, pt)) {
             intercepts.push(pt);
          }
        } else {
          return 'root_isolation_incomplete';
        }
      } else {
        return 'root_isolation_incomplete';
      }
    }
    return intercepts;
  }

public computeYIntercept(ast: CanonicalAST, variable: string, domain: SolutionSet, steps: MathStep[]): Endpoint | undefined {
    const zeroEndpoint: Endpoint = { type: 'value', ast: { type: 'Number', value: '0' }, rational: { num: 0n, den: 1n } };
    if (!SetEngine.containsEndpoint(domain.intervals, zeroEndpoint)) {
      return undefined;
    }

    try {
      const substituted = ASTUtils.substitute(ast, variable, { type: 'Number', value: '0' });
      const simplified = this.simplifier.simplify(substituted);
      if (simplified.type === 'Number' || (simplified.type === 'Operator' && simplified.operator === '/')) {
         return { type: 'value', ast: simplified };
      }
      const numVal = this.evaluator.evaluate(substituted, {});
      return { type: 'value', ast: { type: 'Number', value: numVal.toString() } };
    } catch {
      return undefined;
    }
  }

public findDiscontinuityCandidates(
    restrictions: any[],
    ast: CanonicalAST,
    variable: string
  ): Endpoint[] {
    const candidates: Endpoint[] = [];

    const boundaryRestrictionTypes = new Set([
      'denominator',
      'even_root',
      'logarithm'
    ]);

    for (const restriction of restrictions) {
      if (!boundaryRestrictionTypes.has(restriction.type)) {
        continue;
      }

      const boundaryEquation: CanonicalAST = {
        type: 'Equation',
        lhs: restriction.conditionAST,
        rhs: { type: 'Number', value: '0' }
      };

      try {
        const result = this.equationSolver.solve(
          boundaryEquation,
          variable,
          { domain: 'real', mode: 'EXACT' }
        );

        for (const solution of result.finalSolutions) {
          if (!solution.exact) continue;

          const rational = this.codec.astToRational(solution.value);

          candidates.push({
            type: 'value',
            ast: solution.value,
            ...(rational ? { rational } : {})
          });
        }
      } catch {
        // Failure to isolate a boundary exactly must not abort
        // the complete function analysis.
      }
    }

    const unique = new Map<string, Endpoint>();

    for (const candidate of candidates) {
      if (candidate.type !== 'value') continue;

      const key = ASTUtils.structuralKey(candidate.ast);

      if (!unique.has(key)) {
        unique.set(key, candidate);
      }
    }

    return Array.from(unique.values());
  }

public analyzeContinuity(ast: CanonicalAST, variable: string, candidates: Endpoint[], domain: SolutionSet, steps: MathStep[]): DiscontinuityPoint[] {
    const discontinuities: DiscontinuityPoint[] = [];

    for (const c of candidates) {
      if (c.type !== 'value') continue;

      const cAST = c.ast;
      const inDomain = SetEngine.containsEndpoint(domain.intervals, c);

      let leftDomainAccessible = false;
      let rightDomainAccessible = false;
      // Check if c is adjacent to domain intervals
      for (const iv of domain.intervals) {
        if (SetEngine.exactCompare(c, iv.left) === 0) rightDomainAccessible = true;
        if (SetEngine.exactCompare(c, iv.right) === 0) leftDomainAccessible = true;

        // Also check if c is strictly inside
        const cmpL = SetEngine.exactCompare(iv.left, c);
        const cmpR = SetEngine.exactCompare(c, iv.right);
        if (cmpL !== null && cmpL < 0 && cmpR !== null && cmpR < 0) {
           leftDomainAccessible = true;
           rightDomainAccessible = true;
        }
      }

      try {
        const rat = this.codec.astToRational(cAST);
        if (!rat) continue;
        const approach = Number(rat.num) / Number(rat.den);
        if (isNaN(approach)) continue;

        let limLeft = leftDomainAccessible ? this.limitEngine.evaluateLimit({ expression: ast, variable, approach, direction: 'left' }) : null;
        let limRight = rightDomainAccessible ? this.limitEngine.evaluateLimit({ expression: ast, variable, approach, direction: 'right' }) : null;

        if (leftDomainAccessible && rightDomainAccessible) {
           if (limLeft?.type === 'limit' && limRight?.type === 'limit') {
              const lClass = limLeft.classification;
              const rClass = limRight.classification;

              if (lClass === 'finite' && rClass === 'finite' && limLeft.value && limRight.value && ASTUtils.structuralEquals(limLeft.value, limRight.value)) {
                 if (!inDomain) {
                    discontinuities.push({ point: c, status: 'removable_discontinuity', limitValue: limLeft.value });
                 } else {
                    // It is continuous
                 }
              } else if (['+infinity', '-infinity'].includes(lClass) || ['+infinity', '-infinity'].includes(rClass)) {
                 discontinuities.push({ point: c, status: 'infinite_discontinuity' });
              } else {
                 discontinuities.push({ point: c, status: 'jump_discontinuity' });
              }
           } else {
              discontinuities.push({ point: c, status: 'unresolved' });
           }
        } else {
           // Domain boundary
           discontinuities.push({
              point: c,
              status: 'domain_boundary',
              leftDomainAccessible,
              rightDomainAccessible
           });
        }
      } catch {
         discontinuities.push({ point: c, status: 'unresolved' });
      }
    }
    return discontinuities;
  }
}
