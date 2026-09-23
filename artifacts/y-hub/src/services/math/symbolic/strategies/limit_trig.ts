import { CanonicalAST } from '../../types/ast';
import { LimitApproach, LimitDirection } from '../../types/limit';
import { TransformationData } from '../../types/step';
import { SymbolicSimplifier } from '../simplifier';
import { LimitEvaluator } from '../limitEvaluator';
import { LimitStrategy } from './limit_algebra';

export class TrigonometricLimitStrategy implements LimitStrategy {
  private evaluator = new LimitEvaluator();
  private simplifier = new SymbolicSimplifier();

  public apply(ast: CanonicalAST, variable: string, approach: LimitApproach, direction: LimitDirection): TransformationData | null {
    const approachNum = typeof approach === 'number' ? approach : (approach === '+infinity' ? 1e8 : -1e8);
    
    const identitiesUsed = new Set<string>();
    const restrictions: string[] = [];
    
    const res = this.transform(ast, variable, approachNum, identitiesUsed, restrictions);
    
    if (res.changed) {
       return {
         method: 'standard_trigonometric_limit',
         before: ast,
         after: this.simplifier.simplify(res.node),
         restrictionsAdded: restrictions,
         justification: `Applied standard trigonometric identities: ${Array.from(identitiesUsed).join(', ')}`,
         verified: true
       };
    }
    return null;
  }

  private evaluatesToZero(node: CanonicalAST, variable: string, approach: number): boolean {
    try {
      const res = this.evaluator.evaluateForm(node, variable, approach, 'both');
      if (res.type === 'finite' && Math.abs(res.value) < 1e-7) return true;
    } catch { }
    return false;
  }

  private transform(node: CanonicalAST, variable: string, approach: number, identities: Set<string>, restrictions: string[]): { changed: boolean, node: CanonicalAST } {
    if (node.type === 'Function' && node.name === 'sin') {
      const u = node.args[0];
      if (this.evaluatesToZero(u, variable, approach)) {
        identities.add('lim_{u->0} sin(u)/u = 1');
        return { changed: true, node: u };
      }
    }
    
    if (node.type === 'Function' && node.name === 'tan') {
      const u = node.args[0];
      if (this.evaluatesToZero(u, variable, approach)) {
        identities.add('lim_{u->0} tan(u)/u = 1');
        restrictions.push(`cos(u) != 0`); // Structural domain preservation
        return { changed: true, node: u };
      }
    }

    if (node.type === 'Operator' && node.operator === '-') {
      if (this.isNumber(node.args[0], 1) && node.args[1].type === 'Function' && node.args[1].name === 'cos') {
        const u = node.args[1].args[0];
        if (this.evaluatesToZero(u, variable, approach)) {
          identities.add('lim_{u->0} (1-cos(u))/u^2 = 1/2');
          return { changed: true, node: this.createU2Over2(u) };
        }
      }
      if (node.args[0].type === 'Function' && node.args[0].name === 'cos' && this.isNumber(node.args[1], 1)) {
        const u = node.args[0].args[0];
        if (this.evaluatesToZero(u, variable, approach)) {
          identities.add('lim_{u->0} (cos(u)-1)/u^2 = -1/2');
          return { changed: true, node: this.createNegU2Over2(u) };
        }
      }
    }

    if (node.type === 'Operator') {
      if (node.operator === '*' || node.operator === '/' || node.operator === 'implicit_multiply') {
        let anyChanged = false;
        const newArgs = node.args.map((arg: CanonicalAST) => {
          const res = this.transform(arg, variable, approach, identities, restrictions);
          if (res.changed) anyChanged = true;
          return res.node;
        });
        if (anyChanged) return { changed: true, node: { ...node, args: newArgs } as CanonicalAST };
      } else if (node.operator === '^') {
        if (node.args[1].type === 'Number') {
          const res = this.transform(node.args[0], variable, approach, identities, restrictions);
          if (res.changed) {
            return { changed: true, node: { ...node, args: [res.node, node.args[1]] } as CanonicalAST };
          }
        }
      }
    }

    if (node.type === 'Parenthesis') {
      const res = this.transform((node as any).content, variable, approach, identities, restrictions);
      if (res.changed) return { changed: true, node: { ...node, content: res.node } as CanonicalAST };
    }

    return { changed: false, node };
  }

  private isNumber(node: CanonicalAST, val: number): boolean {
    return node.type === 'Number' && parseFloat((node as any).value) === val;
  }

  private createU2Over2(u: CanonicalAST): CanonicalAST {
    const u2 = { type: 'Operator', operator: '^', args: [u, { type: 'Number', value: '2' }] } as CanonicalAST;
    return { type: 'Operator', operator: '/', args: [u2, { type: 'Number', value: '2' }] } as CanonicalAST;
  }

  private createNegU2Over2(u: CanonicalAST): CanonicalAST {
    return { type: 'Operator', operator: '*', args: [{ type: 'Number', value: '-1' }, this.createU2Over2(u)] } as CanonicalAST;
  }
}
