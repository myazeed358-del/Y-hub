import { CanonicalAST, InequalityNode, OperatorNode } from '../types/ast';
import { SolutionSet, ParameterizedSolutionSet, Interval, Endpoint } from '../types/set';
import { Rat } from '../utils/rational';
import { PolynomialExtractor } from './polynomial';
import { SymbolicSimplifier } from './simplifier';
import { InequalityTransformationData, MathStep } from '../types/step';
import { SetEngine } from './sets';
import { DomainAnalyzer } from '../domain';

interface InequalityStepOptions {
  type?: MathStep['type'];
  details?: Record<string, unknown>;
  transformation?: InequalityTransformationData;
}

export type InequalitySolveResult = 
  | { kind: 'solution_set'; solution: SolutionSet; steps: MathStep[] }
  | { kind: 'parameterized'; solution: ParameterizedSolutionSet; steps: MathStep[] }
  | { kind: 'unsupported'; status: string; steps: MathStep[] };

export class InequalityEngine {
  private extractor = new PolynomialExtractor();
  private simplifier = new SymbolicSimplifier();
  private domainAnalyzer = new DomainAnalyzer();

  public solve(ast: CanonicalAST, variable: string): InequalitySolveResult {
    const steps: MathStep[] = [];
    
    let intervals: Interval[];
    try {
      intervals = this.processNode(ast, variable, steps);
    } catch (e: any) {
      if (e.message === 'requires_parameter_sign_analysis' || e.message === 'root_isolation_incomplete' || e.message === 'radical_inequality_requires_controlled_squaring' || e.message === 'multiple_absolute_values_requires_partitioning' || e.message === 'nested_absolute_value_requires_branch_solver') {
        return { kind: 'unsupported', status: e.message, steps };
      }
      throw e;
    }
    
    // Domain analysis integration
    const domainReqs = this.domainAnalyzer.analyze(ast);
    const domainRestrictions: string[] = [];
    
    if (domainReqs && domainReqs.length > 0) {
      for (const req of domainReqs) {
        let reqRelation = '';
        if (req.type === 'denominator') reqRelation = '!=';
        else if (req.type === 'even_root') reqRelation = '>=';
        else if (req.type === 'logarithm') reqRelation = '>';
        
        if (reqRelation) {
          const constraintNode: InequalityNode = {
            type: 'Inequality',
            operator: reqRelation as any,
            lhs: req.conditionAST,
            rhs: { type: 'Number', value: '0' }
          };
          
          try {
            const reqIntervals = this.solveLinearInequality(constraintNode, variable, steps);
            intervals = SetEngine.intersection(intervals, reqIntervals);
            domainRestrictions.push(`${req.type} constraint solved and intersected`);
          } catch (e) {
             domainRestrictions.push(`Unsolved ${req.type} constraint: ${req.message}`);
          }
        }
      }
    }
    
    return {
      kind: 'solution_set',
      solution: {
        type: 'SolutionSet',
        variable,
        intervals,
        domainRestrictions
      },
      steps
    };
  }

  private processNode(ast: CanonicalAST, variable: string, steps: MathStep[]): Interval[] {
    if (ast.type === 'Function' && (ast.name.toUpperCase() === 'AND' || ast.name.toUpperCase() === 'OR')) {
      const branches = ast.args.map(arg => this.processNode(arg, variable, steps));
      const op = ast.name.toUpperCase();
      let result = branches[0];
      for (let i = 1; i < branches.length; i++) {
        result = op === 'AND' ? SetEngine.intersection(result, branches[i]) : SetEngine.union(result, branches[i]);
      }
      return result;
    }
    
    if (ast.type === 'Inequality') {
      const absNodes = this.findAbsNodes(ast);
      if (absNodes.length > 0) {
        if (absNodes.some(n => this.hasNestedAbs(n))) {
          throw new Error('nested_absolute_value_requires_branch_solver');
        }
        const uniqueInners = new Set(absNodes.map(n => JSON.stringify(n.type === 'Operator' ? n.args[0] : (n as any).args[0])));
        if (uniqueInners.size > 1) {
          throw new Error('multiple_absolute_values_requires_partitioning');
        }
        const targetInnerStr = Array.from(uniqueInners)[0];
        const innerAst = JSON.parse(targetInnerStr) as CanonicalAST;
        return this.solveAbsoluteValueInequality(ast as InequalityNode, innerAst, targetInnerStr, variable, steps);
      }

      const radicalNodes = this.findRadicalNodes(ast);
      if (radicalNodes.length > 0) {
        if (radicalNodes.length > 1) {
          throw new Error('radical_inequality_requires_controlled_squaring');
        }
        const innerAst = (radicalNodes[0] as any).args[0] as CanonicalAST;
        const innerStr = JSON.stringify(innerAst);
        return this.solveRadicalInequality(ast as InequalityNode, innerAst, innerStr, variable, steps);
      }

      try {
        const moved = { type: 'Operator', operator: '-', args: [ast.lhs, ast.rhs] };
        const simplifiedMoved = this.simplifier.simplify(moved as CanonicalAST);
        // Try polynomial extraction first to avoid fractionalization overhead if it's simple
        const poly = this.extractor.extract(simplifiedMoved, variable);
        const maxDeg = poly.size === 0 ? 0 : Math.max(...Array.from(poly.keys()));
        if (maxDeg > 1) {
          return this.solvePolynomialInequality(poly, ast.operator, variable, steps);
        }
        return this.solveLinearInequality(ast, variable, steps);
      } catch (e: any) {
        if (e.message === 'root_isolation_incomplete' || e.message === 'requires_parameter_sign_analysis') {
          throw e;
        }
        // Fallback to Rational Solver for anything else (e.g. variable in denominator)
        return this.solveRationalInequality(ast as InequalityNode, variable, steps);
      }
    }
    return [];
  }

  private fractionalize(node: CanonicalAST): { num: CanonicalAST, den: CanonicalAST } {
    if (node.type === 'Number' || node.type === 'Symbol' || node.type === 'Constant') {
        return { num: node, den: { type: 'Number', value: '1' } };
    }
    if (node.type === 'Parenthesis') return this.fractionalize(node.content);
    if (node.type === 'Operator') {
        if (node.operator === '/') {
            const n = this.fractionalize(node.args[0]);
            const d = this.fractionalize(node.args[1]);
            return {
                num: { type: 'Operator', operator: '*', args: [n.num, d.den] },
                den: { type: 'Operator', operator: '*', args: [n.den, d.num] }
            };
        }
        if (node.operator === '*') {
            let nAST: CanonicalAST[] = [];
            let dAST: CanonicalAST[] = [];
            for (const arg of node.args) {
                const f = this.fractionalize(arg);
                nAST.push(f.num);
                dAST.push(f.den);
            }
            return {
                num: nAST.length === 1 ? nAST[0] : { type: 'Operator', operator: '*', args: nAST },
                den: dAST.length === 1 ? dAST[0] : { type: 'Operator', operator: '*', args: dAST }
            };
        }
        if (node.operator === '+') {
            let curN = this.fractionalize(node.args[0]).num;
            let curD = this.fractionalize(node.args[0]).den;
            for (let i = 1; i < node.args.length; i++) {
                const next = this.fractionalize(node.args[i]);
                curN = {
                    type: 'Operator', operator: '+', args: [
                        { type: 'Operator', operator: '*', args: [curN, next.den] },
                        { type: 'Operator', operator: '*', args: [next.num, curD] }
                    ]
                };
                curD = { type: 'Operator', operator: '*', args: [curD, next.den] };
            }
            return { num: curN, den: curD };
        }
        if (node.operator === '-') {
            let curN = this.fractionalize(node.args[0]).num;
            let curD = this.fractionalize(node.args[0]).den;
            for (let i = 1; i < node.args.length; i++) {
                const next = this.fractionalize(node.args[i]);
                curN = {
                    type: 'Operator', operator: '-', args: [
                        { type: 'Operator', operator: '*', args: [curN, next.den] },
                        { type: 'Operator', operator: '*', args: [next.num, curD] }
                    ]
                };
                curD = { type: 'Operator', operator: '*', args: [curD, next.den] };
            }
            return { num: curN, den: curD };
        }
        if (node.operator === '^') {
            const base = this.fractionalize(node.args[0]);
            return {
                num: { type: 'Operator', operator: '^', args: [base.num, node.args[1]] },
                den: { type: 'Operator', operator: '^', args: [base.den, node.args[1]] }
            };
        }
    }
    return { num: node, den: { type: 'Number', value: '1' } };
  }  private addRealRoot(roots: any[], value: number, multiplicity: number = 1, endpoint?: Endpoint) {
    const existing = roots.find(r => Math.abs(r.value - value) < 1e-9);
    if (existing) {
        existing.multiplicity += multiplicity;
    } else {
        roots.push({ value, multiplicity, endpoint });
    }
  }

  private extractPolynomialRootsHelper(poly: Map<number, CanonicalAST[]>, steps: MathStep[]): { roots: any[], maxDeg: number, leadingSign: number, isZero: boolean } {
    const maxDeg = poly.size === 0 ? 0 : Math.max(...Array.from(poly.keys()));
    const coeffsRat = new Array(maxDeg + 1).fill(Rat.zero);
    let isZero = true;
    
    for (const [deg, terms] of poly.entries()) {
      if (deg < 0) {
        this.appendStep(steps, 'Error', 'unsupported_polynomial_root_case', { type: 'error', details: { message: 'unsupported_polynomial_root_case' } });
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
        this.appendStep(steps, 'Error', 'requires_parameter_sign_analysis', { type: 'error', details: { message: 'requires_parameter_sign_analysis' } });
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
    const roots = [...rootData.roots].map(r => ({ value: Rat.toNumber(r.value), multiplicity: r.multiplicity, endpoint: this.makeEndpoint(Rat.toNumber(r.value)) }));
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
               this.addRealRoot(roots, Rat.toNumber(r1), 1, this.makeEndpoint(Rat.toNumber(r1)));
               this.addRealRoot(roots, Rat.toNumber(r2), 1, this.makeEndpoint(Rat.toNumber(r2)));
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
           this.addRealRoot(roots, Rat.toNumber(rootRat), 2, this.makeEndpoint(Rat.toNumber(rootRat)));
       }
    } else if (rem.length === 2) {
       const c = rem[0], b = rem[1];
       if (b.num !== 0n) {
         const rootRat = Rat.div({ num: -c.num, den: c.den }, b);
         this.addRealRoot(roots, Rat.toNumber(rootRat), 1, this.makeEndpoint(Rat.toNumber(rootRat)));
       }
    }
    
    if (rootCompleteness !== 'complete') {
      this.appendStep(steps, 'Error: root isolation incomplete', 'Cannot isolate exact polynomial roots. Sign chart is untrustworthy. (root_isolation_incomplete)', {
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

  private solveRationalInequality(node: InequalityNode, variable: string, steps: MathStep[]): Interval[] {
    const moved = { type: 'Operator', operator: '-', args: [node.lhs, node.rhs] };
    const fract = this.fractionalize(moved as CanonicalAST);
    
    this.appendStep(steps, 'Rational expression normalization', 'rational_normalization (rational_difference); cross multiplication not used. Transformed LHS and RHS into a single rational difference (AD-BC)/(BD) to preserve domain restrictions safely.', {
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
        this.appendStep(steps, 'Domain restriction', 'Zero denominator detected, undefined domain.', {
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
    
    this.appendStep(steps, 'Rational sign chart', `rational_sign_chart for ${rel}. Constructed unified sign chart using exact roots, multiplicities, and domain exclusions.`, {
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

  private solveLinearInequality(node: InequalityNode, variable: string, steps: MathStep[]): Interval[] {

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
      this.appendStep(steps, 'Error', 'requires_parameter_sign_analysis', { type: 'error', details: { message: 'requires_parameter_sign_analysis' } });
      return [];
    }

    let rel = node.operator;

    if (aSign === 0) {
      // 0x + B rel 0 => check B rel 0
      return this.evaluateConstantInequality(bSimple, rel);
    }

    // A is not zero.
    // Ax + B rel 0 => Ax rel -B
    // Divide by A: x rel -B/A. Reverse if A < 0.
    
    if (aSign === -1) {
      rel = this.reverseRelation(rel);
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

    this.appendStep(steps, 'Linear inequality normalization', `Divided by coefficient. Sign is ${aSign > 0 ? 'positive' : 'negative'}; normalized relation is ${rel}${aSign < 0 ? ' after reversing the relation' : ''}.`, {
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

    return this.buildInterval(rel, endpoint);
  }

  private reverseRelation(rel: InequalityNode['operator']): InequalityNode['operator'] {
    switch (rel) {
      case '<': return '>';
      case '<=': return '>=';
      case '>': return '<';
      case '>=': return '<=';
      default: return rel;
    }
  }

  private evaluateConstantInequality(bNode: CanonicalAST, rel: string): Interval[] {
    // We only evaluate simple constants for now.
    let val = 0;
    if (bNode.type === 'Number') {
      val = parseFloat(bNode.value);
    } else if (bNode.type === 'Operator' && bNode.operator === '*' && bNode.args[0].type === 'Number' && bNode.args[0].value === '-1' && bNode.args[1].type === 'Number') {
      val = -parseFloat((bNode.args[1] as any).value);
    } else if (bNode.type === 'Operator' && bNode.operator === '/' && bNode.args[0].type === 'Number' && bNode.args[1].type === 'Number') {
      val = parseFloat((bNode.args[0] as any).value) / parseFloat((bNode.args[1] as any).value);
    }

    let isTrue = false;
    switch (rel) {
      case '<': isTrue = val < 0; break;
      case '<=': isTrue = val <= 0; break;
      case '>': isTrue = val > 0; break;
      case '>=': isTrue = val >= 0; break;
      case '!=': isTrue = val !== 0; break;
    }

    if (isTrue) {
      return [{ left: { type: 'infinity', sign: -1 }, right: { type: 'infinity', sign: 1 }, leftClosed: false, rightClosed: false }];
    } else {
      return [];
    }
  }

  private buildInterval(rel: string, endpoint: Endpoint): Interval[] {
    switch (rel) {
      case '<': return [{ left: { type: 'infinity', sign: -1 }, right: endpoint, leftClosed: false, rightClosed: false }];
      case '<=': return [{ left: { type: 'infinity', sign: -1 }, right: endpoint, leftClosed: false, rightClosed: true }];
      case '>': return [{ left: endpoint, right: { type: 'infinity', sign: 1 }, leftClosed: false, rightClosed: false }];
      case '>=': return [{ left: endpoint, right: { type: 'infinity', sign: 1 }, leftClosed: true, rightClosed: false }];
      case '!=': return [
        { left: { type: 'infinity', sign: -1 }, right: endpoint, leftClosed: false, rightClosed: false },
        { left: endpoint, right: { type: 'infinity', sign: 1 }, leftClosed: false, rightClosed: false }
      ];
      default: return [];
    }
  }

  private solvePolynomialInequality(poly: Map<number, CanonicalAST[]>, rel: InequalityNode['operator'], variable: string, steps: MathStep[]): Interval[] {
    const maxDeg = Math.max(...Array.from(poly.keys()));
    const coeffsNum = new Array(maxDeg + 1).fill(0);
    
    for (const [deg, terms] of poly.entries()) {
      if (deg < 0) {
        this.appendStep(steps, 'Error', 'unsupported_polynomial_root_case', { type: 'error', details: { message: 'unsupported_polynomial_root_case' } });
        return [];
      }
      const termNode = terms.length === 0 ? { type: 'Number', value: '0' } : (terms.length === 1 ? terms[0] : { type: 'Operator', operator: '+', args: terms });
      const simplified = this.simplifier.simplify(termNode as CanonicalAST);
      
      let val = 0;
      if (simplified.type === 'Number') {
        val = parseFloat(simplified.value);
      } else if (simplified.type === 'Operator' && simplified.operator === '*' && simplified.args[0].type === 'Number' && simplified.args[0].value === '-1' && simplified.args[1].type === 'Number') {
        val = -parseFloat((simplified.args[1] as any).value);
      } else {
        this.appendStep(steps, 'Error', 'requires_parameter_sign_analysis', { type: 'error', details: { message: 'requires_parameter_sign_analysis' } });
        return [];
      }
      coeffsNum[deg] = val;
    }
    
    const a_n = coeffsNum[maxDeg];
    if (Math.abs(a_n) < 1e-9) return []; 

    const leadingSign = a_n > 0 ? 1 : -1;
    
    // Exact real roots
    const rootData = this.extractor.findRationalRoots(coeffsNum);
    const roots = [...rootData.roots];
    const rem = rootData.remainingCoeffs;
    
    let rootCompleteness: 'complete' | 'partial' | 'unknown' = 'complete';

    if (rem.length > 3) {
       rootCompleteness = roots.length > 0 ? 'partial' : 'unknown';
    } else if (rem.length === 3) {
       const c = rem[0], b = rem[1], a = rem[2];
       const delta = b*b - 4*a*c;
       if (delta > 0) {
           const sqrtDelta = Math.sqrt(delta);
           if (Number.isInteger(sqrtDelta)) {
               this.addRealRoot(roots, (-b - sqrtDelta)/(2*a));
               this.addRealRoot(roots, (-b + sqrtDelta)/(2*a));
           } else {
               rootCompleteness = roots.length > 0 ? 'partial' : 'unknown';
           }
       } else if (Math.abs(delta) < 1e-9) {
           this.addRealRoot(roots, -b/(2*a), 2);
       }
    } else if (rem.length === 2) {
       const c = rem[0], b = rem[1];
       if (b !== 0) this.addRealRoot(roots, -c/b);
    }
    
    if (rootCompleteness !== 'complete') {
       this.appendStep(steps, 'Error: root isolation incomplete', `Root completeness: ${rootCompleteness}. Supported scope: univariate polynomial inequalities for which all required real critical roots can be established by the currently implemented exact root-discovery mechanisms.`, {
         type: 'error',
         details: {
           message: 'root_isolation_incomplete'
         },
         transformation: {
           method: 'root_isolation_incomplete',
           rootCompleteness,
           justification: 'Supported scope: Univariate polynomial inequalities for which all required real critical roots can be established by the currently implemented exact root-discovery mechanisms.'
         }
       });
       throw new Error('root_isolation_incomplete');
    }
    
    roots.sort((a,b) => a.value - b.value);
    
    let currentSign = leadingSign * (maxDeg % 2 === 1 ? -1 : 1);
    const validIntervals: Interval[] = [];
    
    const satisfies = (s: number, r: string) => {
        if (r === '<') return s < 0;
        if (r === '<=') return s <= 0;
        if (r === '>') return s > 0;
        if (r === '>=') return s >= 0;
        if (r === '!=') return s !== 0;
        return false;
    };
    
    if (satisfies(currentSign, rel)) {
       validIntervals.push({
           left: { type: 'infinity', sign: -1 },
           right: roots.length > 0 ? roots[0].endpoint : { type: 'infinity', sign: 1 },
           leftClosed: false, rightClosed: false
       });
    }
    
    for (let i = 0; i < roots.length; i++) {
        const root = roots[i];
        if (satisfies(0, rel)) {
            const ep = root.endpoint;
            validIntervals.push({ left: ep, right: ep, leftClosed: true, rightClosed: true });
        }
        
        if (root.multiplicity % 2 === 1) currentSign = -currentSign;
        
        if (satisfies(currentSign, rel)) {
            const leftEp = root.endpoint;
            const rightEp = i + 1 < roots.length ? roots[i+1].endpoint : { type: 'infinity', sign: 1 };
            validIntervals.push({ left: leftEp, right: rightEp, leftClosed: false, rightClosed: false });
        }
    }
    
    this.appendStep(steps, 'Polynomial sign chart', `polynomial_sign_chart for ${rel}. Constructed sign chart using ${roots.length} exact roots and their multiplicities; the sign at positive infinity is ${leadingSign > 0 ? 'positive' : 'negative'}.`, {
      type: 'transformation',
      transformation: {
        method: 'polynomial_sign_chart',
        relation: rel,
        rootCompleteness: 'complete',
        roots,
        infinitySign: { plusInfinity: leadingSign > 0 ? 'positive' : 'negative' },
        justification: 'Constructed sign chart using exact roots and multiplicities.'
      }
    });
    
    return SetEngine.normalizeUnion(validIntervals);
  }

  private addRealRoot(roots: any[], val: number, mult: number = 1) {
    const existing = roots.find(r => Math.abs(r.value - val) < 1e-9);
    if (existing) existing.multiplicity += mult;
    else roots.push({ value: val, multiplicity: mult });
  }

  private makeEndpoint(val: number): Endpoint {
    try {
      const rat = Rat.fromNumber(val);
      const isInt = rat.den === 1n;
      const ast: CanonicalAST = isInt ? 
        { type: 'Number', value: rat.num.toString() } : 
        { type: 'Operator', operator: '/', args: [{ type: 'Number', value: rat.num.toString() }, { type: 'Number', value: rat.den.toString() }] };
      return { type: 'value', ast, rational: rat };
    } catch {
      return { type: 'value', ast: { type: 'Number', value: val.toString() } };
    }
  }

  private findAbsNodes(ast: CanonicalAST): CanonicalAST[] {
    const nodes: CanonicalAST[] = [];
    const traverse = (node: CanonicalAST) => {
      if (node.type === 'Function' && node.name === 'abs') {
        nodes.push(node);
      }
      if (node.type === 'Operator') node.args.forEach(traverse);
      if (node.type === 'Function') node.args.forEach(traverse);
      if (node.type === 'Parenthesis') traverse(node.content);
      if (node.type === 'Inequality') { traverse(node.lhs); traverse(node.rhs); }
    };
    traverse(ast);
    return nodes;
  }

  private hasNestedAbs(absNode: CanonicalAST): boolean {
    let nested = false;
    const traverse = (node: CanonicalAST) => {
      if (node !== absNode && node.type === 'Function' && node.name === 'abs') nested = true;
      if (node.type === 'Operator') node.args.forEach(traverse);
      if (node.type === 'Function') node.args.forEach(traverse);
      if (node.type === 'Parenthesis') traverse(node.content);
    };
    traverse(absNode);
    return nested;
  }

  private replaceAbsWithSymbol(ast: CanonicalAST, targetInnerStr: string): CanonicalAST {
    if (ast.type === 'Function' && ast.name === 'abs' && JSON.stringify(ast.args[0]) === targetInnerStr) {
      return { type: 'Symbol', name: '___ABS___' };
    }
    if (ast.type === 'Operator') return { ...ast, args: ast.args.map(a => this.replaceAbsWithSymbol(a, targetInnerStr)) };
    if (ast.type === 'Function') return { ...ast, args: ast.args.map(a => this.replaceAbsWithSymbol(a, targetInnerStr)) };
    if (ast.type === 'Parenthesis') return { ...ast, content: this.replaceAbsWithSymbol(ast.content, targetInnerStr) };
    if (ast.type === 'Inequality') return { ...ast, lhs: this.replaceAbsWithSymbol(ast.lhs, targetInnerStr) as any, rhs: this.replaceAbsWithSymbol(ast.rhs, targetInnerStr) as any };
    return ast;
  }

  private containsVariable(ast: CanonicalAST, variable: string): boolean {
    let has = false;
    const traverse = (node: CanonicalAST) => {
      if (node.type === 'Symbol' && node.name === variable) has = true;
      if (node.type === 'Operator') node.args.forEach(traverse);
      if (node.type === 'Function') node.args.forEach(traverse);
      if (node.type === 'Parenthesis') traverse(node.content);
    };
    traverse(ast);
    return has;
  }

  private evaluateConstant(ast: CanonicalAST): number | null {
    if (ast.type === 'Number') return parseFloat(ast.value);
    if (ast.type === 'Operator' && ast.operator === '*' && ast.args[0].type === 'Number' && ast.args[0].value === '-1' && ast.args[1].type === 'Number') {
      return -parseFloat((ast.args[1] as any).value);
    }
    if (ast.type === 'Operator') {
      const args = ast.args.map(a => this.evaluateConstant(a));
      if (args.some(a => a === null)) return null;
      if (ast.operator === '+') return (args as number[]).reduce((a,b) => a+b, 0);
      if (ast.operator === '-') return args.length === 1 ? -args[0]! : args[0]! - args[1]!;
      if (ast.operator === '*') return (args as number[]).reduce((a,b) => a*b, 1);
      if (ast.operator === '/') return args[0]! / args[1]!;
      if (ast.operator === '^') return Math.pow(args[0]!, args[1]!);
    }
    if (ast.type === 'Parenthesis') return this.evaluateConstant(ast.content);
    return null;
  }

  private solveAbsoluteValueInequality(node: InequalityNode, innerAst: CanonicalAST, targetInnerStr: string, variable: string, steps: MathStep[]): Interval[] {
    const replacedLhs = this.replaceAbsWithSymbol(node.lhs, targetInnerStr);
    const replacedRhs = this.replaceAbsWithSymbol(node.rhs, targetInnerStr);
    const moved = { type: 'Operator', operator: '-', args: [replacedLhs, replacedRhs] };
    
    const fract = this.fractionalize(moved as CanonicalAST);
    
    const denPoly = this.extractor.extract(this.simplifier.simplify(fract.den), '___ABS___');
    if (Math.max(...Array.from(denPoly.keys())) > 0) {
      throw new Error('multiple_absolute_values_requires_partitioning');
    }
    
    const numPoly = this.extractor.extract(this.simplifier.simplify(fract.num), '___ABS___');
    const maxDeg = Math.max(...Array.from(numPoly.keys()));
    if (maxDeg > 1) {
      throw new Error('multiple_absolute_values_requires_partitioning');
    }
    
    const aTerms = numPoly.get(1) || [];
    const cTerms = numPoly.get(0) || [];
    
    const aNode = aTerms.length === 0 ? { type: 'Number', value: '0' } : (aTerms.length === 1 ? aTerms[0] : { type: 'Operator', operator: '+', args: aTerms });
    const cNode = cTerms.length === 0 ? { type: 'Number', value: '0' } : (cTerms.length === 1 ? cTerms[0] : { type: 'Operator', operator: '+', args: cTerms });
    
    const aSimple = this.simplifier.simplify(aNode as CanonicalAST);
    const cSimple = this.simplifier.simplify(cNode as CanonicalAST);
    
    if (this.containsVariable(aSimple, variable) || this.containsVariable(cSimple, variable)) {
      throw new Error('requires_parameter_sign_analysis');
    }
    
    let aVal = this.evaluateConstant(aSimple);
    let cVal = this.evaluateConstant(cSimple);
    
    if (aVal === null || cVal === null) throw new Error('requires_parameter_sign_analysis');
    
    if (Math.abs(aVal) < 1e-9) {
      return this.evaluateConstantInequality(cSimple, node.operator);
    }
    
    let boundVal = -cVal / aVal;
    let rel = node.operator;
    if (aVal < 0) {
      rel = this.reverseRelation(rel);
    }
    
    let boundSign: 'positive' | 'negative' | 'zero' = boundVal > 1e-9 ? 'positive' : (boundVal < -1e-9 ? 'negative' : 'zero');
    
    const branchEval = (op: string, val: number) => {
      const bAst: InequalityNode = { type: 'Inequality', operator: op as any, lhs: innerAst, rhs: { type: 'Number', value: val.toString() } };
      return this.processNode(bAst, variable, steps);
    };
    
    let result: Interval[] = [];
    let rule = '';
    
    if (boundSign === 'positive') {
      if (rel === '<') {
        rule = '|f| < a iff -a < f < a';
        result = SetEngine.intersection(branchEval('>', -boundVal), branchEval('<', boundVal));
      } else if (rel === '<=') {
        rule = '|f| <= a iff -a <= f <= a';
        result = SetEngine.intersection(branchEval('>=', -boundVal), branchEval('<=', boundVal));
      } else if (rel === '>') {
        rule = '|f| > a iff f < -a OR f > a';
        result = SetEngine.union(branchEval('<', -boundVal), branchEval('>', boundVal));
      } else if (rel === '>=') {
        rule = '|f| >= a iff f <= -a OR f >= a';
        result = SetEngine.union(branchEval('<=', -boundVal), branchEval('>=', boundVal));
      } else if (rel === '!=') {
        rule = '|f| != a iff f != a AND f != -a';
        result = SetEngine.intersection(branchEval('!=', boundVal), branchEval('!=', -boundVal));
      }
    } else if (boundSign === 'zero') {
      if (rel === '<') {
        rule = '|f| < 0 is EmptySet';
        result = [];
      } else if (rel === '<=') {
        rule = '|f| <= 0 iff f = 0';
        result = SetEngine.intersection(branchEval('>=', 0), branchEval('<=', 0));
      } else if (rel === '>') {
        rule = '|f| > 0 iff f != 0';
        result = branchEval('!=', 0);
      } else if (rel === '>=') {
        rule = '|f| >= 0 is UniversalSet';
        result = [{ left: { type: 'infinity', sign: -1 }, right: { type: 'infinity', sign: 1 }, leftClosed: false, rightClosed: false }];
      } else if (rel === '!=') {
        rule = '|f| != 0 iff f != 0';
        result = branchEval('!=', 0);
      }
    } else if (boundSign === 'negative') {
      if (rel === '<' || rel === '<=') {
        rule = `|f| ${rel} a < 0 is EmptySet`;
        result = [];
      } else {
        rule = `|f| ${rel} a < 0 is UniversalSet`;
        result = [{ left: { type: 'infinity', sign: -1 }, right: { type: 'infinity', sign: 1 }, leftClosed: false, rightClosed: false }];
      }
    }
    
    this.appendStep(steps, 'Absolute value transformation', `absolute_value_inequality; bound sign: ${boundSign}. Rule: ${rule}. Isolated absolute value and applied exact piecewise mathematical rules.`, {
      type: 'transformation',
      transformation: {
        method: 'absolute_value_inequality',
        boundSign,
        rule,
        justification: 'Isolated absolute value and applied exact piecewise mathematical rules.'
      }
    });
    
    return SetEngine.normalizeUnion(result);
  }

  private findRadicalNodes(ast: CanonicalAST): CanonicalAST[] {
    const nodes: CanonicalAST[] = [];
    const traverse = (node: CanonicalAST) => {
      if (node.type === 'Function' && node.name === 'sqrt') {
        nodes.push(node);
      }
      if (node.type === 'Operator' && node.operator === '^' && node.args[1].type === 'Number' && node.args[1].value === '0.5') {
        nodes.push(node);
      }
      if (node.type === 'Operator') node.args.forEach(traverse);
      if (node.type === 'Function') node.args.forEach(traverse);
      if (node.type === 'Parenthesis') traverse(node.content);
      if (node.type === 'Inequality') { traverse(node.lhs); traverse(node.rhs); }
    };
    traverse(ast);
    return nodes;
  }

  private replaceRadicalWithSymbol(ast: CanonicalAST, targetInnerStr: string): CanonicalAST {
    if (ast.type === 'Function' && ast.name === 'sqrt' && JSON.stringify(ast.args[0]) === targetInnerStr) {
      return { type: 'Symbol', name: '___RAD___' };
    }
    if (ast.type === 'Operator' && ast.operator === '^' && ast.args[1].type === 'Number' && ast.args[1].value === '0.5' && JSON.stringify(ast.args[0]) === targetInnerStr) {
      return { type: 'Symbol', name: '___RAD___' };
    }
    if (ast.type === 'Operator') return { ...ast, args: ast.args.map(a => this.replaceRadicalWithSymbol(a, targetInnerStr)) };
    if (ast.type === 'Function') return { ...ast, args: ast.args.map(a => this.replaceRadicalWithSymbol(a, targetInnerStr)) };
    if (ast.type === 'Parenthesis') return { ...ast, content: this.replaceRadicalWithSymbol(ast.content, targetInnerStr) };
    if (ast.type === 'Inequality') return { ...ast, lhs: this.replaceRadicalWithSymbol(ast.lhs, targetInnerStr) as any, rhs: this.replaceRadicalWithSymbol(ast.rhs, targetInnerStr) as any };
    return ast;
  }

  private solveRadicalInequality(node: InequalityNode, innerAst: CanonicalAST, innerStr: string, variable: string, steps: MathStep[]): Interval[] {
    const replacedLhs = this.replaceRadicalWithSymbol(node.lhs, innerStr);
    const replacedRhs = this.replaceRadicalWithSymbol(node.rhs, innerStr);
    const moved = { type: 'Operator', operator: '-', args: [replacedLhs, replacedRhs] };
    const fract = this.fractionalize(moved as CanonicalAST);
    
    const denPoly = this.extractor.extract(this.simplifier.simplify(fract.den), '___RAD___');
    if (Math.max(...Array.from(denPoly.keys())) > 0) {
      throw new Error('radical_inequality_requires_controlled_squaring');
    }
    
    const numPoly = this.extractor.extract(this.simplifier.simplify(fract.num), '___RAD___');
    const maxDeg = Math.max(...Array.from(numPoly.keys()));
    if (maxDeg > 1) {
      throw new Error('radical_inequality_requires_controlled_squaring');
    }
    
    const aTerms = numPoly.get(1) || [];
    const cTerms = numPoly.get(0) || [];
    
    const aNode = aTerms.length === 0 ? { type: 'Number', value: '0' } : (aTerms.length === 1 ? aTerms[0] : { type: 'Operator', operator: '+', args: aTerms });
    const cNode = cTerms.length === 0 ? { type: 'Number', value: '0' } : (cTerms.length === 1 ? cTerms[0] : { type: 'Operator', operator: '+', args: cTerms });
    
    const aSimple = this.simplifier.simplify(aNode as CanonicalAST);
    const cSimple = this.simplifier.simplify(cNode as CanonicalAST);
    
    if (this.containsVariable(aSimple, variable)) {
      throw new Error('requires_parameter_sign_analysis');
    }
    
    let aVal = this.evaluateConstant(aSimple);
    if (aVal === null) throw new Error('requires_parameter_sign_analysis');
    
    if (Math.abs(aVal) < 1e-9) {
      return this.evaluateConstantInequality(cSimple, node.operator);
    }
    
    let rel = node.operator;
    if (aVal < 0) {
      rel = this.reverseRelation(rel);
    }
    
    // We have: sqrt(A) rel -C / aVal => let B = -C/a
    const bNode: CanonicalAST = {
      type: 'Operator',
      operator: '/',
      args: [
        { type: 'Operator', operator: '*', args: [{ type: 'Number', value: '-1' }, cSimple] },
        { type: 'Number', value: aVal.toString() }
      ]
    };
    const bSimple = this.simplifier.simplify(bNode);
    
    // Mandatory Domain: A >= 0
    const aDomainIntervals = this.processNode({ type: 'Inequality', operator: '>=', lhs: innerAst, rhs: { type: 'Number', value: '0' } }, variable, steps);
    
    const branchEval = (astOp: CanonicalAST, op: string, rhsNode: CanonicalAST) => {
      const bAst: InequalityNode = { type: 'Inequality', operator: op as any, lhs: astOp, rhs: rhsNode };
      return this.processNode(bAst, variable, steps);
    };

    let result: Interval[] = [];
    
    if (rel === '<' || rel === '<=') {
      // sqrt(A) < B => A >= 0 AND B > 0 (or >= 0 for <=) AND A < B^2
      const bSignIntervals = branchEval(bSimple, rel === '<' ? '>' : '>=', { type: 'Number', value: '0' });
      const squaredIntervals = branchEval(innerAst, rel, { type: 'Operator', operator: '^', args: [bSimple, { type: 'Number', value: '2' }] });
      result = SetEngine.intersection(SetEngine.intersection(aDomainIntervals, bSignIntervals), squaredIntervals);
    } else if (rel === '>' || rel === '>=') {
      // sqrt(A) > B => (B < 0 AND A >= 0) OR (B >= 0 AND A > B^2)
      const bNegIntervals = branchEval(bSimple, rel === '>' ? '<' : '<=', { type: 'Number', value: '0' });
      const branch1 = SetEngine.intersection(bNegIntervals, aDomainIntervals);
      
      const bPosIntervals = branchEval(bSimple, rel === '>' ? '>=' : '>', { type: 'Number', value: '0' });
      const squaredIntervals = branchEval(innerAst, rel, { type: 'Operator', operator: '^', args: [bSimple, { type: 'Number', value: '2' }] });
      const branch2 = SetEngine.intersection(SetEngine.intersection(aDomainIntervals, bPosIntervals), squaredIntervals);
      
      result = SetEngine.union(branch1, branch2);
    } else if (rel === '!=') {
      // sqrt(A) != B => (B < 0 AND A >= 0) OR (B >= 0 AND A != B^2)
      const bNegIntervals = branchEval(bSimple, '<', { type: 'Number', value: '0' });
      const branch1 = SetEngine.intersection(bNegIntervals, aDomainIntervals);
      
      const bPosIntervals = branchEval(bSimple, '>=', { type: 'Number', value: '0' });
      const squaredIntervals = branchEval(innerAst, '!=', { type: 'Operator', operator: '^', args: [bSimple, { type: 'Number', value: '2' }] });
      const branch2 = SetEngine.intersection(SetEngine.intersection(aDomainIntervals, bPosIntervals), squaredIntervals);
      
      result = SetEngine.union(branch1, branch2);
    }
    
    this.appendStep(steps, 'Radical inequality resolved via safe squaring', `radical_squaring for ${rel}. Isolated radical and applied sign-checked squaring conditions, preserving A >= 0.`, {
      type: 'transformation',
      transformation: {
        method: 'radical_squaring',
        relation: rel,
        justification: 'Isolated radical and applied sign-checked squaring conditions, preserving A >= 0.'
      }
    });
    
    return result;
  }

  private appendStep(
    steps: MathStep[],
    title: string,
    explanation: string,
    options: InequalityStepOptions = {}
  ): void {
    steps.push({
      id: `inequality_${steps.length}`,
      title,
      explanation,
      ...options
    });
  }
}
