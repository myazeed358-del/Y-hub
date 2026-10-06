import { CanonicalAST } from '../types/ast';
import { MathStep } from '../types/step';
import { ASTUtils } from './utils';
import { SymbolicSimplifier } from './simplifier';
import { DerivativeEngine } from './derivative';
import { SubstitutionStep } from '../types/integration';
import { Rat } from '../utils/rational';

export class SubstitutionEngine {
  private simplifier = new SymbolicSimplifier();
  private derivativeEngine = new DerivativeEngine();

  // We pass a callback to integrate the u-domain expression
  public matchUSubstitution(
    integrand: CanonicalAST, 
    variable: string, 
    integrateFn: (node: CanonicalAST, v: string, steps: MathStep[], depth: number) => CanonicalAST,
    steps: MathStep[],
    depth: number = 0
  ): { result: CanonicalAST, subStep: SubstitutionStep } | null {
    
    // Find candidate u expressions.
    const candidates = this.findCandidates(integrand, variable);
    
    // Sort candidates: prefer more complex expressions, like x^2+1 over x^2, to avoid nested issues.
    candidates.sort((a, b) => ASTUtils.serialize(b).length - ASTUtils.serialize(a).length);

    for (const uCandidate of candidates) {
       let du: CanonicalAST;
       try {
         du = this.simplifier.simplify(this.derivativeEngine.differentiate(uCandidate, variable));
       } catch {
         continue;
       }

       if (du.type === 'Number' && du.value === '0') continue;

       // Form integrand / du
       const quotient = this.structuralDivide(integrand, du, variable);
       if (!quotient) continue;
       
       const simplifiedQuotient = this.simplifier.simplify(quotient);
       
       // Replace uCandidate with 'u'
      const transformed = this.replaceAST(simplifiedQuotient, uCandidate, { type: 'Symbol', name: 'u' });
       const finalTransformed = this.simplifier.simplify(transformed);

       if (!ASTUtils.containsVariable(finalTransformed, variable)) {
          // Success! We transformed it entirely to u.
          
          try {
             const uIntegrated = integrateFn(finalTransformed, 'u', [], depth);
             const backSubstituted = this.replaceAST(uIntegrated, { type: 'Symbol', name: 'u' }, uCandidate);
             const finalBackSubstituted = this.simplifier.simplify(backSubstituted);
             
             const subStep: SubstitutionStep = {
                originalExpression: integrand,
                substitutionVariable: 'u',
                uExpression: uCandidate,
                duExpression: du,
                transformedExpression: finalTransformed,
                integratedExpression: uIntegrated,
                backSubstitutedExpression: finalBackSubstituted
             };
             
             steps.push({
               id: `u_sub_${Date.now()}`,
               title: 'U-Substitution',
               explanation: `Let u = ${ASTUtils.serialize(uCandidate)}, du = ${ASTUtils.serialize(du)} dx. Transformed to ∫ ${ASTUtils.serialize(finalTransformed)} du.`
             });
             
             return { result: finalBackSubstituted, subStep };
          } catch {
             // The inner integration failed. We move on to the next candidate.
          }
       }
    }
    
    return null;
  }

  private structuralDivide(integrand: CanonicalAST, du: CanonicalAST, variable: string): CanonicalAST | null {
    if (this.areEquivalent(integrand, du, variable)) return { type: 'Number', value: '1' };

    // If integrand is division A / B
    if (integrand.type === 'Operator' && integrand.operator === '/') {
       const num = integrand.args[0];
       const den = integrand.args[1];
       const numDivided = this.structuralDivide(num, du, variable);
       if (numDivided) {
          return { type: 'Operator', operator: '/', args: [numDivided, den] };
       }
       // Alternatively, what if du = 1/B? That's less common for basic substitution
       return null;
    }

    const intTerms = this.getTerms(integrand, '*');
    const duTerms = this.getTerms(du, '*');

    let remainingIntTerms = [...intTerms];
    let intConst = 1n;
    let intConstDen = 1n;
    let duConst = 1n;
    let duConstDen = 1n;

    const extractRat = (terms: CanonicalAST[]) => {
       let num = 1n;
       let den = 1n;
       const rest = [];
       for (const t of terms) {
          if (t.type === 'Number') {
             const r = Rat.fromString(t.value);
             num *= r.num;
             den *= r.den;
          } else {
             rest.push(t);
          }
       }
       return { num, den, rest };
    };

    const intExtracted = extractRat(remainingIntTerms);
    const duExtracted = extractRat(duTerms);
    
    remainingIntTerms = intExtracted.rest;
    const remainingDuTerms = duExtracted.rest;
    
    const finalConstRat = Rat.div({ num: intExtracted.num, den: intExtracted.den }, { num: duExtracted.num, den: duExtracted.den });

    for (const d of remainingDuTerms) {
      let matched = false;
      for (let i = 0; i < remainingIntTerms.length; i++) {
         if (this.areEquivalent(remainingIntTerms[i], d, variable)) {
            remainingIntTerms.splice(i, 1);
            matched = true;
            break;
         }
      }
      if (!matched) return null;
    }

    if (finalConstRat.num !== 1n || finalConstRat.den !== 1n) {
       const constantAST: CanonicalAST =
          finalConstRat.den === 1n
             ? {
                 type: 'Number',
                 value: finalConstRat.num.toString()
               }
             : {
                 type: 'Operator',
                 operator: '/',
                 args: [
                   {
                     type: 'Number',
                     value: finalConstRat.num.toString()
                   },
                   {
                     type: 'Number',
                     value: finalConstRat.den.toString()
                   }
                 ]
               };

       remainingIntTerms.unshift(constantAST);
    }

    if (remainingIntTerms.length === 0) return { type: 'Number', value: '1' };
    if (remainingIntTerms.length === 1) return remainingIntTerms[0];
    return { type: 'Operator', operator: '*', args: remainingIntTerms };
  }

  private getTerms(node: CanonicalAST, op: string): CanonicalAST[] {
    if (node.type === 'Operator' && node.operator === op) return node.args;
    return [node];
  }

  private areEquivalent(a: CanonicalAST, b: CanonicalAST, variable: string): boolean {
    const diff = this.simplifier.simplify({ type: 'Operator', operator: '-', args: [a, b] });
    return diff.type === 'Number' && diff.value === '0';
  }

  private findCandidates(node: CanonicalAST, variable: string, candidates: Map<string, CanonicalAST> = new Map()): CanonicalAST[] {
    if (!ASTUtils.containsVariable(node, variable)) return [];
    
    // Avoid making u = x
    if (node.type === 'Symbol' && node.name === variable) return [];

   const key = ASTUtils.structuralKey(node);
   if (!candidates.has(key)) {
       // Avoid some trivial ones
       if (node.type === 'Operator' && node.operator === '*' && node.args.length === 2 && node.args[0].type === 'Number') {
          // let u = 2x is fine, but maybe let's collect it
          candidates.set(key, node);
       } else {
          candidates.set(key, node);
       }
    }

    if (node.type === 'Operator' || node.type === 'Function' || node.type === 'Equation' || node.type === 'Inequality') {
       for (const arg of (node as any).args || []) {
          this.findCandidates(arg, variable, candidates);
       }
    }
    
    return Array.from(candidates.values());
  }

  private replaceAST(node: CanonicalAST, target: CanonicalAST, replacement: CanonicalAST): CanonicalAST {
    if (ASTUtils.structuralEquals(node, target)) {
       return replacement;
    }
    if (node.type === 'Operator') {
       return { ...node, args: node.args.map(a => this.replaceAST(a, target, replacement)) };
    }
    if (node.type === 'Function') {
       return { ...node, args: node.args.map(a => this.replaceAST(a, target, replacement)) };
    }
    if (node.type === 'Equation' || node.type === 'Inequality') {
       return { ...node, lhs: this.replaceAST(node.lhs, target, replacement), rhs: this.replaceAST(node.rhs, target, replacement) };
    }
    return node;
  }
}
