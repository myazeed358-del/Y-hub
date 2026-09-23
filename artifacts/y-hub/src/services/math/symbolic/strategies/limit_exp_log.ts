import { CanonicalAST } from '../../types/ast';
import { LimitApproach, LimitDirection } from '../../types/limit';
import { TransformationData } from '../../types/step';
import { SymbolicSimplifier } from '../simplifier';
import { LimitEvaluator } from '../limitEvaluator';
import { LimitStrategy } from './limit_algebra';

export class ProductRearrangementStrategy implements LimitStrategy {
  private evaluator = new LimitEvaluator();
  private simplifier = new SymbolicSimplifier();

  public apply(ast: CanonicalAST, variable: string, approach: LimitApproach, direction: LimitDirection): TransformationData | null {
    let applied = false;
    const after = this.transform(ast, variable, approach, direction, () => applied = true);
    if (applied) {
      return {
        method: 'product_rearrangement',
        before: ast,
        after: this.simplifier.simplify(after),
        restrictionsAdded: [],
        justification: 'Rearranged 0 * infinity product into an explicit quotient form.',
        verified: true
      };
    }
    return null;
  }

  private transform(node: CanonicalAST, variable: string, approach: LimitApproach, direction: LimitDirection, onApply: () => void): CanonicalAST {
    if (node.type === 'Operator' && (node.operator === '*' || node.operator === 'implicit_multiply') && node.args.length === 2) {
      const safeDir = direction === 'both' ? 'right' : direction;
      try {
        const r0 = this.evaluator.evaluateForm(node.args[0], variable, approach, safeDir);
        const r1 = this.evaluator.evaluateForm(node.args[1], variable, approach, safeDir);
        
        const is0 = (r: any) => r.type === 'finite' && Math.abs(r.value) < 1e-7;
        const isInf = (r: any) => r.type === 'infinity';
        
        if ((is0(r0) && isInf(r1)) || (isInf(r0) && is0(r1))) {
          onApply();
          const arg0 = node.args[0];
          const arg1 = node.args[1];
          
          const isTranscendental = (n: CanonicalAST) => n.type === 'Function' && (n.name === 'ln' || n.name === 'log' || n.name === 'exp');
          
          let num = arg0, den = arg1;
          if (isTranscendental(arg1)) { num = arg1; den = arg0; }
          else if (isTranscendental(arg0)) { num = arg0; den = arg1; }
          else if (isInf(r1)) { num = arg1; den = arg0; }
          else { num = arg0; den = arg1; }
          
          return {
            type: 'Operator',
            operator: '/',
            args: [
              num,
              { type: 'Operator', operator: '/', args: [{ type: 'Number', value: '1' }, den] }
            ]
          };
        }
      } catch (e) { }
    }
    
    if (node.type === 'Operator' || node.type === 'Function') {
      return {
        ...node,
        args: (node as any).args.map((a: CanonicalAST) => this.transform(a, variable, approach, direction, onApply))
      } as CanonicalAST;
    }
    if (node.type === 'Parenthesis') {
      return {
        ...node,
        content: this.transform((node as any).content, variable, approach, direction, onApply)
      } as CanonicalAST;
    }
    return node;
  }
}

export class ExponentialFormStrategy implements LimitStrategy {
  private evaluator = new LimitEvaluator();
  private simplifier = new SymbolicSimplifier();

  public apply(ast: CanonicalAST, variable: string, approach: LimitApproach, direction: LimitDirection): TransformationData | null {
    let applied = false;
    let restrictions: string[] = [];
    const after = this.transform(ast, variable, approach, direction, () => applied = true, restrictions);
    
    if (applied) {
      return {
        method: 'exponential_logarithmic_transformation',
        before: ast,
        after: this.simplifier.simplify(after),
        restrictionsAdded: restrictions,
        justification: `Applied logarithmic transformation: f(x)^g(x) -> exp(g(x) * ln(f(x)))`,
        verified: true
      };
    }
    return null;
  }

  private transform(node: CanonicalAST, variable: string, approach: LimitApproach, direction: LimitDirection, onApply: () => void, restrictions: string[]): CanonicalAST {
    if (node.type === 'Operator' && node.operator === '^' && (node as any).transformedByExpLog !== true) {
      const base = node.args[0];
      const exp = node.args[1];
      
      const safeDir = direction === 'both' ? 'right' : direction;
      try {
        const bRes = this.evaluator.evaluateForm(base, variable, approach, safeDir);
        const eRes = this.evaluator.evaluateForm(exp, variable, approach, safeDir);
        
        const bVal = bRes.type === 'finite' ? bRes.value : (bRes.type === 'infinity' ? (bRes.sign > 0 ? Infinity : -Infinity) : null);
        const eVal = eRes.type === 'finite' ? eRes.value : (eRes.type === 'infinity' ? (eRes.sign > 0 ? Infinity : -Infinity) : null);
        
        if (bVal !== null && eVal !== null) {
          const is1Inf = Math.abs(bVal - 1) < 1e-7 && Math.abs(eVal) === Infinity;
          const is00 = Math.abs(bVal) < 1e-7 && Math.abs(eVal) < 1e-7;
          const isInf0 = bVal === Infinity && Math.abs(eVal) < 1e-7;
          
          if (is1Inf || is00 || isInf0) {
            let isPositive = false;
            if (is1Inf || isInf0) isPositive = true;
            if (is00) {
              const approachNum = typeof approach === 'number' ? approach : (approach === '+infinity' ? 1e8 : -1e8);
              const probe = safeDir === 'right' ? approachNum + 1e-8 : approachNum - 1e-8;
              try {
                const pRes = this.evaluator.evaluateForm(base, variable, probe, 'right');
                if (pRes.type === 'finite' && pRes.value > 0) isPositive = true;
              } catch {}
            }
            
            if (isPositive) {
              onApply();
              // To represent f(x) > 0 algebraically
              restrictions.push(`logarithmic_domain_safe_neighborhood`);
              
              let inner: CanonicalAST;
              if (exp.type === 'Operator' && exp.operator === '/' && this.isNumber(exp.args[0], 1)) {
                inner = { 
                  type: 'Operator', 
                  operator: '/', 
                  args: [
                    { type: 'Function', name: 'ln', args: [base] },
                    exp.args[1]
                  ] 
                };
              } else {
                inner = { 
                  type: 'Operator', 
                  operator: '*', 
                  args: [
                    exp,
                    { type: 'Function', name: 'ln', args: [base] }
                  ] 
                };
              }
              
              const res = { type: 'Function', name: 'exp', args: [inner] } as CanonicalAST;
              (res as any).transformedByExpLog = true; // prevent repeated transformation if it evaluates back
              return res;
            }
          }
        }
      } catch (e) {
        // Fallthrough
      }
    }

    if (node.type === 'Operator' || node.type === 'Function') {
      return {
        ...node,
        args: (node as any).args.map((a: CanonicalAST) => this.transform(a, variable, approach, direction, onApply, restrictions))
      } as CanonicalAST;
    }
    if (node.type === 'Parenthesis') {
      return {
        ...node,
        content: this.transform((node as any).content, variable, approach, direction, onApply, restrictions)
      } as CanonicalAST;
    }

    return node;
  }

  private isNumber(node: CanonicalAST, val: number): boolean {
    return node.type === 'Number' && parseFloat((node as any).value) === val;
  }
}
