import { CanonicalAST } from '../types/ast';
import { MathStep } from '../types/step';
import { ASTUtils } from './utils';
import { SymbolicSimplifier } from './simplifier';
import { PolynomialExtractor, PolyRootExact } from './polynomial';
import { Rational, Rat } from '../utils/rational';
import { LinearAlgebra } from '../utils/linear';
import { DerivativeEngine } from './derivative';

export class PartialFractionsEngine {
  private simplifier = new SymbolicSimplifier();
  private extractor = new PolynomialExtractor();
  private derivativeEngine = new DerivativeEngine();

  public matchPartialFractions(
    integrand: CanonicalAST,
    variable: string,
    integrateFn: (node: CanonicalAST, v: string, steps: MathStep[], depth: number) => CanonicalAST,
    steps: MathStep[],
    depth: number
  ): CanonicalAST | null {
    if (depth > 5) return null; // Resource limit

    // Must be a fraction P / Q
    if (integrand.type !== 'Operator' || integrand.operator !== '/') return null;

    const numAST = integrand.args[0];
    const denAST = integrand.args[1];

    const numMap = this.extractor.extract(numAST, variable);
    const denMap = this.extractor.extract(denAST, variable);

    const P = this.mapToPoly(numMap);
    const Q = this.mapToPoly(denMap);

    if (!P || !Q) return null; // Not a rational function of exact rational coefficients
    if (Q.length <= 1) return null; // Q is a constant or zero

    // Polynomial long division
    const divResult = this.polyLongDivideExact(P, Q);
    let finalResultParts: CanonicalAST[] = [];

    // Integrate quotient S(x)
    if (divResult.quotient.length > 0) {
       const S_ast = this.extractor.rebuildExact(divResult.quotient, variable);
       const tempSteps: MathStep[] = [];
       try {
          const S_integrated = integrateFn(S_ast, variable, tempSteps, depth + 1);
          finalResultParts.push(S_integrated);
       } catch {
          return null; // Could not integrate polynomial quotient? Shouldn't happen
       }
    }

    if (divResult.remainder.length === 0) {
       // Remainder is 0
       if (finalResultParts.length === 0) return { type: 'Number', value: '0' };
       if (finalResultParts.length === 1) return finalResultParts[0];
       return { type: 'Operator', operator: '+', args: finalResultParts };
    }

    const R = divResult.remainder;

    // Factor Q
    const factResult = this.extractor.findRationalRootsExact(Q);
    const roots = factResult.roots;
    let remQ = factResult.remainingCoeffs;

    // Check if remQ is a constant. If it's a constant, we fully factored it!
    if (remQ.length > 3) return null; // We only support up to quadratics
    let hasQuadratic = false;
    if (remQ.length === 3) {
       // It's a quadratic A x^2 + B x + C
       // For Phase 6D, we only support x^2+1 or similar basic forms that 6A can handle.
       // Actually, we can support x^2+1 specifically, or any irreducible quadratic if the numerator is linear.
       // The prompt says: "Supported irreducible quadratic factors ONLY when the existing symbolic architecture can represent and integrate them exactly."
       // Arctan handles 1/(1+x^2) or 1/(a^2+x^2).
       // To keep it rigorous and within scope, let's only proceed if it's precisely x^2 + C where C > 0.
       if (!Rat.isZero(remQ[1])) return null; // B != 0 not supported yet
       if (Rat.sign(Rat.mul(remQ[0], remQ[2])) <= 0) return null; // roots would be real, should have been found, or it's not x^2+C
       hasQuadratic = true;
    } else if (remQ.length === 2) {
       // Linear factor but didn't have rational root? Shouldn't happen if rational coefficients.
       return null;
    }

    // Set up Partial Fractions
    // Unknowns:
    // For each root `r` with multiplicity `m`: A_1/(x-r) + A_2/(x-r)^2 + ... + A_m/(x-r)^m
    // For quadratic x^2+C: (Bx + D)/(x^2+C) (we only support one irreducible quadratic of multiplicity 1 for now)
    
    // Total unknowns = sum(m) + (hasQuadratic ? 2 : 0)
    let totalUnknowns = 0;
    for (const r of roots) totalUnknowns += r.multiplicity;
    if (hasQuadratic) totalUnknowns += 2;

    if (totalUnknowns !== Q.length - 1) {
       return null; // Factorization incomplete or degrees don't match
    }

    if (totalUnknowns > 10) return null; // Resource limit

    // Generate terms
    const pfTerms: { type: 'linear', root: PolyRootExact, power: number, varIdx: number }[] = [];
    const quadTerms: { varIdxB: number, varIdxD: number }[] = [];

    let vIdx = 0;
    for (const r of roots) {
       for (let p = 1; p <= r.multiplicity; p++) {
          pfTerms.push({ type: 'linear', root: r, power: p, varIdx: vIdx++ });
       }
    }
    if (hasQuadratic) {
       quadTerms.push({ varIdxB: vIdx++, varIdxD: vIdx++ });
    }

    // Build linear system for coefficients
    // We equate R(x) = sum_i Term_i * Q(x) / Denom_i
    const M: Rational[][] = [];
    for (let i = 0; i < totalUnknowns; i++) {
       M.push(new Array(totalUnknowns).fill(Rat.zero));
    }
    const B: Rational[] = new Array(totalUnknowns).fill(Rat.zero);
    for (let i = 0; i < R.length; i++) B[i] = R[i];

    // Q polynomial
    for (const term of pfTerms) {
       // polynomial multiplier = Q(x) / (x - r)^p
       const multiplier = this.polyDivideFactor(Q, term.root.value, term.power);
       for (let d = 0; d < multiplier.length; d++) {
          M[d][term.varIdx] = multiplier[d];
       }
    }
    if (hasQuadratic) {
       const quadTerm = quadTerms[0];
       // multiplier = Q(x) / (ax^2+c)
       const denom = remQ;
       const multiplier = this.polyDividePoly(Q, denom).quotient;
       // We have (B x + D) * multiplier
       // x * multiplier
       const xMult = [Rat.zero, ...multiplier];
       for (let d = 0; d < xMult.length; d++) M[d][quadTerm.varIdxB] = xMult[d];
       for (let d = 0; d < multiplier.length; d++) M[d][quadTerm.varIdxD] = multiplier[d];
    }

    const coeffs = LinearAlgebra.solveExact(M, B);
    if (!coeffs) return null; // Singular, shouldn't happen for partial fractions

    // Now construct the decomposition and verify
    let decompositionASTs: CanonicalAST[] = [];
    for (const term of pfTerms) {
       const c = coeffs[term.varIdx];
       if (Rat.isZero(c)) continue;
       const denom = this.buildLinearDenom(term.root.value, term.power, variable);
       const frac = { type: 'Operator', operator: '/', args: [{ type: 'Number', value: Rat.toString(c) }, denom] } as CanonicalAST;
       decompositionASTs.push(frac);
    }
    if (hasQuadratic) {
       const quadTerm = quadTerms[0];
       const b = coeffs[quadTerm.varIdxB];
       const d = coeffs[quadTerm.varIdxD];
       if (!Rat.isZero(b) || !Rat.isZero(d)) {
          const denom = this.extractor.rebuildExact(remQ, variable);
          const numArgs: CanonicalAST[] = [];
          if (!Rat.isZero(b)) numArgs.push({ type: 'Operator', operator: '*', args: [{ type: 'Number', value: Rat.toString(b) }, { type: 'Symbol', name: variable }] });
          if (!Rat.isZero(d)) numArgs.push({ type: 'Number', value: Rat.toString(d) });
          const num = numArgs.length === 1 ? numArgs[0] : { type: 'Operator', operator: '+', args: numArgs };
          const frac = { type: 'Operator', operator: '/', args: [num, denom] } as CanonicalAST;
          decompositionASTs.push(frac);
       }
    }

    // If we made no structural progress (no quotient, and only 1 decomposition term), abort to prevent infinite loop.
    if (divResult.quotient.length === 0 && decompositionASTs.length === 1 && pfTerms.length + quadTerms.length === 1) {
       // Check if the single term's denominator degree matches Q's degree to be absolutely sure
       // If it does, we literally did nothing but reconstruct the input.
       return null;
    }

    const decompositionAST = decompositionASTs.length === 1 ? decompositionASTs[0] : { type: 'Operator', operator: '+', args: decompositionASTs } as CanonicalAST;

    // Verify decomposition
    const originalRational = { type: 'Operator', operator: '/', args: [this.extractor.rebuildExact(R, variable), this.extractor.rebuildExact(Q, variable)] } as CanonicalAST;
    
    // Evaluate at a few points to prove numerical consistency since structural equivalence is hard for un-combined fractions
    let isConsistent = true;
    for (let testVal = 1; testVal <= 5; testVal++) {
       // Avoid roots
       let isRoot = false;
       for (const r of roots) {
          if (Rat.equals(r.value, Rat.fromNumber(testVal))) isRoot = true;
       }
       if (isRoot) continue;
       
       const v1 = this.evalASTNum(originalRational, variable, testVal);
       const v2 = this.evalASTNum(decompositionAST, variable, testVal);
       if (v1 === null || v2 === null || Math.abs(v1 - v2) > 1e-7) {
          isConsistent = false;
          break;
       }
    }

    if (!isConsistent) {
       return null; // Do not integrate if decomposition cannot be proven
    }

    steps.push({
      id: `pf_${Date.now()}`,
      title: 'Partial Fractions Decomposition',
      explanation: `${ASTUtils.serialize(originalRational)} ≡ ${ASTUtils.serialize(decompositionAST)}\n(Verified: numerically_consistent)`
    });

    // Integrate each term
    for (const term of decompositionASTs) {
       try {
          const tInt = integrateFn(term, variable, steps, depth + 1);
          finalResultParts.push(tInt);
       } catch {
          return null; // A component could not be integrated
       }
    }

    if (finalResultParts.length === 0) return { type: 'Number', value: '0' };
    if (finalResultParts.length === 1) return finalResultParts[0];
    return { type: 'Operator', operator: '+', args: finalResultParts };
  }

  private mapToPoly(coeffsMap: Map<number, CanonicalAST[]>): Rational[] | null {
     let maxDegree = -1;
     for (const [deg] of coeffsMap.entries()) {
        if (deg > maxDegree) maxDegree = deg;
     }
     if (maxDegree > 20) return null; // Resource limit

     const poly: Rational[] = new Array(maxDegree + 1).fill(Rat.zero);
     for (const [deg, args] of coeffsMap.entries()) {
        let sum = Rat.zero;
        for (const arg of args) {
           if (arg.type === 'Number') sum = Rat.add(sum, Rat.fromString(arg.value));
           else if (arg.type === 'Operator' && arg.operator === '-' && arg.args.length === 1 && arg.args[0].type === 'Number') {
              sum = Rat.sub(sum, Rat.fromString(arg.args[0].value));
           } else {
              return null; // Not a rational number coefficient
           }
        }
        poly[deg] = sum;
     }
     
     // Trim leading zeros
     while (poly.length > 0 && Rat.isZero(poly[poly.length - 1])) {
        poly.pop();
     }
     
     return poly;
  }

  private polyLongDivideExact(P: Rational[], Q: Rational[]): { quotient: Rational[], remainder: Rational[] } {
     if (P.length < Q.length) return { quotient: [], remainder: P };
     
     let rem = [...P];
     const outQ: Rational[] = new Array(P.length - Q.length + 1).fill(Rat.zero);
     
     while (rem.length >= Q.length) {
        const degDiff = rem.length - Q.length;
        const factor = Rat.div(rem[rem.length - 1], Q[Q.length - 1]);
        outQ[degDiff] = factor;
        
        for (let i = 0; i < Q.length; i++) {
           rem[i + degDiff] = Rat.sub(rem[i + degDiff], Rat.mul(factor, Q[i]));
        }
        
        while (rem.length > 0 && Rat.isZero(rem[rem.length - 1])) {
           rem.pop();
        }
     }
     
     return { quotient: outQ, remainder: rem };
  }

  private polyDivideFactor(P: Rational[], root: Rational, power: number): Rational[] {
     let current = [...P];
     for (let p = 0; p < power; p++) {
        current = this.extractor.syntheticDivisionExact(current, root).quotient;
     }
     return current;
  }
  
  private polyDividePoly(P: Rational[], Q: Rational[]): { quotient: Rational[], remainder: Rational[] } {
     return this.polyLongDivideExact(P, Q);
  }

  private buildLinearDenom(root: Rational, power: number, variable: string): CanonicalAST {
     const x: CanonicalAST = { type: 'Symbol', name: variable };
     let base: CanonicalAST;
     if (Rat.isZero(root)) {
        base = x;
     } else {
        const rootNum = { type: 'Number', value: Rat.toString(root) } as CanonicalAST;
        // if root is negative, we can do x + |root| for better aesthetics, but x - root is fine
        base = { type: 'Operator', operator: '-', args: [x, rootNum] };
     }
     if (power === 1) return base;
     return { type: 'Operator', operator: '^', args: [base, { type: 'Number', value: power.toString() }] };
  }

  private evalASTNum(node: CanonicalAST, variable: string, x: number): number | null {
     if (node.type === 'Number') return parseFloat(node.value);
     if (node.type === 'Symbol') return node.name === variable ? x : null;
     if (node.type === 'Operator') {
        const args = node.args.map(a => this.evalASTNum(a, variable, x));
        if (args.some(a => a === null)) return null;
        if (node.operator === '+') return args.reduce((a, b) => a! + b!, 0);
        if (node.operator === '-') return args.length === 1 ? -args[0]! : args.reduce((a, b) => a! - b!);
        if (node.operator === '*') return args.reduce((a, b) => a! * b!, 1);
        if (node.operator === '/') return args[0]! / args[1]!;
        if (node.operator === '^') return Math.pow(args[0]!, args[1]!);
     }
     return null;
  }
}
