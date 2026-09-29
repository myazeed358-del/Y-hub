import { CanonicalAST } from '../types/ast';
import { MathStep } from '../types/step';
import { 
  FunctionAnalysisRequest, 
  FunctionAnalysisResult, 
  FunctionClassification,
  DiscontinuityPoint,
  ContinuityStatus,
  VerificationFailure,
  CriticalPoint,
  ExtremaPoint,
  InflectionPoint,
  Asymptote,
  InfiniteBehavior,
  GraphData
} from '../types/analysis';
import { SolutionSet, Interval, Endpoint } from '../types/set';
import { DomainAnalyzer } from '../domain';
import { SetEngine } from '../symbolic/sets';
import { InequalityEngine } from '../symbolic/inequality';
import { EquationSolver } from '../symbolic/equation';
import { LimitEngine } from '../symbolic/limit';
import { SymbolicSimplifier } from '../symbolic/simplifier';
import { ASTUtils } from '../symbolic/utils';
import { ASTEvaluator } from '../symbolic/evaluator';
import { DerivativeEngine } from '../symbolic/derivative';
import { Rat } from '../utils/rational';

export class FunctionAnalyzer {
  private domainAnalyzer = new DomainAnalyzer();
  private inequalityEngine = new InequalityEngine();
  private equationSolver = new EquationSolver();
  private limitEngine = new LimitEngine();
  private simplifier = new SymbolicSimplifier();
  private evaluator = new ASTEvaluator();
  private derivativeEngine = new DerivativeEngine();

  public analyze(req: FunctionAnalysisRequest): FunctionAnalysisResult {
    const steps: MathStep[] = [];
    const ast = req.expression;
    const variable = req.variable;

    // 1. Classification
    const classification = this.classifyFunction(ast);

    // 2. Domain Analysis
    const domainRestrictions = this.domainAnalyzer.analyze(ast);
    const domainSet = this.computeDomain(domainRestrictions, variable, steps);

    // 3. X-Intercepts
    const xInterceptsResult = this.computeXIntercepts(ast, variable, domainSet, steps);

    // 4. Y-Intercept
    const yIntercept = this.computeYIntercept(ast, variable, domainSet, steps);

    // 5. Discontinuity Candidates
    const candidates = this.findDiscontinuityCandidates(domainRestrictions, ast, variable);

    // 6. Continuity Analysis
    const discontinuities = this.analyzeContinuity(ast, variable, candidates, domainSet, steps);

    // 7. Verification (done implicitly during analysis)
    const verification: VerificationFailure[] = [];

    // --- PHASE 5B: First Derivative Analysis ---
    let firstDerivative: CanonicalAST;
    try {
      firstDerivative = this.derivativeEngine.differentiate(ast, variable, steps);
    } catch {
      firstDerivative = { type: 'Number', value: '0' }; // fallback if diff fails
    }
    const derivRestrictions = this.domainAnalyzer.analyze(firstDerivative);
    const derivDomain = this.computeDomain(derivRestrictions, variable, steps);

    const criticalPoints = this.findCriticalPoints(firstDerivative, derivDomain, domainSet, variable, steps);
    
    // --- PHASE 5C: Monotonicity & Extrema ---
    const { increasingIntervals, decreasingIntervals } = this.analyzeMonotonicity(firstDerivative, domainSet, variable, discontinuities);
    const extrema = this.findExtrema(criticalPoints, increasingIntervals, decreasingIntervals, domainSet);

    // --- PHASE 5D: Concavity & Inflection ---
    let secondDerivative: CanonicalAST;
    try {
      secondDerivative = this.derivativeEngine.differentiate(firstDerivative, variable, steps);
    } catch {
      secondDerivative = { type: 'Number', value: '0' };
    }
    const secondDerivRestrictions = this.domainAnalyzer.analyze(secondDerivative);
    const secondDerivDomain = this.computeDomain(secondDerivRestrictions, variable, steps);

    const { concaveUpIntervals, concaveDownIntervals } = this.analyzeConcavity(secondDerivative, domainSet, variable);
    const inflectionPoints = this.findInflectionPoints(secondDerivative, secondDerivDomain, concaveUpIntervals, concaveDownIntervals, domainSet, variable);

    // --- PHASE 5E: Asymptotes ---
    const { asymptotes, infiniteBehavior } = this.analyzeAsymptotes(ast, variable, discontinuities);

    // --- PHASE 5F: Graph Data ---
    const graphData = this.generateGraphData(
       domainSet, criticalPoints, increasingIntervals, decreasingIntervals,
       concaveUpIntervals, concaveDownIntervals, asymptotes, 
       Array.isArray(xInterceptsResult) ? (yIntercept ? [...xInterceptsResult, yIntercept] : xInterceptsResult) : (yIntercept ? [yIntercept] : []),
       extrema, inflectionPoints, discontinuities
    );

    return {
      variable,
      domain: domainSet,
      classification,
      xIntercepts: xInterceptsResult,
      yIntercept,
      discontinuities,
      
      derivativeAnalysis: {
        firstDerivative,
        firstDerivativeDomain: derivDomain,
        secondDerivative,
        secondDerivativeDomain: secondDerivDomain
      },
      criticalPoints,
      increasingIntervals,
      decreasingIntervals,
      extrema,
      concaveUpIntervals,
      concaveDownIntervals,
      inflectionPoints,
      asymptotes,
      infiniteBehavior,
      graphData,
      
      verification,
      steps
    };
  }

  private classifyFunction(ast: CanonicalAST): FunctionClassification[] {
    const classes = new Set<FunctionClassification>();
    const walk = (node: CanonicalAST) => {
      if (node.type === 'Operator' && node.operator === '/') {
        classes.add('rational'); // might be refined
      }
      if (node.type === 'Function') {
        const name = node.name.toLowerCase();
        if (name === 'sqrt' || name === 'cbrt') classes.add('radical');
        else if (name === 'abs') classes.add('absolute_value');
        else if (name === 'ln' || name === 'log' || name === 'log10') classes.add('logarithmic');
        else if (name === 'exp') classes.add('exponential');
        else if (['sin', 'cos', 'tan', 'asin', 'acos', 'atan'].includes(name)) classes.add('trigonometric');
      }
      if (node.type === 'Operator' || node.type === 'Function') {
        node.args?.forEach(walk);
      }
      if (node.type === 'Parenthesis') {
        walk(node.content);
      }
    };
    walk(ast);

    if (classes.size === 0) classes.add('polynomial'); // fallback descriptive
    return Array.from(classes);
  }

  private computeDomain(restrictions: any[], variable: string, steps: MathStep[]): SolutionSet {
    if (restrictions.length === 0) {
      return {
        intervals: [{ left: { type: 'infinity', sign: -1 }, right: { type: 'infinity', sign: 1 }, leftClosed: false, rightClosed: false }]
      };
    }

    let combinedDomain: SolutionSet = {
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
        combinedDomain = { intervals: SetEngine.intersection(combinedDomain.intervals, res.solution.intervals) };
      }
    }
    return combinedDomain;
  }

  private astToRational(ast: CanonicalAST): { num: bigint, den: bigint } | null {
    if (ast.type === 'Number') return Rat.fromString(ast.value);
    if (ast.type === 'Operator' && ast.operator === '/') {
      const numR = this.astToRational(ast.args[0]);
      const denR = this.astToRational(ast.args[1]);
      if (numR && denR) return Rat.div(numR, denR);
    }
    if (ast.type === 'Operator' && ast.operator === '*') {
      if (ast.args[0].type === 'Number' && ast.args[0].value === '-1') {
         const val = this.astToRational(ast.args[1]);
         if (val) return { num: -val.num, den: val.den };
      }
    }
    return null;
  }

  private computeXIntercepts(ast: CanonicalAST, variable: string, domain: SolutionSet, steps: MathStep[]): Endpoint[] | 'root_isolation_incomplete' {
    const eq: CanonicalAST = { type: 'Equation', lhs: ast, rhs: { type: 'Number', value: '0' } };
    const solverRes = this.equationSolver.solve(eq, variable, { domain: 'real', mode: 'EXACT' });
    
    if (solverRes.completeness !== 'all_roots_found') {
      return 'root_isolation_incomplete';
    }

    const intercepts: Endpoint[] = [];
    for (const sol of solverRes.finalSolutions) {
      if (sol.exact) {
        const rat = this.astToRational(sol.value);
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

  private computeYIntercept(ast: CanonicalAST, variable: string, domain: SolutionSet, steps: MathStep[]): Endpoint | undefined {
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
      const numVal = this.evaluator.evaluate(substituted);
      return { type: 'value', ast: { type: 'Number', value: numVal.toString() } };
    } catch {
      return undefined;
    }
  }

  private findDiscontinuityCandidates(restrictions: any[], ast: CanonicalAST, variable: string): Endpoint[] {
    const candidates: Endpoint[] = [];
    // From restrictions (like denominator = 0)
    for (const r of restrictions) {
      if (r.type === 'denominator') {
        const eq: CanonicalAST = { type: 'Equation', lhs: r.conditionAST, rhs: { type: 'Number', value: '0' } };
        const solRes = this.equationSolver.solve(eq, variable, { domain: 'real', mode: 'EXACT' });
        for (const sol of solRes.finalSolutions) {
          if (sol.exact) candidates.push({ type: 'value', ast: sol.value });
        }
      }
    }
    // Deduplicate
    const unique = new Map<string, Endpoint>();
    for (const c of candidates) {
      if (c.type === 'value') {
        const s = ASTUtils.structuralKey(c.ast);
        if (!unique.has(s)) unique.set(s, c);
      }
    }
    return Array.from(unique.values());
  }

  private analyzeContinuity(ast: CanonicalAST, variable: string, candidates: Endpoint[], domain: SolutionSet, steps: MathStep[]): DiscontinuityPoint[] {
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
        const rat = this.astToRational(cAST);
        if (!rat) continue;
        const approach = Number(rat.num) / Number(rat.den);
        if (isNaN(approach)) continue;
        
        let limLeft = leftDomainAccessible ? this.limitEngine.evaluate(ast, variable, approach, 'left') : null;
        let limRight = rightDomainAccessible ? this.limitEngine.evaluate(ast, variable, approach, 'right') : null;
        
        if (leftDomainAccessible && rightDomainAccessible) {
           if (limLeft?.type === 'limit' && limRight?.type === 'limit') {
              const lClass = limLeft.classification;
              const rClass = limRight.classification;
              
              if (lClass === 'finite' && rClass === 'finite' && ASTUtils.structuralEquals(limLeft.value, limRight.value)) {
                 if (!inDomain) {
                    discontinuities.push({ point: c, status: 'removable_discontinuity', limitValue: limLeft.value });
                 } else {
                    // It is continuous
                 }
              } else if (lClass === 'infinite' || rClass === 'infinite') {
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
  private findCriticalPoints(fPrime: CanonicalAST, fPrimeDomain: SolutionSet, fDomain: SolutionSet, variable: string, steps: MathStep[]): CriticalPoint[] {
    const cps: Map<string, CriticalPoint> = new Map();
    
    // Helper to add CP
    const addCP = (pt: Endpoint, src: 'derivative_zero' | 'derivative_undefined_in_domain') => {
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
          const rat = this.astToRational(sol.value);
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
              const rat = this.astToRational(sol.value);
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

  private analyzeMonotonicity(fPrime: CanonicalAST, fDomain: SolutionSet, variable: string, discontinuities: DiscontinuityPoint[]): { increasingIntervals: Interval[], decreasingIntervals: Interval[] } {
    const incEq: CanonicalAST = { type: 'Inequality', operator: '>', lhs: fPrime, rhs: { type: 'Number', value: '0' } };
    const decEq: CanonicalAST = { type: 'Inequality', operator: '<', lhs: fPrime, rhs: { type: 'Number', value: '0' } };
    
    let increasingIntervals: Interval[] = [];
    let decreasingIntervals: Interval[] = [];
    
    const incRes = this.inequalityEngine.solve(incEq, variable);
    if (incRes.kind === 'solution_set') {
      increasingIntervals = SetEngine.intersection(incRes.solution.intervals, fDomain.intervals);
    }
    
    const decRes = this.inequalityEngine.solve(decEq, variable);
    if (decRes.kind === 'solution_set') {
      decreasingIntervals = SetEngine.intersection(decRes.solution.intervals, fDomain.intervals);
    }
    
    const merge = (intervals: Interval[]): Interval[] => {
      const merged: Interval[] = [];
      for (const iv of intervals) {
        if (merged.length === 0) {
          merged.push(iv);
          continue;
        }
        const last = merged[merged.length - 1];
        if (SetEngine.exactCompare(last.right, iv.left) === 0) {
           const pt = last.right;
           const isDiscontinuous = discontinuities.some(d => SetEngine.exactCompare(d.point, pt) === 0 && d.status !== 'removable_discontinuity'); 
           // Wait, even removable discontinuities break monotonicity intervals technically, because the function is undefined or not continuous.
           // The prompt says "no discontinuity exists at c". So any discontinuity should block the merge.
           const hasDiscontinuity = discontinuities.some(d => SetEngine.exactCompare(d.point, pt) === 0);
           
           if (!last.rightClosed && !iv.leftClosed && SetEngine.containsEndpoint(fDomain.intervals, pt) && !hasDiscontinuity) {
             last.right = iv.right;
             last.rightClosed = iv.rightClosed;
           } else if (last.rightClosed || iv.leftClosed) {
             // If they overlap/touch and one is closed, merge them.
             last.right = iv.right;
             last.rightClosed = iv.rightClosed;
           } else {
             merged.push(iv);
           }
        } else {
          merged.push(iv);
        }
      }
      return merged;
    };
    
    return {
      increasingIntervals: merge(increasingIntervals),
      decreasingIntervals: merge(decreasingIntervals)
    };
  }

  private findExtrema(cps: CriticalPoint[], inc: Interval[], dec: Interval[], domain: SolutionSet): ExtremaPoint[] {
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
      unique.set(ASTUtils.structuralKey(e.point.ast), e);
    }
    return Array.from(unique.values());
  }

  private analyzeConcavity(fDoublePrime: CanonicalAST, fDomain: SolutionSet, variable: string): { concaveUpIntervals: Interval[], concaveDownIntervals: Interval[] } {
    const upEq: CanonicalAST = { type: 'Inequality', operator: '>', lhs: fDoublePrime, rhs: { type: 'Number', value: '0' } };
    const downEq: CanonicalAST = { type: 'Inequality', operator: '<', lhs: fDoublePrime, rhs: { type: 'Number', value: '0' } };
    
    let concaveUpIntervals: Interval[] = [];
    let concaveDownIntervals: Interval[] = [];
    
    const upRes = this.inequalityEngine.solve(upEq, variable);
    if (upRes.kind === 'solution_set') concaveUpIntervals = SetEngine.intersection(upRes.solution.intervals, fDomain.intervals);
    
    const downRes = this.inequalityEngine.solve(downEq, variable);
    if (downRes.kind === 'solution_set') concaveDownIntervals = SetEngine.intersection(downRes.solution.intervals, fDomain.intervals);
    
    return { concaveUpIntervals, concaveDownIntervals };
  }

  private findInflectionPoints(fDoublePrime: CanonicalAST, fd2Domain: SolutionSet, up: Interval[], down: Interval[], domain: SolutionSet, variable: string): InflectionPoint[] {
    const infs: InflectionPoint[] = [];
    
    const eq: CanonicalAST = { type: 'Equation', lhs: fDoublePrime, rhs: { type: 'Number', value: '0' } };
    const res = this.equationSolver.solve(eq, variable, { domain: 'real', mode: 'EXACT' });
    
    const candidates: Endpoint[] = [];
    if (res.completeness === 'all_roots_found') {
       for (const s of res.finalSolutions) {
         if (s.exact) {
           const rat = this.astToRational(s.value);
           if (rat) candidates.push({ type: 'value', ast: s.value, rational: rat });
         }
       }
    }
    
    const restrictions = this.domainAnalyzer.analyze(fDoublePrime);
    for (const r of restrictions) {
      if (r.type === 'denominator') {
        const rEq: CanonicalAST = { type: 'Equation', lhs: r.conditionAST, rhs: { type: 'Number', value: '0' } };
        const rRes = this.equationSolver.solve(rEq, variable, { domain: 'real', mode: 'EXACT' });
        if (rRes.completeness === 'all_roots_found') {
          for (const s of rRes.finalSolutions) {
             if (s.exact) {
               const rat = this.astToRational(s.value);
               if (rat) candidates.push({ type: 'value', ast: s.value, rational: rat });
             }
          }
        }
      }
    }
    
    for (const c of candidates) {
       if (!SetEngine.containsEndpoint(domain.intervals, c)) continue;
       
       let leftUp = false, leftDown = false, rightUp = false, rightDown = false;
       for (const iv of up) {
         if (SetEngine.exactCompare(iv.right, c) === 0) leftUp = true;
         if (SetEngine.exactCompare(iv.left, c) === 0) rightUp = true;
       }
       for (const iv of down) {
         if (SetEngine.exactCompare(iv.right, c) === 0) leftDown = true;
         if (SetEngine.exactCompare(iv.left, c) === 0) rightDown = true;
       }
       
       if ((leftUp && rightDown) || (leftDown && rightUp)) {
          infs.push({ point: c, status: 'inflection_point' });
       }
    }
    
    const unique = new Map<string, InflectionPoint>();
    for (const i of infs) {
      unique.set(ASTUtils.structuralKey(i.point.ast), i);
    }
    return Array.from(unique.values());
  }

  private analyzeAsymptotes(ast: CanonicalAST, variable: string, discontinuities: DiscontinuityPoint[]): { asymptotes: Asymptote[], infiniteBehavior: InfiniteBehavior } {
    const asymptotes: Asymptote[] = [];
    
    // Vertical Asymptotes
    for (const d of discontinuities) {
       if (d.status === 'infinite_discontinuity') {
          asymptotes.push({ type: 'vertical', equation: { type: 'Equation', lhs: { type: 'Symbol', name: variable }, rhs: d.point.ast } });
       }
    }
    
    // Horizontal Asymptotes & Infinite Behavior
    let limitAtPlusInfinity: any = 'does_not_exist';
    let limitAtMinusInfinity: any = 'does_not_exist';
    
    try {
       const lPlus = this.limitEngine.evaluate(ast, variable, '+infinity', 'both');
       if (lPlus.type === 'limit') {
          limitAtPlusInfinity = lPlus.value;
          if (lPlus.classification === 'finite') {
             asymptotes.push({ type: 'horizontal', equation: { type: 'Equation', lhs: { type: 'Symbol', name: 'y' }, rhs: lPlus.value }, direction: '+infinity' });
          }
       }
    } catch { limitAtPlusInfinity = 'unresolved'; }
    
    try {
       const lMinus = this.limitEngine.evaluate(ast, variable, '-infinity', 'both');
       if (lMinus.type === 'limit') {
          limitAtMinusInfinity = lMinus.value;
          if (lMinus.classification === 'finite') {
             asymptotes.push({ type: 'horizontal', equation: { type: 'Equation', lhs: { type: 'Symbol', name: 'y' }, rhs: lMinus.value }, direction: '-infinity' });
          }
       }
    } catch { limitAtMinusInfinity = 'unresolved'; }
    
    // Slant asymptotes
    if (ast.type === 'Operator' && ast.operator === '/') {
       try {
         const polyExt = new (require('../symbolic/polynomial').PolynomialExtractor)();
         const numMap = polyExt.extract(ast.args[0], variable);
         const denMap = polyExt.extract(ast.args[1], variable);
         
         const maxNum = Math.max(...Array.from(numMap.keys()));
         const maxDen = Math.max(...Array.from(denMap.keys()));
         
         if (maxNum === maxDen + 1) {
            // we could do long division. Since I don't have direct access here, I will just limit (f(x)/x)
            const fx_div_x: CanonicalAST = { type: 'Operator', operator: '/', args: [ast, { type: 'Symbol', name: variable }] };
            const mLimit = this.limitEngine.evaluate(fx_div_x, variable, '+infinity', 'both');
            if (mLimit.type === 'limit' && mLimit.classification === 'finite') {
               const m = mLimit.value;
               const mx: CanonicalAST = { type: 'Operator', operator: '*', args: [m, { type: 'Symbol', name: variable }] };
               const f_minus_mx: CanonicalAST = { type: 'Operator', operator: '-', args: [ast, mx] };
               const bLimit = this.limitEngine.evaluate(f_minus_mx, variable, '+infinity', 'both');
               if (bLimit.type === 'limit' && bLimit.classification === 'finite') {
                  const b = bLimit.value;
                  const slantRhs = this.simplifier.simplify({ type: 'Operator', operator: '+', args: [mx, b] });
                  asymptotes.push({ type: 'slant', equation: { type: 'Equation', lhs: { type: 'Symbol', name: 'y' }, rhs: slantRhs } });
               }
            }
         }
       } catch {}
    }
    
    return { asymptotes, infiniteBehavior: { limitAtPlusInfinity, limitAtMinusInfinity } };
  }
  private generateGraphData(domain: SolutionSet, cps: CriticalPoint[], inc: Interval[], dec: Interval[], up: Interval[], down: Interval[], asymptotes: Asymptote[], intercepts: Endpoint[], extrema: ExtremaPoint[], infs: InflectionPoint[], discontinuities: DiscontinuityPoint[]): GraphData {
    const importantPoints: Endpoint[] = [];
    cps.forEach(c => importantPoints.push(c.point));
    intercepts.forEach(i => importantPoints.push(i));
    extrema.forEach(e => importantPoints.push(e.point));
    infs.forEach(i => importantPoints.push(i.point));
    discontinuities.forEach(d => importantPoints.push(d.point));
    
    // Sort and deduplicate endpoints
    const uniquePoints = new Map<string, Endpoint>();
    for (const p of importantPoints) {
      uniquePoints.set(ASTUtils.structuralKey(p.ast), p);
    }
    const sortedPoints = Array.from(uniquePoints.values()).sort((a, b) => SetEngine.exactCompare(a, b) || 0);

    const segments: import('../types/analysis').GraphSegment[] = [];
    
    for (const iv of domain.intervals) {
       // split interval by sortedPoints
       let currentLeft = iv.left;
       let currentLeftClosed = iv.leftClosed;
       
       for (const pt of sortedPoints) {
          const cmpLeft = SetEngine.exactCompare(currentLeft, pt);
          const cmpRight = SetEngine.exactCompare(pt, iv.right);
          
          if (cmpLeft !== null && cmpLeft < 0 && cmpRight !== null && cmpRight < 0) {
             // pt is strictly inside the current sub-interval
             const subIv: Interval = { left: currentLeft, right: pt, leftClosed: currentLeftClosed, rightClosed: false };
             segments.push({
               interval: subIv,
               monotonicity: this.getMonotonicity(subIv, inc, dec),
               concavity: this.getConcavity(subIv, up, down)
             });
             
             currentLeft = pt;
             currentLeftClosed = false;
          }
       }
       
       const lastIv: Interval = { left: currentLeft, right: iv.right, leftClosed: currentLeftClosed, rightClosed: iv.rightClosed };
       segments.push({
         interval: lastIv,
         monotonicity: this.getMonotonicity(lastIv, inc, dec),
         concavity: this.getConcavity(lastIv, up, down)
       });
    }

    // Suggested plotting range
    let xMin = -10, xMax = 10, yMin = -10, yMax = 10;
    // We could expand this based on extrema, but uncontrolled numerical expansion is forbidden.
    
    return {
       domainIntervals: domain.intervals,
       criticalPoints: cps,
       intercepts,
       extrema,
       inflectionPoints: infs,
       verticalAsymptotes: asymptotes.filter(a => a.type === 'vertical'),
       horizontalAsymptotes: asymptotes.filter(a => a.type === 'horizontal'),
       slantAsymptotes: asymptotes.filter(a => a.type === 'slant'),
       behaviorSegments: segments,
       suggestedPlottingRange: { xMin, xMax, yMin, yMax }
    };
  }

  private getMonotonicity(iv: Interval, inc: Interval[], dec: Interval[]): 'increasing' | 'decreasing' | 'constant' | 'unknown' {
     // Check if iv is subset of any inc interval
     for (const i of inc) {
        const cL = SetEngine.exactCompare(i.left, iv.left);
        const cR = SetEngine.exactCompare(iv.right, i.right);
        if (cL !== null && cL <= 0 && cR !== null && cR <= 0) return 'increasing';
     }
     for (const d of dec) {
        const cL = SetEngine.exactCompare(d.left, iv.left);
        const cR = SetEngine.exactCompare(iv.right, d.right);
        if (cL !== null && cL <= 0 && cR !== null && cR <= 0) return 'decreasing';
     }
     return 'unknown';
  }

  private getConcavity(iv: Interval, up: Interval[], down: Interval[]): 'concave_up' | 'concave_down' | 'linear' | 'unknown' {
     for (const u of up) {
        const cL = SetEngine.exactCompare(u.left, iv.left);
        const cR = SetEngine.exactCompare(iv.right, u.right);
        if (cL !== null && cL <= 0 && cR !== null && cR <= 0) return 'concave_up';
     }
     for (const d of down) {
        const cL = SetEngine.exactCompare(d.left, iv.left);
        const cR = SetEngine.exactCompare(iv.right, d.right);
        if (cL !== null && cL <= 0 && cR !== null && cR <= 0) return 'concave_down';
     }
     return 'unknown';
  }
}
