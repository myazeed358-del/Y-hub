import { CanonicalAST } from '../../types/ast';
import { LimitApproach, LimitDirection } from '../../types/limit';
import { TransformationData } from '../../types/step';
import { SymbolicSimplifier } from '../simplifier';
import { PolynomialExtractor } from '../polynomial';
import { ASTUtils } from '../utils';
import { Rat, Rational } from '../../utils/rational';

export interface LimitStrategy {
  apply(ast: CanonicalAST, variable: string, approach: LimitApproach, direction: LimitDirection): TransformationData | null;
}

export class FactoringStrategy implements LimitStrategy {
  private simplifier = new SymbolicSimplifier();
  private polyExtractor = new PolynomialExtractor();

  public apply(ast: CanonicalAST, variable: string, approach: LimitApproach, direction: LimitDirection): TransformationData | null {
    if (typeof approach !== 'number') return null;

    if (ast.type === 'Operator' && ast.operator === '/') {
      const num = ast.args[0];
      const den = ast.args[1];

      try {
        const numCoeffsMap = this.polyExtractor.extract(this.simplifier.simplify(num), variable);
        const denCoeffsMap = this.polyExtractor.extract(this.simplifier.simplify(den), variable);

        const numCoeffsRat = this.mapToRationalArray(numCoeffsMap);
        const denCoeffsRat = this.mapToRationalArray(denCoeffsMap);

        if (numCoeffsRat && denCoeffsRat) {
          const approachRat = Rat.fromNumber(approach);
          const numVal = this.polyExtractor.evalPolyExact(numCoeffsRat, approachRat);
          const denVal = this.polyExtractor.evalPolyExact(denCoeffsRat, approachRat);

          if (Rat.isZero(numVal) && Rat.isZero(denVal)) {
            const numDiv = this.polyExtractor.syntheticDivisionExact(numCoeffsRat, approachRat);
            const denDiv = this.polyExtractor.syntheticDivisionExact(denCoeffsRat, approachRat);

            if (Rat.isZero(numDiv.remainder) && Rat.isZero(denDiv.remainder)) {
              const newNum = this.polyExtractor.rebuildExact(numDiv.quotient, variable);
              const newDen = this.polyExtractor.rebuildExact(denDiv.quotient, variable);
              
              const after = this.simplifier.simplify({
                type: 'Operator',
                operator: '/',
                args: [newNum, newDen]
              });

              return {
                method: 'factoring_and_cancellation',
                before: ast,
                after,
                restrictionsAdded: [`${variable} != ${approach}`],
                justification: `Common factor (${variable} - ${approach}) cancelled on punctured neighborhood.`,
                verified: true
              };
            }
          }
        }
      } catch (e) {
        // Ignored
      }
    }
    return null;
  }

  private mapToRationalArray(coeffsMap: Map<number, CanonicalAST[]>): Rational[] | null {
    const degrees = Array.from(coeffsMap.keys()).sort((a, b) => b - a);
    const maxDegree = degrees.length > 0 ? degrees[0] : 0;
    const coeffsRat: Rational[] = new Array(maxDegree + 1).fill(Rat.zero);
    
    for (let i = 0; i <= maxDegree; i++) {
      const cASTs = coeffsMap.get(i) || [];
      const sumAST = cASTs.length === 0 ? { type: 'Number', value: '0' } as CanonicalAST 
                   : cASTs.length === 1 ? cASTs[0] 
                   : { type: 'Operator', operator: '+', args: cASTs } as CanonicalAST;
                   
      const simplified = this.simplifier.simplify(sumAST);
      if (simplified.type === 'Number') {
        coeffsRat[i] = Rat.fromString(simplified.value);
      } else if (simplified.type === 'Operator' && simplified.operator === '*' && simplified.args[0].type === 'Number' && simplified.args[0].value === '-1' && simplified.args[1].type === 'Number') {
        const innerRat = Rat.fromString((simplified.args[1] as any).value);
        coeffsRat[i] = { num: -innerRat.num, den: innerRat.den };
      } else {
        return null; // non-rational coefficient
      }
    }
    return coeffsRat;
  }
}

export class RationalizationStrategy implements LimitStrategy {
  private simplifier = new SymbolicSimplifier();

  public apply(ast: CanonicalAST, variable: string, approach: LimitApproach, direction: LimitDirection): TransformationData | null {
    let num = ast;
    let den: CanonicalAST = { type: 'Number', value: '1' };
    let isFraction = false;

    if (ast.type === 'Operator' && ast.operator === '/') {
      num = ast.args[0];
      den = ast.args[1];
      isFraction = true;
    }

    const numConj = this.findConjugateParts(num);
    if (numConj) {
      const { aInner, b, isSum } = numConj;
      const newNum = this.simplifier.simplify({
        type: 'Operator',
        operator: '-',
        args: [
          aInner,
          { type: 'Operator', operator: '^', args: [b, { type: 'Number', value: '2' }] }
        ]
      });
      
      const conjugateAST = {
        type: 'Operator',
        operator: isSum ? '-' : '+',
        args: [{ type: 'Function', name: 'sqrt', args: [aInner] }, b]
      } as CanonicalAST;

      const newDen = {
        type: 'Operator',
        operator: '*',
        args: [den, conjugateAST]
      } as CanonicalAST;

      const after = this.simplifier.simplify({
        type: 'Operator',
        operator: '/',
        args: [newNum, newDen]
      });

      return {
        method: 'rationalization',
        before: ast,
        after,
        restrictionsAdded: [],
        justification: 'Multiplied by conjugate to resolve radical.',
        verified: true
      };
    }
    return null;
  }

  private findConjugateParts(node: CanonicalAST): { aInner: CanonicalAST, b: CanonicalAST, isSum: boolean } | null {
    if (node.type === 'Operator' && (node.operator === '+' || node.operator === '-')) {
      const isSum = node.operator === '+';
      let term1 = node.args[0];
      let term2 = node.args[1];
      
      if (term1.type === 'Function' && term1.name === 'sqrt') {
        return { aInner: term1.args[0], b: term2, isSum };
      }
      if (term2.type === 'Function' && term2.name === 'sqrt') {
        return { aInner: term2.args[0], b: term1, isSum };
      }
    }
    return null;
  }
}

export class AbsoluteValueLimitStrategy implements LimitStrategy {
  private simplifier = new SymbolicSimplifier();

  public apply(ast: CanonicalAST, variable: string, approach: LimitApproach, direction: LimitDirection): TransformationData | null {
    let changed = false;
    let approachNum = typeof approach === 'number' ? approach : (approach === '+infinity' ? 1e8 : -1e8);
    
    // Nudge the approach for one-sided evaluation exactly on the boundary
    if (typeof approach === 'number') {
      if (direction === 'right') approachNum += 1e-8;
      else if (direction === 'left') approachNum -= 1e-8;
    }

    const after = this.transformAbs(ast, variable, approachNum, () => changed = true);
    
    if (changed) {
      return {
        method: 'absolute_value_branching',
        before: ast,
        after: this.simplifier.simplify(after),
        restrictionsAdded: [],
        justification: `Absolute value simplified structurally based on approach direction.`,
        verified: true
      };
    }
    return null;
  }

  private transformAbs(node: CanonicalAST, variable: string, approach: number, onChange: () => void): CanonicalAST {
    if (node.type === 'Function' && node.name === 'abs') {
      const inner = node.args[0];
      
      try {
        const polyExtractor = new PolynomialExtractor();
        const coeffsMap = polyExtractor.extract(inner, variable);
        
        let sum = 0;
        let isConstant = true;
        for (const [deg, coeffASTs] of coeffsMap.entries()) {
          const sumAST = coeffASTs.length === 0 ? { type: 'Number', value: '0' } as CanonicalAST 
                       : coeffASTs.length === 1 ? coeffASTs[0] 
                       : { type: 'Operator', operator: '+', args: coeffASTs } as CanonicalAST;
                       
          const simplified = this.simplifier.simplify(sumAST);
          if (simplified.type !== 'Number') {
            isConstant = false; break;
          }
          sum += parseFloat((simplified as any).value) * Math.pow(approach, deg); // numerical_fallback
        }

        if (isConstant) {
          if (sum > 1e-9) {
            onChange();
            return inner;
          } else if (sum < -1e-9) {
            onChange();
            return { type: 'Operator', operator: '*', args: [{ type: 'Number', value: '-1' }, inner] };
          }
        }
      } catch (e) {}
    }

    if (node.type === 'Operator' || node.type === 'Function') {
      return {
        ...node,
        args: (node as any).args.map((a: CanonicalAST) => this.transformAbs(a, variable, approach, onChange))
      } as CanonicalAST;
    }

    if (node.type === 'Parenthesis') {
      return {
        ...node,
        content: this.transformAbs((node as any).content, variable, approach, onChange)
      } as CanonicalAST;
    }

    return node;
  }
}

export class InfinitePolynomialStrategy implements LimitStrategy {
  private polyExtractor = new PolynomialExtractor();
  private simplifier = new SymbolicSimplifier();
  
  public apply(ast: CanonicalAST, variable: string, approach: LimitApproach, direction: LimitDirection): TransformationData | null {
    if (approach !== '+infinity' && approach !== '-infinity') return null;
    
    try {
      const coeffsMap = this.polyExtractor.extract(this.simplifier.simplify(ast), variable);
      const coeffsRat = this.mapToRationalArray(coeffsMap);
      if (!coeffsRat || coeffsRat.length <= 1) return null;
      
      const degree = coeffsRat.length - 1;
      const rebuiltShifted = this.polyExtractor.rebuildWithShiftExact(coeffsRat, variable, degree);
      
      const after = this.simplifier.simplify({
        type: 'Operator',
        operator: '*',
        args: [
          { type: 'Operator', operator: '^', args: [{ type: 'Symbol', name: variable }, { type: 'Number', value: degree.toString() }] },
          rebuiltShifted
        ]
      });
      
      return {
         method: 'asymptotic_polynomial_factoring',
         before: ast,
         after,
         restrictionsAdded: [`${variable} != 0`],
         justification: `Factored out dominant term x^${degree} for infinite approach.`,
         verified: true
      };
    } catch { return null; }
  }

  private mapToRationalArray(coeffsMap: Map<number, CanonicalAST[]>): Rational[] | null {
    const degrees = Array.from(coeffsMap.keys()).sort((a, b) => b - a);
    const maxDegree = degrees.length > 0 ? degrees[0] : 0;
    const coeffsRat: Rational[] = new Array(maxDegree + 1).fill(Rat.zero);
    
    for (let i = 0; i <= maxDegree; i++) {
      const cASTs = coeffsMap.get(i) || [];
      const sumAST = cASTs.length === 0 ? { type: 'Number', value: '0' } as CanonicalAST 
                   : cASTs.length === 1 ? cASTs[0] 
                   : { type: 'Operator', operator: '+', args: cASTs } as CanonicalAST;
      const simplified = this.simplifier.simplify(sumAST);
      if (simplified.type === 'Number') {
        coeffsRat[i] = Rat.fromString(simplified.value);
      } else if (simplified.type === 'Operator' && simplified.operator === '*' && simplified.args[0].type === 'Number' && simplified.args[0].value === '-1' && simplified.args[1].type === 'Number') {
        const innerRat = Rat.fromString((simplified.args[1] as any).value);
        coeffsRat[i] = { num: -innerRat.num, den: innerRat.den };
      } else {
        return null;
      }
    }
    return coeffsRat;
  }
}

export class InfiniteRationalStrategy implements LimitStrategy {
  private polyExtractor = new PolynomialExtractor();
  private simplifier = new SymbolicSimplifier();
  
  public apply(ast: CanonicalAST, variable: string, approach: LimitApproach, direction: LimitDirection): TransformationData | null {
    if (approach !== '+infinity' && approach !== '-infinity') return null;
    if (ast.type !== 'Operator' || ast.operator !== '/') return null;
    
    try {
      const numCoeffsMap = this.polyExtractor.extract(this.simplifier.simplify(ast.args[0]), variable);
      const denCoeffsMap = this.polyExtractor.extract(this.simplifier.simplify(ast.args[1]), variable);
      const numCoeffsRat = this.mapToRationalArray(numCoeffsMap);
      const denCoeffsRat = this.mapToRationalArray(denCoeffsMap);
      
      if (!numCoeffsRat || !denCoeffsRat || (numCoeffsRat.length <= 1 && denCoeffsRat.length <= 1)) return null;
      
      const degreeNum = numCoeffsRat.length - 1;
      const degreeDen = denCoeffsRat.length - 1;
      const shift = Math.max(degreeNum, degreeDen); 
      
      const numShifted = this.polyExtractor.rebuildWithShiftExact(numCoeffsRat, variable, shift);
      const denShifted = this.polyExtractor.rebuildWithShiftExact(denCoeffsRat, variable, shift);
      
      const after = this.simplifier.simplify({
        type: 'Operator',
        operator: '/',
        args: [numShifted, denShifted]
      });
      
      return {
         method: 'asymptotic_rational_normalization',
         before: ast,
         after,
         restrictionsAdded: [`${variable} != 0`],
         justification: `Divided numerator and denominator by dominant asymptotic power x^${shift}.`,
         verified: true
      };
    } catch { return null; }
  }

  private mapToRationalArray(coeffsMap: Map<number, CanonicalAST[]>): Rational[] | null {
    const degrees = Array.from(coeffsMap.keys()).sort((a, b) => b - a);
    const maxDegree = degrees.length > 0 ? degrees[0] : 0;
    const coeffsRat: Rational[] = new Array(maxDegree + 1).fill(Rat.zero);
    for (let i = 0; i <= maxDegree; i++) {
      const cASTs = coeffsMap.get(i) || [];
      const sumAST = cASTs.length === 0 ? { type: 'Number', value: '0' } as CanonicalAST 
                   : cASTs.length === 1 ? cASTs[0] 
                   : { type: 'Operator', operator: '+', args: cASTs } as CanonicalAST;
      const simplified = this.simplifier.simplify(sumAST);
      if (simplified.type === 'Number') {
        coeffsRat[i] = Rat.fromString(simplified.value);
      } else if (simplified.type === 'Operator' && simplified.operator === '*' && simplified.args[0].type === 'Number' && simplified.args[0].value === '-1' && simplified.args[1].type === 'Number') {
        const innerRat = Rat.fromString((simplified.args[1] as any).value);
        coeffsRat[i] = { num: -innerRat.num, den: innerRat.den };
      } else {
        return null;
      }
    }
    return coeffsRat;
  }
}

export class RadicalAsymptoticStrategy implements LimitStrategy {
  private polyExtractor = new PolynomialExtractor();
  private simplifier = new SymbolicSimplifier();

  public apply(ast: CanonicalAST, variable: string, approach: LimitApproach, direction: LimitDirection): TransformationData | null {
    if (approach !== '+infinity' && approach !== '-infinity') return null;
    
    let changed = false;
    const after = this.transformRadical(ast, variable, () => changed = true);
    
    if (changed) {
      return {
         method: 'radical_asymptotic_factoring',
         before: ast,
         after: this.simplifier.simplify(after),
         restrictionsAdded: [`${variable} != 0`],
         justification: `Factored dominant power from radical for infinite limit.`,
         verified: true
      };
    }
    return null;
  }
  
  private transformRadical(node: CanonicalAST, variable: string, onChange: () => void): CanonicalAST {
    if (node.type === 'Function' && node.name === 'sqrt') {
       try {
         const coeffsMap = this.polyExtractor.extract(this.simplifier.simplify(node.args[0]), variable);
         const degrees = Array.from(coeffsMap.keys()).sort((a, b) => b - a);
         if (degrees.length > 0 && degrees[0] === 2) { 
           const maxDegree = degrees[0];
           const coeffsRat: Rational[] = new Array(maxDegree + 1).fill(Rat.zero);
           let valid = true;
           for (let i = 0; i <= maxDegree; i++) {
             const cASTs = coeffsMap.get(i) || [];
             if (cASTs.length > 0) {
               const sumAST = cASTs.length === 1 ? cASTs[0] : { type: 'Operator', operator: '+', args: cASTs } as CanonicalAST;
               const simplified = this.simplifier.simplify(sumAST);
               if (simplified.type === 'Number') {
                 coeffsRat[i] = Rat.fromString(simplified.value);
               } else if (simplified.type === 'Operator' && simplified.operator === '*' && simplified.args[0].type === 'Number' && simplified.args[0].value === '-1' && simplified.args[1].type === 'Number') {
                 const innerRat = Rat.fromString((simplified.args[1] as any).value);
                 coeffsRat[i] = { num: -innerRat.num, den: innerRat.den };
               } else {
                 valid = false;
               }
             }
           }
           
           if (valid) {
             const shifted = this.polyExtractor.rebuildWithShiftExact(coeffsRat, variable, 2);
             onChange();
             return {
               type: 'Operator',
               operator: '*',
               args: [
                 { type: 'Function', name: 'abs', args: [{ type: 'Symbol', name: variable }] },
                 { type: 'Function', name: 'sqrt', args: [shifted] }
               ]
             };
           }
         }
       } catch {}
    }
    
    if (node.type === 'Operator' || node.type === 'Function') {
      const args = node.args ? node.args.map((a: CanonicalAST) => this.transformRadical(a, variable, onChange)) : [];
      return { ...node, args } as CanonicalAST;
    }
    if (node.type === 'Parenthesis') {
      return {
        ...node,
        content: this.transformRadical((node as any).content, variable, onChange)
      } as CanonicalAST;
    }

    return node;
  }
}
