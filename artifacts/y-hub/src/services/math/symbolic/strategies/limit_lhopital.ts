import { CanonicalAST } from '../../types/ast';
import { LimitApproach, LimitDirection } from '../../types/limit';
import { TransformationData } from '../../types/step';
import { SymbolicSimplifier } from '../simplifier';
import { DerivativeEngine } from '../derivative';
import { LimitEvaluator } from '../limitEvaluator';
import { LimitStrategy } from './limit_algebra';

export class LHopitalStrategy implements LimitStrategy {
  private derivativeEngine = new DerivativeEngine();
  private simplifier = new SymbolicSimplifier();
  private evaluator = new LimitEvaluator();

  public apply(ast: CanonicalAST, variable: string, approach: LimitApproach, direction: LimitDirection): TransformationData | null {
    let applied = false;
    const after = this.transform(ast, variable, approach, direction, () => applied = true);

    if (applied) {
      return {
        method: 'l_hopital',
        before: ast,
        after: this.simplifier.simplify(after),
        restrictionsAdded: [],
        justification: `Applied L'Hôpital's Rule to indeterminate quotient.`,
        verified: true 
      };
    }
    return null;
  }

  private transform(node: CanonicalAST, variable: string, approach: LimitApproach, direction: LimitDirection, onApply: () => void): CanonicalAST {
    if (node.type === 'Operator' && node.operator === '/') {
      const safeDir = direction === 'both' ? 'right' : direction;
      try {
        const nRes = this.evaluator.evaluateForm(node.args[0], variable, approach, safeDir);
        const dRes = this.evaluator.evaluateForm(node.args[1], variable, approach, safeDir);
        
        const is0 = (r: any) => r.type === 'finite' && Math.abs(r.value) < 1e-7;
        const isInf = (r: any) => r.type === 'infinity';
        
        if ((is0(nRes) && is0(dRes)) || (isInf(nRes) && isInf(dRes))) {
          const dNum = this.derivativeEngine.differentiate(node.args[0], variable);
          const dDen = this.derivativeEngine.differentiate(node.args[1], variable);
          onApply();
          return { type: 'Operator', operator: '/', args: [dNum, dDen] };
        }
      } catch (e) {
        // Fallthrough to recurse
      }
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
