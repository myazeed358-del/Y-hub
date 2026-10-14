import { CanonicalAST, InequalityNode, OperatorNode } from '../types/ast';
import { SolutionSet, Interval, Endpoint } from '../types/set';
import { Rat } from '../utils/rational';
import { PolynomialExtractor } from './polynomial';
import { SymbolicSimplifier } from './simplifier';
import { InequalityTransformationData, MathStep } from '../types/step';
import { SetEngine } from './sets';

import { InequalityAstToolkit } from './inequalityAstToolkit';

interface InequalityStepOptions {
  type?: MathStep['type'];
  details?: Record<string, unknown>;
  transformation?: InequalityTransformationData;
}

export type InequalitySolveResult =
  | { kind: 'solution_set'; solution: SolutionSet; steps: MathStep[] }
  | { kind: 'unsupported'; status: string; steps: MathStep[] };


import { InequalityStepWriter } from './inequalityStepWriter';

/** Exact polynomial, linear, and rational sign-chart strategies. */
export class InequalitySignStrategies {
  private extractor = new PolynomialExtractor();
  private simplifier = new SymbolicSimplifier();
  private astToolkit = new InequalityAstToolkit();
  private trace = new InequalityStepWriter();
  public addRealRoot(roots: any[], value: number, multiplicity: number = 1, endpoint?: Endpoint) {
    const existing = roots.find(r => Math.abs(r.value - value) < 1e-9);
    if (existing) {
        existing.multiplicity += multiplicity;
    } else {
        roots.push({ value, multiplicity, endpoint });
    }
  }

  public extractPolynomialRootsHelper(poly: Map<number, CanonicalAST[]>, steps: MathStep[]): { roots: any[], maxDeg: number, leadingSign: number, isZero: boolean } {
    const maxDeg = poly.size === 0 ? 0 : Math.max(...Array.from(poly.keys()));
    const coeffsRat = new Array(maxDeg + 1).fill(Rat.zero);
    let isZero = true;

    for (const [deg, terms] of poly.entries()) {
      if (deg < 0) {
        this.trace.appendStep(steps, 'Error', 'unsupported_polynomial_root_case', { type: 'error', details: { message: 'unsupported_polynomial_root_case' } });
        throw new Error('root_isolation_incomplete');
      }
      const termNode = terms.length === 0 ? { type: 'Number', value: '0' } : (terms.length === 1 ? terms[0] : { type: 'Operator', operator: '+', args: terms });
      const simplified = this.simplifier.simplify(termNode as CanonicalAST);

      let valRat = Rat.zero;
      if (simplified.type === 'Number') {
        valRat = Rat.fromString(simplified.value);
      } else if (simplified.type === 'Operator' && simplified.operator === '*' && simplified.args[0].type === 'Number' && simplified.args[0].value === '-1' && simplified.args[1].type === 'Number') {
        const innerRat = Rat.fromString((simplified.args[1] as any).value);
        valRat = { num: -innerRat.num, den: innerRat.den };
      } else {
        this.trace.appendStep(steps, 'Error', 'requires_parameter_sign_analysis', { type: 'error', details: { message: 'requires_parameter_sign_analysis' } });
        throw new Error('requires_parameter_sign_analysis');
      }
      coeffsRat[deg] = valRat;
      if (!Rat.isZero(valRat)) isZero = false;
    }

    if (isZero) return { roots: [], maxDeg: 0, leadingSign: 1, isZero: true };

    let actualDeg = maxDeg;
    while (actualDeg >= 0 && Rat.isZero(coeffsRat[actualDeg])) actualDeg--;
    if (actualDeg < 0) return { roots: [], maxDeg: 0, leadingSign: 1, isZero: true };

    const a_n = coeffsRat[actualDeg];
    const leadingSign = a_n.num > 0n ? 1 : -1;

    const rootData = this.extractor.findRationalRootsExact(coeffsRat.slice(0, actualDeg + 1));
    const roots = [...rootData.roots].map(r => ({ value: Rat.toNumber(r.value), multiplicity: r.multiplicity, endpoint: this.astToolkit.makeEndpoint(Rat.toNumber(r.value)) }));
    const rem = rootData.remainingCoeffs;

    let rootCompleteness: 'complete' | 'partial' | 'unknown' = 'complete';

    if (rem.length > 3) {
       rootCompleteness = roots.length > 0 ? 'partial' : 'unknown';
    } else if (rem.length === 3) {
       const c = rem[0], b = rem[1], a = rem[2];
       const b2 = Rat.mul(b, b);
       const fourAc = Rat.mul(Rat.fromNumber(4), Rat.mul(a, c));
       const delta = Rat.sub(b2, fourAc);

       if (delta.num > 0n) {
           const dNumFloat = Number(delta.num);
           const dDenFloat = Number(delta.den);
           const sqrtDelta = Math.sqrt(dNumFloat / dDenFloat);

           if (Number.isInteger(Math.sqrt(dNumFloat)) && Number.isInteger(Math.sqrt(dDenFloat))) {
               // Exact rational roots
               const exactSqrt = Rat.simplify({ num: BigInt(Math.round(Math.sqrt(dNumFloat))), den: BigInt(Math.round(Math.sqrt(dDenFloat))) });
               const minusB = Rat.simplify({ num: -b.num, den: b.den });
               const twoA = Rat.mul(Rat.fromNumber(2), a);
               const r1 = Rat.div(Rat.sub(minusB, exactSqrt), twoA);
               const r2 = Rat.div(Rat.add(minusB, exactSqrt), twoA);
               this.addRealRoot(roots, Rat.toNumber(r1), 1, this.astToolkit.makeEndpoint(Rat.toNumber(r1)));
               this.addRealRoot(roots, Rat.toNumber(r2), 1, this.astToolkit.makeEndpoint(Rat.toNumber(r2)));
           } else {
               // Algebraic Endpoints!
               const aF = Rat.toNumber(a); const bF = Rat.toNumber(b); const dF = Rat.toNumber(delta);
               const v1 = (-bF - Math.sqrt(dF))/(2*aF);
               const v2 = (-bF + Math.sqrt(dF))/(2*aF);

               const bNode: CanonicalAST = { type: 'Number', value: Math.abs(bF).toString() };
               const a2Node: CanonicalAST = { type: 'Number', value: (2*Math.abs(aF)).toString() };
               const dNode: CanonicalAST = { type: 'Function', name: 'sqrt', args: [{ type: 'Number', value: dF.toString() }] };

               const makeAlgAst = (isPlus: boolean): CanonicalAST => {
                 let numAst: CanonicalAST = dNode;
                 if (Math.abs(bF) > 0) { // safe exact zero check would be b.num !== 0n
                     numAst = { type: 'Operator', operator: bF > 0 ? (isPlus ? '-' : '+') : (isPlus ? '+' : '-'), args: [
                       { type: 'Operator', operator: '*', args: [{ type: 'Number', value: '-1' }, { type: 'Number', value: bF.toString() }] },
                       isPlus ? dNode : { type: 'Operator', operator: '*', args: [{ type: 'Number', value: '-1' }, dNode] }
                     ]};
                 } else {
                     numAst = isPlus ? dNode : { type: 'Operator', operator: '*', args: [{ type: 'Number', value: '-1' }, dNode] };
                 }
                 if (Math.abs(2*aF) === 1) return aF > 0 ? numAst : { type: 'Operator', operator: '*', args: [{ type: 'Number', value: '-1' }, numAst] };
                 return { type: 'Operator', operator: '/', args: [numAst, { type: 'Number', value: (2*aF).toString() }] };
               };

                 const ast1 = makeAlgAst(aF < 0);
                 const ast2 = makeAlgAst(aF > 0);

                 const midRat = Rat.div({ num: -b.num, den: b.den }, Rat.mul({ num: 2n, den: 1n }, a));
                 const midFloat = Number(midRat.num) / Number(midRat.den);
                 const aSign = a.num > 0n ? 1 : -1;

                 let left1Float = midFloat - 1;
                 let left1Rat = Rat.fromNumber(left1Float);
                 while (true) {
                    const val = this.extractor.evalPolyExact(rem, left1Rat);
                    if ((val.num > 0n && aSign > 0) || (val.num < 0n && aSign < 0)) break;
                    left1Float -= 1;
                    left1Rat = Rat.fromNumber(left1Float);
                 }

                 let right2Float = midFloat + 1;
                 let right2Rat = Rat.fromNumber(right2Float);
                 while (true) {
                    const val = this.extractor.evalPolyExact(rem, right2Rat);
                    if ((val.num > 0n && aSign > 0) || (val.num < 0n && aSign < 0)) break;
                    right2Float += 1;
                    right2Rat = Rat.fromNumber(right2Float);
                 }

                 this.addRealRoot(roots, v1, 1, {
                   type: 'value', ast: ast1, algebraic: {
                     ast: ast1, degree: 2,
                     isolatingInterval: { left: left1Rat, right: midRat },
                     polyCoeffsRat: rem
                   }
                 });
                 this.addRealRoot(roots, v2, 1, {
                   type: 'value', ast: ast2, algebraic: {
                     ast: ast2, degree: 2,
                     isolatingInterval: { left: midRat, right: right2Rat },
                     polyCoeffsRat: rem
                   }
                 });
             }
       } else if (delta.num === 0n) {
           const minusB = Rat.simplify({ num: -b.num, den: b.den });
           const twoA = Rat.mul(Rat.fromNumber(2), a);
           const rootRat = Rat.div(minusB, twoA);
           this.addRealRoot(roots, Rat.toNumber(rootRat), 2, this.astToolkit.makeEndpoint(Rat.toNumber(rootRat)));
       }
    } else if (rem.length === 2) {
       const c = rem[0], b = rem[1];
       if (b.num !== 0n) {
         const rootRat = Rat.div({ num: -c.num, den: c.den }, b);
         this.addRealRoot(roots, Rat.toNumber(rootRat), 1, this.astToolkit.makeEndpoint(Rat.toNumber(rootRat)));
       }
    }

    if (rootCompleteness !== 'complete') {
      this.trace.appendStep(steps, 'Error: root isolation incomplete', 'Cannot isolate exact polynomial roots. Sign chart is untrustworthy. (root_isolation_incomplete)', {
        type: 'error',
        details: {
          message: 'root_isolation_incomplete',
          error: { message: 'Cannot isolate exact polynomial roots. Sign chart is untrustworthy.', code: 'root_isolation_incomplete' }
        }
      });
       throw new Error('root_isolation_incomplete');
    }

    roots.sort((a,b) => a.value - b.value);
    return { roots, maxDeg: actualDeg, leadingSign, isZero: false };
  }

  public solveRationalInequality(node: InequalityNode, variable: string, steps: MathStep[]): Interval[] {
    const moved = { type: 'Operator', operator: '-', args: [node.lhs, node.rhs] };
    const fract = this.astToolkit.fractionalize(moved as CanonicalAST);

    this.trace.appendStep(steps, 'Rational expression normalization', 'rational_normalization (rational_difference); cross multiplication not used. Transformed LHS and RHS into a single rational difference (AD-BC)/(BD) to preserve domain restrictions safely.', {
      type: 'transformation',
      transformation: {
        method: 'rational_normalization',
        normalizationType: 'rational_difference',
        crossMultiplication: 'not_used',
        justification: 'Transformed LHS and RHS into a single rational difference (AD-BC)/(BD) to preserve domain restrictions safely.'
      }
    });

    const simplifiedNum = this.simplifier.simplify(fract.num);
    const simplifiedDen = this.simplifier.simplify(fract.den);

    const numPoly = this.extractor.extract(simplifiedNum, variable);
    const denPoly = this.extractor.extract(simplifiedDen, variable);

    const numData = this.extractPolynomialRootsHelper(numPoly, steps);
    const denData = this.extractPolynomialRootsHelper(denPoly, steps);

    if (denData.isZero) {
        this.trace.appendStep(steps, 'Domain restriction', 'Zero denominator detected, undefined domain.', {
          type: 'info',
          details: { message: 'Zero denominator detected, undefined domain.' }
        });
        return [];
    }

    const cpMap = new Map<number, { numMult: number, denMult: number, endpoint: Endpoint }>();
    for (const r of numData.roots) {
        cpMap.set(r.value, { numMult: r.multiplicity, denMult: 0, endpoint: r.endpoint });
    }
    for (const r of denData.roots) {
        if (!cpMap.has(r.value)) cpMap.set(r.value, { numMult: 0, denMult: 0, endpoint: r.endpoint });
        cpMap.get(r.value)!.denMult = r.multiplicity;
    }

    const criticalPoints = Array.from(cpMap.entries()).map(([value, mults]) => ({
        value,
        numeratorMultiplicity: mults.numMult,
        denominatorMultiplicity: mults.denMult,
        domainAllowed: mults.denMult === 0,
        endpoint: mults.endpoint
    })).sort((a,b) => a.value - b.value);

    const leadingSign = numData.leadingSign * denData.leadingSign;
    const diffDeg = Math.abs(numData.maxDeg - denData.maxDeg);
    let currentSign = leadingSign * (diffDeg % 2 === 1 ? -1 : 1);

    const validIntervals: Interval[] = [];
    const rel = node.operator;

    const satisfies = (s: number, r: string) => {
        if (r === '<') return s < 0;
        if (r === '<=') return s <= 0;
        if (r === '>') return s > 0;
        if (r === '>=') return s >= 0;
        if (r === '!=') return s !== 0;
        return false;
    };

    // If num is exactly zero everywhere:
    if (numData.isZero) {
        if (!satisfies(0, rel)) return []; // e.g. 0 > 0 -> EmptySet

        // Return valid domain (all R excluding denominator roots)
        currentSign = 0;
        let lastEp: Endpoint = { type: 'infinity', sign: -1 };
        for (const cp of criticalPoints) {
            if (!cp.domainAllowed) {
                const ep = cp.endpoint;
                validIntervals.push({ left: lastEp, right: ep, leftClosed: false, rightClosed: false });
                lastEp = ep;
            }
        }
        validIntervals.push({ left: lastEp, right: { type: 'infinity', sign: 1 }, leftClosed: false, rightClosed: false });
        return validIntervals;
    }

    // Evaluate intervals
    if (satisfies(currentSign, rel)) {
       validIntervals.push({
           left: { type: 'infinity', sign: -1 },
           right: criticalPoints.length > 0 ? criticalPoints[0].endpoint : { type: 'infinity', sign: 1 },
           leftClosed: false, rightClosed: false
       });
    }

    for (let i = 0; i < criticalPoints.length; i++) {
        const cp = criticalPoints[i];

        if (cp.domainAllowed && satisfies(0, rel)) {
            const ep = cp.endpoint;
            validIntervals.push({ left: ep, right: ep, leftClosed: true, rightClosed: true });
        }

        const diffMult = cp.numeratorMultiplicity - cp.denominatorMultiplicity;
        if (Math.abs(diffMult) % 2 === 1) currentSign = -currentSign;

        if (satisfies(currentSign, rel)) {
            const leftEp = cp.endpoint;
            const rightEp: Endpoint = i + 1 < criticalPoints.length ? criticalPoints[i+1].endpoint : { type: 'infinity', sign: 1 };
            validIntervals.push({ left: leftEp, right: rightEp, leftClosed: false, rightClosed: false });
        }
    }

    this.trace.appendStep(steps, 'Rational sign chart', `rational_sign_chart for ${rel}. Constructed unified sign chart using exact roots, multiplicities, and domain exclusions.`, {
      type: 'transformation',
      transformation: {
        method: 'rational_sign_chart',
        relation: rel,
        criticalPoints,
        rootCompleteness: 'complete',
        justification: 'Constructed unified sign chart using exact roots, multiplicities, and domain exclusions.'
      }
    });

    return SetEngine.normalizeUnion(validIntervals);
  }

  public solveLinearInequality(node: InequalityNode, variable: string, steps: MathStep[]): Interval[] {

    // Normalization: lhs - rhs = 0
    const movedToLeft: CanonicalAST = {
      type: 'Operator',
      operator: '-',
      args: [node.lhs, node.rhs]
    };

    const simplifiedLeft = this.simplifier.simplify(movedToLeft);

    // Extract polynomial
    const poly = this.extractor.extract(simplifiedLeft, variable);

    const maxDegree = Math.max(...Array.from(poly.keys()));
    if (maxDegree > 1) {
      return this.solvePolynomialInequality(poly, node.operator, variable, steps);
    }

    const aTerms = poly.get(1) || [];
    const bTerms = poly.get(0) || [];

    const aNode = aTerms.length === 0 ? { type: 'Number', value: '0' } : (aTerms.length === 1 ? aTerms[0] : { type: 'Operator', operator: '+', args: aTerms });
    const bNode = bTerms.length === 0 ? { type: 'Number', value: '0' } : (bTerms.length === 1 ? bTerms[0] : { type: 'Operator', operator: '+', args: bTerms });

    const aSimple = this.simplifier.simplify(aNode as CanonicalAST);
    const bSimple = this.simplifier.simplify(bNode as CanonicalAST);

    // Evaluate exact sign of A
    let aSign: 1 | -1 | 0 | 'unknown' = 'unknown';
    let aValueNum: bigint | null = null;
    let aValueDen: bigint | null = null;

    if (aSimple.type === 'Number') {
      const val = parseFloat(aSimple.value);
      aSign = val > 0 ? 1 : (val < 0 ? -1 : 0);
      aValueNum = BigInt(Math.round(val)); // Simplistic for integer Numbers, for exact rationals we parse properly below
      aValueDen = 1n;
    } else if (aSimple.type === 'Operator' && aSimple.operator === '/' && aSimple.args[0].type === 'Number' && aSimple.args[1].type === 'Number') {
      const n = BigInt((aSimple.args[0] as any).value);
      const d = BigInt((aSimple.args[1] as any).value);
      aValueNum = n;
      aValueDen = d;
      const combined = (n > 0n && d > 0n) || (n < 0n && d < 0n) ? 1 : -1;
      aSign = n === 0n ? 0 : combined;
    } else if (aSimple.type === 'Operator' && aSimple.operator === '*' && aSimple.args[0].type === 'Number' && aSimple.args[0].value === '-1' && aSimple.args[1].type === 'Number') {
      const val = -parseFloat((aSimple.args[1] as any).value);
      aSign = val > 0 ? 1 : (val < 0 ? -1 : 0);
      aValueNum = BigInt(Math.round(val));
      aValueDen = 1n;
    }

    if (aSign === 'unknown') {
      this.trace.appendStep(steps, 'Error', 'requires_parameter_sign_analysis', { type: 'error', details: { message: 'requires_parameter_sign_analysis' } });
      throw new Error('requires_parameter_sign_analysis');
    }

    let rel = node.operator;

    if (aSign === 0) {
      // 0x + B rel 0 => check B rel 0
      return this.astToolkit.evaluateConstantInequality(bSimple, rel);
    }

    // A is not zero.
    // Ax + B rel 0 => Ax rel -B
    // Divide by A: x rel -B/A. Reverse if A < 0.

    if (aSign === -1) {
      rel = this.astToolkit.reverseRelation(rel);
    }

    const bound: CanonicalAST = this.simplifier.simplify({
      type: 'Operator',
      operator: '/',
      args: [
        { type: 'Operator', operator: '*', args: [{ type: 'Number', value: '-1' }, bSimple] },
        aSimple
      ]
    });

    const endpoint: Endpoint = { type: 'value', ast: bound };
    // Try to parse rational if it's purely numeric for exact operations
    if (bound.type === 'Number') {
      endpoint.rational = { num: BigInt(Math.round(parseFloat(bound.value))), den: 1n };
    } else if (bound.type === 'Operator' && bound.operator === '/' && bound.args[0].type === 'Number' && bound.args[1].type === 'Number') {
      endpoint.rational = { num: BigInt((bound.args[0] as any).value), den: BigInt((bound.args[1] as any).value) };
    } else if (bound.type === 'Operator' && bound.operator === '*' && bound.args[0].type === 'Number' && bound.args[0].value === '-1' && bound.args[1].type === 'Number') {
      endpoint.rational = { num: -BigInt(Math.round(parseFloat((bound.args[1] as any).value))), den: 1n };
    } else if (bound.type === 'Operator' && bound.operator === '*' && bound.args[0].type === 'Number' && bound.args[0].value === '-1' && bound.args[1].type === 'Operator' && bound.args[1].operator === '/') {
      const bOp = bound.args[1] as OperatorNode;
      if (bOp.args[0].type === 'Number' && bOp.args[1].type === 'Number') {
        endpoint.rational = { num: -BigInt((bOp.args[0] as any).value), den: BigInt((bOp.args[1] as any).value) };
      }
    }

    this.trace.appendStep(steps, 'Linear inequality normalization', `Divided by coefficient. Sign is ${aSign > 0 ? 'positive' : 'negative'}; normalized relation is ${rel}${aSign < 0 ? ' after reversing the relation' : ''}.`, {
      type: 'transformation',
      transformation: {
        method: 'linear_inequality_normalization',
        before: node,
        after: { type: 'Inequality', operator: rel, lhs: { type: 'Symbol', name: variable }, rhs: bound },
        relation: rel,
        coefficientSign: aSign > 0 ? 'positive' : 'negative',
        directionChanged: aSign < 0,
        restrictionsAdded: [],
        justification: `Divided by coefficient. Sign is ${aSign > 0 ? 'positive' : 'negative'}.`,
        verified: 'exactly_verified'
      }
    });

    return this.astToolkit.buildInterval(rel, endpoint);
  }

  public solvePolynomialInequality(
    poly: Map<number, CanonicalAST[]>,
    rel: InequalityNode['operator'],
    variable: string,
    steps: MathStep[]
  ): Interval[] {
    const rootData = this.extractPolynomialRootsHelper(poly, steps);

    const satisfies = (sign: number): boolean => {
      switch (rel) {
        case '<':
          return sign < 0;
        case '<=':
          return sign <= 0;
        case '>':
          return sign > 0;
        case '>=':
          return sign >= 0;
        case '!=':
          return sign !== 0;
        default:
          return false;
      }
    };

    if (rootData.isZero) {
      if (!satisfies(0)) {
        return [];
      }

      return [{
        left: { type: 'infinity', sign: -1 },
        right: { type: 'infinity', sign: 1 },
        leftClosed: false,
        rightClosed: false
      }];
    }

    const roots = rootData.roots;

    let currentSign =
      rootData.leadingSign *
      (rootData.maxDeg % 2 === 1 ? -1 : 1);

    const validIntervals: Interval[] = [];

    if (satisfies(currentSign)) {
      validIntervals.push({
        left: { type: 'infinity', sign: -1 },
        right: roots.length > 0
          ? (roots[0].endpoint ?? this.astToolkit.makeEndpoint(roots[0].value))
          : { type: 'infinity', sign: 1 },
        leftClosed: false,
        rightClosed: false
      });
    }

    for (let i = 0; i < roots.length; i++) {
      const root = roots[i];
      const endpoint =
        root.endpoint ?? this.astToolkit.makeEndpoint(root.value);

      if (satisfies(0)) {
        validIntervals.push({
          left: endpoint,
          right: endpoint,
          leftClosed: true,
          rightClosed: true
        });
      }

      if (root.multiplicity % 2 === 1) {
        currentSign = -currentSign;
      }

      if (satisfies(currentSign)) {
        const rightEndpoint =
          i + 1 < roots.length
            ? (roots[i + 1].endpoint ??
               this.astToolkit.makeEndpoint(roots[i + 1].value))
            : { type: 'infinity', sign: 1 } as Endpoint;

        validIntervals.push({
          left: endpoint,
          right: rightEndpoint,
          leftClosed: false,
          rightClosed: false
        });
      }
    }

    this.trace.appendStep(
      steps,
      'Polynomial sign chart',
      `polynomial_sign_chart for ${rel}. Constructed sign chart using ${roots.length} exact roots and their multiplicities; the sign at positive infinity is ${rootData.leadingSign > 0 ? 'positive' : 'negative'}.`,
      {
        type: 'transformation',
        transformation: {
          method: 'polynomial_sign_chart',
          relation: rel,
          rootCompleteness: 'complete',
          roots,
          infinitySign: {
            plusInfinity:
              rootData.leadingSign > 0
                ? 'positive'
                : 'negative'
          },
          justification:
            'Constructed sign chart using exact roots and multiplicities.'
        }
      }
    );

    return SetEngine.normalizeUnion(validIntervals);
  }
}
