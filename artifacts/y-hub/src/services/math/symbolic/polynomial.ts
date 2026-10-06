import { CanonicalAST } from '../types/ast';
import { ASTUtils } from './utils';
import { PolynomialExpander } from './expander';
import { Rational, Rat } from '../utils/rational';

export interface PolyRoot {
  value: number;
  multiplicity: number;
}

export interface PolyRootExact {
  value: Rational;
  multiplicity: number;
}

export class PolynomialExtractor {
  private expander = new PolynomialExpander();

  public extract(node: CanonicalAST, variable: string): Map<number, CanonicalAST[]> {
    const expanded = this.expander.expand(node);
    const coeffs = new Map<number, CanonicalAST[]>();
    this.traverseSum(expanded, variable, coeffs);
    return coeffs;
  }

  private traverseSum(
    node: CanonicalAST,
    variable: string,
    coeffs: Map<number, CanonicalAST[]>,
    sign: 1 | -1 = 1
  ) {
    if (node.type === 'Operator' && node.operator === '+') {
      node.args.forEach(arg =>
        this.traverseSum(arg, variable, coeffs, sign)
      );
      return;
    }

    if (
      node.type === 'Operator' &&
      node.operator === '-' &&
      node.args.length === 2
    ) {
      this.traverseSum(node.args[0], variable, coeffs, sign);
      this.traverseSum(
        node.args[1],
        variable,
        coeffs,
        sign === 1 ? -1 : 1
      );
      return;
    }

    const signedNode: CanonicalAST =
      sign === 1
        ? node
        : {
            type: 'Operator',
            operator: '*',
            args: [
              { type: 'Number', value: '-1' },
              node
            ]
          };

    this.addTerm(signedNode, variable, coeffs);
  }

  private addTerm(node: CanonicalAST, variable: string, coeffs: Map<number, CanonicalAST[]>) {
    const { degree, coeff } = this.parseTerm(node, variable);
    if (!coeffs.has(degree)) coeffs.set(degree, []);
    coeffs.get(degree)!.push(coeff);
  }

  private parseTerm(node: CanonicalAST, variable: string): { degree: number, coeff: CanonicalAST } {
    if (!ASTUtils.extractSymbols(node).has(variable)) return { degree: 0, coeff: node }; 
    if (node.type === 'Symbol' && node.name === variable) return { degree: 1, coeff: { type: 'Number', value: '1' } };

    if (node.type === 'Operator' && node.operator === '^') {
      const base = node.args[0], exp = node.args[1];
      if (base.type === 'Symbol' && base.name === variable && exp.type === 'Number') {
        const d = parseFloat((exp as any).value);
        if (Number.isInteger(d) && d >= 0) return { degree: d, coeff: { type: 'Number', value: '1' } };
      }
    }

    if (node.type === 'Operator' && (node.operator === '*' || node.operator === 'implicit_multiply')) {
      let degree = 0;
      let coeffArgs: CanonicalAST[] = [];
      for (const arg of node.args) {
        if (ASTUtils.extractSymbols(arg).has(variable)) {
          const term = this.parseTerm(arg, variable);
          degree += term.degree; 
          if (term.coeff.type !== 'Number' || parseFloat((term.coeff as any).value) !== 1) {
            coeffArgs.push(term.coeff);
          }
        } else coeffArgs.push(arg);
      }
      
      let finalCoeff: CanonicalAST;
      if (coeffArgs.length === 0) finalCoeff = { type: 'Number', value: '1' };
      else if (coeffArgs.length === 1) finalCoeff = coeffArgs[0];
      else finalCoeff = { type: 'Operator', operator: '*', args: coeffArgs };
      return { degree, coeff: finalCoeff };
    }

    throw new Error(`Non-polynomial structure detected in degree mapping.`);
  }

  public findRationalRoots(coeffsNum: number[]): { roots: PolyRoot[], remainingCoeffs: number[] } {
    let currentCoeffs = [...coeffsNum];
    const roots: PolyRoot[] = [];

    let zeroMultiplicity = 0;
    while (currentCoeffs.length > 0 && Math.abs(currentCoeffs[0]) < 1e-9) {
      zeroMultiplicity++;
      currentCoeffs.shift();
    }
    if (zeroMultiplicity > 0) roots.push({ value: 0, multiplicity: zeroMultiplicity });
    if (currentCoeffs.length <= 1) return { roots, remainingCoeffs: currentCoeffs };

    let degree = currentCoeffs.length - 1;
    let keepSearching = true;

    while (keepSearching && degree >= 1) {
      const a0 = Math.abs(currentCoeffs[0]);
      const an = Math.abs(currentCoeffs[degree]);

      if (!Number.isInteger(a0) || !Number.isInteger(an) || a0 === 0) break;

      const pFactors = this.getFactors(a0);
      const qFactors = this.getFactors(an);
      let foundRoot = false;

      for (const p of pFactors) {
        for (const q of qFactors) {
          const cand1 = p / q;
          const cand2 = -p / q;

          if (this.evalPoly(currentCoeffs, cand1) === 0) {
            this.addRoot(roots, cand1);
            currentCoeffs = this.syntheticDivision(currentCoeffs, cand1).quotient;
            degree--; foundRoot = true; break;
          }
          if (this.evalPoly(currentCoeffs, cand2) === 0) {
            this.addRoot(roots, cand2);
            currentCoeffs = this.syntheticDivision(currentCoeffs, cand2).quotient;
            degree--; foundRoot = true; break;
          }
        }
        if (foundRoot) break;
      }
      if (!foundRoot) keepSearching = false;
    }

    return { roots, remainingCoeffs: currentCoeffs };
  }

  public evalPoly(coeffs: number[], x: number): number {
    let sum = 0;
    for (let i = 0; i < coeffs.length; i++) sum += coeffs[i] * Math.pow(x, i);
    return Math.abs(sum) < 1e-9 ? 0 : sum;
  }

  public syntheticDivision(coeffs: number[], root: number): { quotient: number[], remainder: number } {
    const newCoeffs = new Array(coeffs.length - 1).fill(0);
    newCoeffs[newCoeffs.length - 1] = coeffs[coeffs.length - 1];
    for (let i = newCoeffs.length - 2; i >= 0; i--) {
      newCoeffs[i] = coeffs[i + 1] + newCoeffs[i + 1] * root;
    }
    const remainder = this.evalPoly(coeffs, root);
    return { quotient: newCoeffs, remainder };
  }

  public rebuild(coeffsNum: number[], variable: string): CanonicalAST {
    return this.rebuildWithShift(coeffsNum, variable, 0);
  }

  public rebuildWithShift(coeffsNum: number[], variable: string, shift: number): CanonicalAST {
    const terms: CanonicalAST[] = [];
    for (let i = 0; i < coeffsNum.length; i++) {
      if (Math.abs(coeffsNum[i]) < 1e-9) continue;
      
      const k = i - shift;
      const coeffAbs = Math.abs(coeffsNum[i]);
      const coeffAST: CanonicalAST = { type: 'Number', value: coeffAbs.toString() };
      const isNegative = coeffsNum[i] < 0;
      
      let termBase: CanonicalAST;
      if (k === 0) {
        termBase = coeffAST;
      } else if (k > 0) {
        let varNode: CanonicalAST = { type: 'Symbol', name: variable };
        if (k > 1) {
          varNode = { type: 'Operator', operator: '^', args: [varNode, { type: 'Number', value: k.toString() }] };
        }
        termBase = coeffAbs === 1 ? varNode : { type: 'Operator', operator: '*', args: [coeffAST, varNode] };
      } else {
        const absK = -k;
        let varNode: CanonicalAST = { type: 'Symbol', name: variable };
        if (absK > 1) {
          varNode = { type: 'Operator', operator: '^', args: [varNode, { type: 'Number', value: absK.toString() }] };
        }
        termBase = { type: 'Operator', operator: '/', args: [coeffAST, varNode] };
      }
      
      if (isNegative) {
        termBase = { type: 'Operator', operator: '*', args: [{ type: 'Number', value: '-1' }, termBase] };
      }
      
      terms.push(termBase);
    }

    if (terms.length === 0) return { type: 'Number', value: '0' };
    if (terms.length === 1) return terms[0];
    return { type: 'Operator', operator: '+', args: terms.reverse() };
  }

  private addRoot(roots: PolyRoot[], val: number) {
    const existing = roots.find(r => Math.abs(r.value - val) < 1e-9);
    if (existing) existing.multiplicity++;
    else roots.push({ value: val, multiplicity: 1 });
  }

  private getFactors(n: number): number[] {
    if (n === 0) return [1];
    const factors = [];
    for (let i = 1; i <= Math.sqrt(n); i++) {
      if (n % i === 0) {
        factors.push(i);
        if (i !== n / i) factors.push(n / i);
      }
    }
    return factors;
  }

  // EXACT RATIONAL METHODS

  public evalPolyExact(coeffs: Rational[], x: Rational): Rational {
    let sum = Rat.zero;
    let currentX = Rat.one;
    for (let i = 0; i < coeffs.length; i++) {
      sum = Rat.add(sum, Rat.mul(coeffs[i], currentX));
      currentX = Rat.mul(currentX, x);
    }
    return sum;
  }

  public syntheticDivisionExact(coeffs: Rational[], root: Rational): { quotient: Rational[], remainder: Rational } {
    const newCoeffs = new Array(coeffs.length - 1).fill(Rat.zero);
    newCoeffs[newCoeffs.length - 1] = coeffs[coeffs.length - 1];
    for (let i = newCoeffs.length - 2; i >= 0; i--) {
      newCoeffs[i] = Rat.add(coeffs[i + 1], Rat.mul(newCoeffs[i + 1], root));
    }
    const remainder = this.evalPolyExact(coeffs, root);
    return { quotient: newCoeffs, remainder };
  }

  public rebuildExact(coeffsRat: Rational[], variable: string): CanonicalAST {
    return this.rebuildWithShiftExact(coeffsRat, variable, 0);
  }

  public rebuildWithShiftExact(coeffsRat: Rational[], variable: string, shift: number): CanonicalAST {
    const terms: CanonicalAST[] = [];
    for (let i = 0; i < coeffsRat.length; i++) {
      if (Rat.isZero(coeffsRat[i])) continue;
      
      const k = i - shift;
      const isNegative = coeffsRat[i].num < 0n;
      const coeffAbsRat = isNegative ? { num: -coeffsRat[i].num, den: coeffsRat[i].den } : coeffsRat[i];
      let coeffAST: CanonicalAST;
      if (coeffAbsRat.den === 1n) {
        coeffAST = { type: 'Number', value: coeffAbsRat.num.toString() };
      } else {
        coeffAST = { type: 'Operator', operator: '/', args: [
          { type: 'Number', value: coeffAbsRat.num.toString() },
          { type: 'Number', value: coeffAbsRat.den.toString() }
        ]};
      }
      const isOne = coeffAbsRat.num === 1n && coeffAbsRat.den === 1n;
      
      let termBase: CanonicalAST;
      if (k === 0) {
        termBase = coeffAST;
      } else if (k > 0) {
        let varNode: CanonicalAST = { type: 'Symbol', name: variable };
        if (k > 1) {
          varNode = { type: 'Operator', operator: '^', args: [varNode, { type: 'Number', value: k.toString() }] };
        }
        termBase = isOne ? varNode : { type: 'Operator', operator: '*', args: [coeffAST, varNode] };
      } else {
        const absK = -k;
        let varNode: CanonicalAST = { type: 'Symbol', name: variable };
        if (absK > 1) {
          varNode = { type: 'Operator', operator: '^', args: [varNode, { type: 'Number', value: absK.toString() }] };
        }
        termBase = { type: 'Operator', operator: '/', args: [coeffAST, varNode] };
      }
      
      if (isNegative) {
        termBase = { type: 'Operator', operator: '*', args: [{ type: 'Number', value: '-1' }, termBase] };
      }
      terms.push(termBase);
    }
    
    if (terms.length === 0) return { type: 'Number', value: '0' };
    if (terms.length === 1) return terms[0];
    return { type: 'Operator', operator: '+', args: terms.reverse() };
  }

  public findRationalRootsExact(coeffsRat: Rational[]): { roots: PolyRootExact[], remainingCoeffs: Rational[] } {
    let currentCoeffs = [...coeffsRat];
    const roots: PolyRootExact[] = [];

    let zeroMultiplicity = 0;
    while (currentCoeffs.length > 0 && Rat.isZero(currentCoeffs[0])) {
      zeroMultiplicity++;
      currentCoeffs.shift();
    }
    if (zeroMultiplicity > 0) roots.push({ value: Rat.zero, multiplicity: zeroMultiplicity });
    if (currentCoeffs.length <= 1) return { roots, remainingCoeffs: currentCoeffs };

    let degree = currentCoeffs.length - 1;
    let keepSearching = true;

    while (keepSearching && degree >= 1) {
      const a0 = currentCoeffs[0];
      const an = currentCoeffs[degree];

      if (a0.den !== 1n || an.den !== 1n || a0.num === 0n) break;

      const pFactors = this.getFactors(Number(a0.num < 0n ? -a0.num : a0.num));
      const qFactors = this.getFactors(Number(an.num < 0n ? -an.num : an.num));
      let foundRoot = false;

      for (const p of pFactors) {
        for (const q of qFactors) {
          const cand1 = Rat.simplify({ num: BigInt(p), den: BigInt(q) });
          const cand2 = Rat.simplify({ num: BigInt(-p), den: BigInt(q) });

          if (Rat.isZero(this.evalPolyExact(currentCoeffs, cand1))) {
            this.addRootExact(roots, cand1);
            currentCoeffs = this.syntheticDivisionExact(currentCoeffs, cand1).quotient;
            degree--; foundRoot = true; break;
          }
          if (Rat.isZero(this.evalPolyExact(currentCoeffs, cand2))) {
            this.addRootExact(roots, cand2);
            currentCoeffs = this.syntheticDivisionExact(currentCoeffs, cand2).quotient;
            degree--; foundRoot = true; break;
          }
        }
        if (foundRoot) break;
      }
      if (!foundRoot) keepSearching = false;
    }

    return { roots, remainingCoeffs: currentCoeffs };
  }

  private addRootExact(roots: PolyRootExact[], value: Rational) {
    const existing = roots.find(r => Rat.equals(r.value, value));
    if (existing) existing.multiplicity++;
    else roots.push({ value, multiplicity: 1 });
  }
}
