import { CanonicalAST } from '../types/ast';
import { MathStep } from '../types/step';
import { DefiniteIntegrationRequest, ImproperIntegrationResult, ImproperIntegrationClassification, ImproperIntegralPiece, VerificationStatus } from '../types/integration';
import { LimitEngine } from './limit';
import { DefiniteIntegrationEngine } from './definite_integration';
import { DomainAnalyzer } from '../domain';
import { SetEngine } from './sets';
import { InequalityEngine } from './inequality';
import { SymbolicSimplifier } from './simplifier';
import { ASTEvaluator } from './evaluator';
import { ASTUtils } from './utils';

export class ImproperIntegrationEngine {
  private limitEngine = new LimitEngine();
  private definiteIntegrationEngine = new DefiniteIntegrationEngine();
  private domainAnalyzer = new DomainAnalyzer();
  private inequalityEngine = new InequalityEngine();
  private simplifier = new SymbolicSimplifier();
  private evaluator = new ASTEvaluator();

  public evaluateImproperIntegral(req: DefiniteIntegrationRequest): ImproperIntegrationResult {
    const steps: MathStep[] = [];
    const assumptions: string[] = [];

    // 1. Analyze domain
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

    if (!this.isNumericOrInf(req.lowerBound) || !this.isNumericOrInf(req.upperBound)) {
       return this.buildResult(req, 'requires_assumption', [], originalDomain, [], null, 'not_proven', assumptions, steps);
    }

    const valA = this.evaluateNumericOrInf(req.lowerBound);
    const valB = this.evaluateNumericOrInf(req.upperBound);
    const orientation = valA <= valB ? 1 : -1;
    const minBnd = Math.min(valA, valB);
    const maxBnd = Math.max(valA, valB);

    // Collect Singularities inside [minBnd, maxBnd]
    const singSet = new Set<number>();
    for (const interval of originalDomain.intervals) {
       if (interval.left.type === 'value' && interval.left.rational) {
          const v = Number(interval.left.rational.num)/Number(interval.left.rational.den);
          if (v >= minBnd && v <= maxBnd) singSet.add(v);
       }
       if (interval.right.type === 'value' && interval.right.rational) {
          const v = Number(interval.right.rational.num)/Number(interval.right.rational.den);
          if (v >= minBnd && v <= maxBnd) singSet.add(v);
       }
    }
    
    if (minBnd === -Infinity) singSet.add(-Infinity);
    if (maxBnd === Infinity) singSet.add(Infinity);
    singSet.add(minBnd);
    singSet.add(maxBnd);

    const splitPoints = Array.from(singSet).sort((a,b) => a - b);
    
    const pieces: ImproperIntegralPiece[] = [];
    
    if (splitPoints.length > 20) {
       return this.buildResult(req, 'resource_limit', [], originalDomain, [], null, 'not_proven', assumptions, steps);
    }

    let overallConverges = true;
    let divergenceType: any = null;
    let finalAST: CanonicalAST | null = { type: 'Number', value: '0' };
    let vStatus: VerificationStatus = 'not_proven';

    for (let i = 0; i < splitPoints.length - 1; i++) {
       let u = splitPoints[i];
       let v = splitPoints[i+1];
       
       if (u >= maxBnd || v <= minBnd) continue; // Out of bounds

       let mid = (u + v) / 2;
       if (u === -Infinity && v === Infinity) mid = 0;
       else if (u === -Infinity) mid = v - 1;
       else if (v === Infinity) mid = u + 1;

       // Domain structure verification: if mid is completely outside, it's a disconnected gap
       if (!this.isPointInDomain(mid, originalDomain, true) && !this.isPointInDomain(mid, originalDomain, false)) {
           return this.buildResult(req, 'unresolved', [], originalDomain, [], null, 'not_proven', assumptions, steps);
       }

       const improperU = (u === -Infinity || !this.isPointInDomain(u, originalDomain, true)); 
       const improperV = (v === Infinity || !this.isPointInDomain(v, originalDomain, false)); 
       
       pieces.push(this.processPiece(req, u, v, improperU, improperV, originalDomain));
    }

    // Now aggregate
    for (const p of pieces) {
       if (!p.converges) {
          overallConverges = false;
          if (!divergenceType) divergenceType = p.divergenceType;
          else if (divergenceType !== p.divergenceType && divergenceType !== 'unsupported') divergenceType = 'divergent_two_sided';
       }
       if (p.value && finalAST) {
          finalAST = this.simplifier.simplify({ type: 'Operator', operator: '+', args: [finalAST, p.value] });
       } else {
          overallConverges = false;
       }
    }

    if (orientation === -1 && finalAST && overallConverges) {
       finalAST = this.simplifier.simplify({ type: 'Operator', operator: '*', args: [{ type: 'Number', value: '-1' }, finalAST] });
    }

    let classification: ImproperIntegrationClassification = 'unresolved';
    if (overallConverges) {
       classification = 'convergent_exact'; // We can distinguish symbolic later
       vStatus = 'exactly_equivalent'; // Basic assignment
    } else {
       if (divergenceType === 'positive_infinity') classification = 'divergent_positive_infinity';
       else if (divergenceType === 'negative_infinity') classification = 'divergent_negative_infinity';
       else if (divergenceType === 'divergent_two_sided') classification = 'divergent_two_sided';
       else if (divergenceType === 'oscillatory') classification = 'oscillatory_or_nonconvergent';
       else if (divergenceType === 'unsupported') classification = 'unsupported';
       else classification = 'unresolved';
       finalAST = null;
    }

    return this.buildResult(req, classification, pieces, originalDomain, [], finalAST, vStatus, assumptions, steps);
  }

  private processPiece(req: DefiniteIntegrationRequest, u: number, v: number, improperU: boolean, improperV: boolean, domain: any): ImproperIntegralPiece {
    const uAST = this.numToAST(u);
    const vAST = this.numToAST(v);
    
    if (!improperU && !improperV) {
       // Proper subintegral!
       const subReq: DefiniteIntegrationRequest = {
          integrand: req.integrand, variable: req.variable,
          lowerBound: uAST, upperBound: vAST,
          trustedOrientation: 1, trustedDomainCheck: true
       };
       const res = this.definiteIntegrationEngine.evaluateDefiniteIntegral(subReq);
       
       let converges = res.classification === 'proper_exact';
       return {
          lowerBound: uAST, upperBound: vAST, improperLeft: false, improperRight: false,
          limitVariable: null, limitDirection: null, subintegralResult: res, limitResult: null,
          converges: converges, value: res.finalValue
       };
    }

    if (improperU && improperV) {
       // Find an admissible finite split point c for this doubly improper interval
       let c = 0;
       let foundC = false;
       if (this.isPointInDomain(0, domain, true) || this.isPointInDomain(0, domain, false)) {
           if (0 > u && 0 < v) { c = 0; foundC = true; }
       }
       if (!foundC) {
           for (const interval of domain.intervals) {
               const min = interval.left.type === 'infinity' ? -Infinity : Number(interval.left.rational.num)/Number(interval.left.rational.den);
               const max = interval.right.type === 'infinity' ? Infinity : Number(interval.right.rational.num)/Number(interval.right.rational.den);
               if (u >= max || v <= min) continue; // Out of this (u,v) component
               if (min !== -Infinity && max !== Infinity) c = min + (max - min) / 2;
               else if (min !== -Infinity) c = min + 1;
               else if (max !== Infinity) c = max - 1;
               if (c > u && c < v) { foundC = true; break; }
           }
       }
       if (!foundC) {
           // Fallback to naive midpoint if domain gaps aren't neatly identifiable
           c = (u + v) / 2;
           if (u === -Infinity && v === Infinity) c = 0;
           else if (u === -Infinity) c = v - 1;
           else if (v === Infinity) c = u + 1;
       }
       
       const cAST = this.numToAST(c);
       const t_u = 't_left';
       const t_v = 't_right';
       const t_uAST: CanonicalAST = { type: 'Symbol', name: t_u };
       const t_vAST: CanonicalAST = { type: 'Symbol', name: t_v };

       // Left component: limit_{a->u^+} \int_a^c f(x) dx
       const subReqLeft: DefiniteIntegrationRequest = { integrand: req.integrand, variable: req.variable, lowerBound: t_uAST, upperBound: cAST, trustedOrientation: 1, trustedDomainCheck: true };
       const subResLeft = this.definiteIntegrationEngine.evaluateDefiniteIntegral(subReqLeft);
       
       let limResLeft: any = null;
       if (subResLeft.finalValue) {
           const limApproachU = u === -Infinity ? '-infinity' : u;
           const limReqLeft = { expression: subResLeft.finalValue, variable: t_u, approach: limApproachU, direction: 'right' };
           limResLeft = this.limitEngine.evaluateLimit(limReqLeft as any);
       }

       // Right component: limit_{b->v^-} \int_c^b f(x) dx
       const subReqRight: DefiniteIntegrationRequest = { integrand: req.integrand, variable: req.variable, lowerBound: cAST, upperBound: t_vAST, trustedOrientation: 1, trustedDomainCheck: true };
       const subResRight = this.definiteIntegrationEngine.evaluateDefiniteIntegral(subReqRight);

       let limResRight: any = null;
       if (subResRight.finalValue) {
           const limApproachV = v === Infinity ? '+infinity' : v;
           const limReqRight = { expression: subResRight.finalValue, variable: t_v, approach: limApproachV, direction: 'left' };
           limResRight = this.limitEngine.evaluateLimit(limReqRight as any);
       }
       
       const leftComp = { limitVariable: t_u, limitDirection: 'right' as const, subintegralResult: subResLeft, limitResult: limResLeft };
       const rightComp = { limitVariable: t_v, limitDirection: 'left' as const, subintegralResult: subResRight, limitResult: limResRight };

       let converges = false;
       let divType: any = 'unresolved';
       let val: CanonicalAST | null = null;
       
       // Independent existence
       const leftConverges = limResLeft && limResLeft.classification === 'finite' && limResLeft.value;
       const rightConverges = limResRight && limResRight.classification === 'finite' && limResRight.value;

       if (leftConverges && rightConverges) {
           converges = true;
           val = this.simplifier.simplify({ type: 'Operator', operator: '+', args: [limResLeft.value, limResRight.value] });
       } else {
           if (limResLeft && limResLeft.classification !== 'finite') divType = limResLeft.classification === '+infinity' ? 'positive_infinity' : (limResLeft.classification === '-infinity' ? 'negative_infinity' : 'oscillatory');
           if (limResRight && limResRight.classification !== 'finite') {
               let dR = limResRight.classification === '+infinity' ? 'positive_infinity' : (limResRight.classification === '-infinity' ? 'negative_infinity' : 'oscillatory');
               if (divType !== 'unresolved' && divType !== dR) divType = 'divergent_two_sided';
               else divType = dR;
           }
           if (divType === 'unresolved') divType = 'unsupported';
       }

       return { lowerBound: uAST, upperBound: vAST, improperLeft: true, improperRight: true, limitVariable: null, limitDirection: null, subintegralResult: null, limitResult: null, doublyImproperSplitPoint: cAST, leftComponent: leftComp, rightComponent: rightComp, converges, divergenceType: converges ? undefined : divType, value: val };
    }

    let limitVar = 't_lim';
    let tAST: CanonicalAST = { type: 'Symbol', name: limitVar };
    
    let subReq: DefiniteIntegrationRequest;
    let limitDirection: 'left' | 'right';
    let limitApproach: number | '+infinity' | '-infinity';
    
    if (improperU) {
       subReq = { integrand: req.integrand, variable: req.variable, lowerBound: tAST, upperBound: vAST, trustedOrientation: 1, trustedDomainCheck: true };
       limitDirection = 'right'; // t -> u+ means right limit
       limitApproach = u === -Infinity ? '-infinity' : u;
    } else {
       subReq = { integrand: req.integrand, variable: req.variable, lowerBound: uAST, upperBound: tAST, trustedOrientation: 1, trustedDomainCheck: true };
       limitDirection = 'left'; // t -> v- means left limit
       limitApproach = v === Infinity ? '+infinity' : v;
    }

    const subRes = this.definiteIntegrationEngine.evaluateDefiniteIntegral(subReq);
    if (!subRes.finalValue) {
       return {
          lowerBound: uAST, upperBound: vAST, improperLeft: improperU, improperRight: improperV,
          limitVariable: limitVar, limitDirection, subintegralResult: subRes, limitResult: null,
          converges: false, divergenceType: 'unsupported', value: null
       };
    }

    // Evaluate Limit
    const limReq = { expression: subRes.finalValue, variable: limitVar, approach: limitApproach, direction: limitDirection };
    const limRes = this.limitEngine.evaluateLimit(limReq as any);
    
    let converges = false;
    let divType: any = 'unresolved';
    let val: CanonicalAST | null = null;
    
    if (limRes.classification === 'finite' && limRes.value) {
       converges = true;
       val = limRes.value;
    } else if (limRes.classification === '+infinity') {
       divType = 'positive_infinity';
    } else if (limRes.classification === '-infinity') {
       divType = 'negative_infinity';
    } else if (limRes.classification === 'does_not_exist') {
       divType = 'oscillatory';
    }

    return {
       lowerBound: uAST, upperBound: vAST, improperLeft: improperU, improperRight: improperV,
       limitVariable: limitVar, limitDirection, subintegralResult: subRes, limitResult: limRes,
       converges, divergenceType: converges ? undefined : divType, value: val
    };
  }

  private isPointInDomain(pt: number, domainSet: any, checkRight: boolean): boolean {
     // A very simple continuity check
     for (const interval of domainSet.intervals) {
        const min = interval.left.type === 'infinity' ? -Infinity : Number(interval.left.rational.num)/Number(interval.left.rational.den);
        const max = interval.right.type === 'infinity' ? Infinity : Number(interval.right.rational.num)/Number(interval.right.rational.den);
        if (pt > min && pt < max) return true;
        if (pt === min && checkRight) return true; // It's fine if we are moving right into the interval
        if (pt === max && !checkRight) return true; // It's fine if we are moving left into the interval
     }
     return false;
  }

  private numToAST(num: number): CanonicalAST {
     if (num === Infinity) return { type: 'Symbol', name: 'infinity' };
     if (num === -Infinity) return { type: 'Operator', operator: '*', args: [{ type: 'Number', value: '-1' }, { type: 'Symbol', name: 'infinity' }] };
     return { type: 'Number', value: num.toString() };
  }

  private isNumericOrInf(node: CanonicalAST): boolean {
     if (node.type === 'Symbol' && (node.name === 'infinity' || node.name === 'inf' || node.name === '\\infty')) return true;
     if (node.type === 'Operator' && node.operator === '*' && node.args.length === 2 && node.args[0].type === 'Number' && node.args[0].value === '-1' && this.isNumericOrInf(node.args[1])) return true;
     try {
        const val = this.evaluator.evaluate(node, new Map());
        return typeof val === 'number';
     } catch {
        return false;
     }
  }

  private evaluateNumericOrInf(node: CanonicalAST): number {
     if (node.type === 'Symbol' && (node.name === 'infinity' || node.name === 'inf' || node.name === '\\infty')) return Infinity;
     if (node.type === 'Operator' && node.operator === '*' && node.args.length === 2 && node.args[0].type === 'Number' && node.args[0].value === '-1' && this.isNumericOrInf(node.args[1])) return -Infinity;
     return this.evaluator.evaluate(node, new Map()) as number;
  }

  private buildResult(req: DefiniteIntegrationRequest, classification: ImproperIntegrationClassification, pieces: ImproperIntegralPiece[], originalDomain: any, detectedSingularities: CanonicalAST[], finalValue: CanonicalAST | null, verificationStatus: VerificationStatus, assumptions: string[], steps: MathStep[]): ImproperIntegrationResult {
    return { request: req, classification, pieces, originalDomain, detectedSingularities, finalValue, verificationStatus, assumptions, steps };
  }
}
