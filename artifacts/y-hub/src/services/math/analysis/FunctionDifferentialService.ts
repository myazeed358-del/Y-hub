import { CanonicalAST } from '../types/ast';
import { MathStep } from '../types/step';
import { DiscontinuityPoint, CriticalPoint, ExtremaPoint, InflectionPoint } from '../types/analysis';
import { SolutionSet, Interval, Endpoint } from '../types/set';
import { DomainAnalyzer } from '../domain';
import { SetEngine } from '../symbolic/sets';
import { InequalityEngine } from '../symbolic/inequality';
import { EquationSolver } from '../symbolic/equation';

import { SymbolicSimplifier } from '../symbolic/simplifier';
import { ASTUtils } from '../symbolic/utils';


import { AnalysisRationalCodec } from './AnalysisRationalCodec';
/** Derivative-dependent graph properties without UI dependencies. */
export class FunctionDifferentialService {
  private inequalityEngine = new InequalityEngine();
  private equationSolver = new EquationSolver();
  private domainAnalyzer = new DomainAnalyzer();
  private simplifier = new SymbolicSimplifier();
  private readonly codec = new AnalysisRationalCodec();
public findCriticalPoints(fPrime: CanonicalAST, fPrimeDomain: SolutionSet, fDomain: SolutionSet, variable: string, steps: MathStep[]): CriticalPoint[] {
    const cps: Map<string, CriticalPoint> = new Map();

    // Helper to add CP
    const addCP = (pt: Endpoint, src: 'derivative_zero' | 'derivative_undefined_in_domain') => {
      if (pt.type !== 'value') return;
      const s = ASTUtils.structuralKey(pt.ast);
      if (!cps.has(s)) {
        cps.set(s, {
          point: pt,
          source: [src],
          inFunctionDomain: SetEngine.containsEndpoint(fDomain.intervals, pt),
          derivativeDefined: SetEngine.containsEndpoint(fPrimeDomain.intervals, pt),
          functionDefined: SetEngine.containsEndpoint(fDomain.intervals, pt),
        });
      } else {
        const existing = cps.get(s)!;
        if (!existing.source.includes(src)) existing.source.push(src);
      }
    };

    // 1. f'(x) = 0
    const eq: CanonicalAST = { type: 'Equation', lhs: fPrime, rhs: { type: 'Number', value: '0' } };
    const solverRes = this.equationSolver.solve(eq, variable, { domain: 'real', mode: 'EXACT' });
    if (solverRes.completeness === 'all_roots_found') {
      for (const sol of solverRes.finalSolutions) {
        if (sol.exact) {
          const rat = this.codec.astToRational(sol.value);
          if (rat) {
             const pt: Endpoint = { type: 'value', ast: sol.value, rational: rat };
             if (SetEngine.containsEndpoint(fDomain.intervals, pt)) {
                addCP(pt, 'derivative_zero');
             }
          }
        }
      }
    }

    // 2. f'(x) undefined inside Domain(f)
    // fPrimeDomain gives where f'(x) is defined. If a point is in fDomain but NOT in fPrimeDomain, and it's a boundary of fPrimeDomain...
    // Let's just find the roots of fPrime restrictions!
    const restrictions = this.domainAnalyzer.analyze(fPrime);
    for (const r of restrictions) {
      if (r.type === 'denominator' || r.type === 'even_root' || r.type === 'logarithm') {
        const rEq: CanonicalAST = { type: 'Equation', lhs: r.conditionAST, rhs: { type: 'Number', value: '0' } };
        const rRes = this.equationSolver.solve(rEq, variable, { domain: 'real', mode: 'EXACT' });
        if (rRes.completeness === 'all_roots_found') {
          for (const sol of rRes.finalSolutions) {
            if (sol.exact) {
              const rat = this.codec.astToRational(sol.value);
              if (rat) {
                const pt: Endpoint = { type: 'value', ast: sol.value, rational: rat };
                if (SetEngine.containsEndpoint(fDomain.intervals, pt)) {
                   addCP(pt, 'derivative_undefined_in_domain');
                }
              }
            }
          }
        }
      }
    }

    return Array.from(cps.values());
  }

public analyzeMonotonicity(
    fPrime: CanonicalAST,
    fDomain: SolutionSet,
    variable: string,
    discontinuities: DiscontinuityPoint[]
  ): {
    increasingIntervals: Interval[],
    decreasingIntervals: Interval[]
  } {
    const incEq: CanonicalAST = {
      type: 'Inequality',
      operator: '>',
      lhs: fPrime,
      rhs: { type: 'Number', value: '0' }
    };

    const decEq: CanonicalAST = {
      type: 'Inequality',
      operator: '<',
      lhs: fPrime,
      rhs: { type: 'Number', value: '0' }
    };

    let increasingIntervals: Interval[] = [];
    let decreasingIntervals: Interval[] = [];

    try {
      const incRes = this.inequalityEngine.solve(incEq, variable);

      if (incRes.kind === 'solution_set') {
        increasingIntervals = SetEngine.intersection(
          incRes.solution.intervals,
          fDomain.intervals
        );
      }
    } catch {
      increasingIntervals = [];
    }

    try {
      const decRes = this.inequalityEngine.solve(decEq, variable);

      if (decRes.kind === 'solution_set') {
        decreasingIntervals = SetEngine.intersection(
          decRes.solution.intervals,
          fDomain.intervals
        );
      }
    } catch {
      decreasingIntervals = [];
    }

    return {
      increasingIntervals,
      decreasingIntervals
    };
  }

public findExtrema(cps: CriticalPoint[], inc: Interval[], dec: Interval[], domain: SolutionSet): ExtremaPoint[] {
    const extrema: ExtremaPoint[] = [];
    for (const cp of cps) {
       let leftInc = false;
       let leftDec = false;
       let rightInc = false;
       let rightDec = false;

       for (const iv of inc) {
         if (SetEngine.exactCompare(iv.right, cp.point) === 0) leftInc = true;
         if (SetEngine.exactCompare(iv.left, cp.point) === 0) rightInc = true;
       }
       for (const iv of dec) {
         if (SetEngine.exactCompare(iv.right, cp.point) === 0) leftDec = true;
         if (SetEngine.exactCompare(iv.left, cp.point) === 0) rightDec = true;
       }

       if (leftInc && rightDec) extrema.push({ point: cp.point, type: 'local_maximum' });
       else if (leftDec && rightInc) extrema.push({ point: cp.point, type: 'local_minimum' });
    }

    // Domain endpoints
    for (const iv of domain.intervals) {
       if (iv.leftClosed && iv.left.type === 'value') {
          let rightInc = false;
          let rightDec = false;
          for (const i of inc) if (SetEngine.exactCompare(i.left, iv.left) === 0) rightInc = true;
          for (const i of dec) if (SetEngine.exactCompare(i.left, iv.left) === 0) rightDec = true;
          if (rightInc) extrema.push({ point: iv.left, type: 'local_minimum' });
          else if (rightDec) extrema.push({ point: iv.left, type: 'local_maximum' });
       }
       if (iv.rightClosed && iv.right.type === 'value') {
          let leftInc = false;
          let leftDec = false;
          for (const i of inc) if (SetEngine.exactCompare(i.right, iv.right) === 0) leftInc = true;
          for (const i of dec) if (SetEngine.exactCompare(i.right, iv.right) === 0) leftDec = true;
          if (leftInc) extrema.push({ point: iv.right, type: 'local_maximum' });
          else if (leftDec) extrema.push({ point: iv.right, type: 'local_minimum' });
       }
    }

    // Deduplicate
    const unique = new Map<string, ExtremaPoint>();
    for (const e of extrema) {
      if (e.point.type === 'value') unique.set(ASTUtils.structuralKey(e.point.ast), e);
    }
    return Array.from(unique.values());
  }

public analyzeConcavity(
    fDoublePrime: CanonicalAST,
    fDomain: SolutionSet,
    variable: string
  ): {
    concaveUpIntervals: Interval[],
    concaveDownIntervals: Interval[]
  } {
    const upEq: CanonicalAST = {
      type: 'Inequality',
      operator: '>',
      lhs: fDoublePrime,
      rhs: { type: 'Number', value: '0' }
    };

    const downEq: CanonicalAST = {
      type: 'Inequality',
      operator: '<',
      lhs: fDoublePrime,
      rhs: { type: 'Number', value: '0' }
    };

    let concaveUpIntervals: Interval[] = [];
    let concaveDownIntervals: Interval[] = [];

    try {
      const upRes = this.inequalityEngine.solve(upEq, variable);

      if (upRes.kind === 'solution_set') {
        concaveUpIntervals = SetEngine.intersection(
          upRes.solution.intervals,
          fDomain.intervals
        );
      }
    } catch {
      concaveUpIntervals = [];
    }

    try {
      const downRes = this.inequalityEngine.solve(downEq, variable);

      if (downRes.kind === 'solution_set') {
        concaveDownIntervals = SetEngine.intersection(
          downRes.solution.intervals,
          fDomain.intervals
        );
      }
    } catch {
      concaveDownIntervals = [];
    }

    return {
      concaveUpIntervals,
      concaveDownIntervals
    };
  }

public findInflectionPoints(
    fDoublePrime: CanonicalAST,
    fd2Domain: SolutionSet,
    up: Interval[],
    down: Interval[],
    domain: SolutionSet,
    variable: string
  ): InflectionPoint[] {
    const inflectionPoints: InflectionPoint[] = [];
    const candidates: Endpoint[] = [];

    const simplifiedSecondDerivative =
      this.simplifier.simplify(fDoublePrime);

    const identicallyZero =
      simplifiedSecondDerivative.type === 'Number' &&
      Number(simplifiedSecondDerivative.value) === 0;

    /*
     * f'' ≡ 0 has an infinite zero set, not isolated candidates.
     * Inflection points require an actual concavity change, so there is
     * nothing useful to isolate from the equation f'' = 0 in this case.
     */
    if (!identicallyZero) {
      const equation: CanonicalAST = {
        type: 'Equation',
        lhs: simplifiedSecondDerivative,
        rhs: { type: 'Number', value: '0' }
      };

      try {
        const result = this.equationSolver.solve(
          equation,
          variable,
          { domain: 'real', mode: 'EXACT' }
        );

        if (result.completeness === 'all_roots_found') {
          for (const solution of result.finalSolutions) {
            if (!solution.exact) continue;

            const rational = this.codec.astToRational(solution.value);

            if (rational) {
              candidates.push({
                type: 'value',
                ast: solution.value,
                rational
              });
            }
          }
        }
      } catch {
        // Unsupported or non-isolated zero sets do not create
        // trustworthy isolated inflection candidates.
      }
    }

    /*
     * Points where f'' is undefined may still be inflection candidates
     * when the original function itself is defined there.
     */
    const restrictions =
      this.domainAnalyzer.analyze(simplifiedSecondDerivative);

    for (const restriction of restrictions) {
      if (
        restriction.type !== 'denominator' &&
        restriction.type !== 'even_root' &&
        restriction.type !== 'logarithm'
      ) {
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

        if (result.completeness !== 'all_roots_found') {
          continue;
        }

        for (const solution of result.finalSolutions) {
          if (!solution.exact) continue;

          const rational = this.codec.astToRational(solution.value);

          if (rational) {
            candidates.push({
              type: 'value',
              ast: solution.value,
              rational
            });
          }
        }
      } catch {
        // Not every symbolic boundary can be isolated exactly.
      }
    }

    const uniqueCandidates = new Map<string, Endpoint>();

    for (const candidate of candidates) {
      if (candidate.type !== 'value') continue;

      uniqueCandidates.set(
        ASTUtils.structuralKey(candidate.ast),
        candidate
      );
    }

    for (const candidate of uniqueCandidates.values()) {
      if (!SetEngine.containsEndpoint(domain.intervals, candidate)) {
        continue;
      }

      let leftUp = false;
      let leftDown = false;
      let rightUp = false;
      let rightDown = false;

      for (const interval of up) {
        if (SetEngine.exactCompare(interval.right, candidate) === 0) {
          leftUp = true;
        }

        if (SetEngine.exactCompare(interval.left, candidate) === 0) {
          rightUp = true;
        }
      }

      for (const interval of down) {
        if (SetEngine.exactCompare(interval.right, candidate) === 0) {
          leftDown = true;
        }

        if (SetEngine.exactCompare(interval.left, candidate) === 0) {
          rightDown = true;
        }
      }

      if (
        (leftUp && rightDown) ||
        (leftDown && rightUp)
      ) {
        inflectionPoints.push({
          point: candidate,
          status: 'inflection_point'
        });
      }
    }

    return inflectionPoints;
  }
}
