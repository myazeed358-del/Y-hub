import type { CanonicalAST } from '../../types/ast';
import type { MathStep } from '../../types/step';
import { ASTUtils } from '../utils';
import { SymbolicSimplifier } from '../simplifier';
import { DerivativeEngine } from '../derivative';
import { Rat } from '../../utils/rational';

/** Independent ChainRuleIntegration integration strategy rules. */
export class ChainRuleIntegration {
  private readonly simplifier = new SymbolicSimplifier();
  private readonly derivativeEngine = new DerivativeEngine();

public matchChainRule(node: CanonicalAST, variable: string, steps: MathStep[]): CanonicalAST | null {
    // Check f'(x)/f(x)
    if (node.type === 'Operator' && node.operator === '/') {
       const u = node.args[1];
       const du = this.simplifier.simplify(this.derivativeEngine.differentiate(u, variable));
       const num = this.simplifier.simplify(node.args[0]);
       if (this.areEquivalent(num, du, variable)) {
          steps.push({ id: `int_log_chain_${Date.now()}`, title: 'Logarithmic Integration', explanation: '∫ f\'(x)/f(x) dx = ln|f(x)|' });
          return { type: 'Function', name: 'ln', args: [{ type: 'Function', name: 'abs', args: [u] }] };
       }
    }

    // Check product f'(x) * g(f(x))
    if (node.type === 'Operator' && node.operator === '*') {
       const args = [...node.args];
       for (let i = 0; i < args.length; i++) {
          const uNode = this.extractInnerFunction(args[i]);
          if (!uNode) continue;

          const du = this.simplifier.simplify(this.derivativeEngine.differentiate(uNode, variable));

          // Form the rest of the product
          const restArgs = args.filter((_, idx) => idx !== i);
          const rest = this.simplifier.simplify(restArgs.length === 1 ? restArgs[0] : { type: 'Operator', operator: '*', args: restArgs });

          if (this.areEquivalent(rest, du, variable)) {
             // We found g(u) * du.
             // What is g(u)? It's args[i]. But args[i] is something like cos(u) or e^u.
             const integratedOuter = this.integrateOuterFunction(args[i], uNode, steps);
             if (integratedOuter) {
                return integratedOuter;
             }
          }
       }
    }

    return null;
  }

private extractInnerFunction(node: CanonicalAST): CanonicalAST | null {
     if (node.type === 'Function' && node.args.length === 1) return node.args[0];
     if (node.type === 'Operator' && node.operator === '^') return node.args[0];
     return null;
  }

private integrateOuterFunction(node: CanonicalAST, uNode: CanonicalAST, steps: MathStep[]): CanonicalAST | null {
     if (node.type === 'Function' && node.args.length === 1 && ASTUtils.structuralEquals(node.args[0], uNode)) {
        switch (node.name) {
           case 'sin':
              steps.push({ id: `int_chain_sin_${Date.now()}`, title: 'Chain Rule (Sine)', explanation: '∫ sin(u)du = -cos(u)' });
              return { type: 'Operator', operator: '*', args: [{ type: 'Number', value: '-1' }, { type: 'Function', name: 'cos', args: [uNode] }] };
           case 'cos':
              steps.push({ id: `int_chain_cos_${Date.now()}`, title: 'Chain Rule (Cosine)', explanation: '∫ cos(u)du = sin(u)' });
              return { type: 'Function', name: 'sin', args: [uNode] };
           case 'exp':
              steps.push({ id: `int_chain_exp_${Date.now()}`, title: 'Chain Rule (Exp)', explanation: '∫ e^u du = e^u' });
              return node;
        }
     }
     if (node.type === 'Operator' && node.operator === '^' && node.args[0].type === 'Symbol' && node.args[0].name === 'e' && ASTUtils.structuralEquals(node.args[1], uNode)) {
        steps.push({ id: `int_chain_exp_${Date.now()}`, title: 'Chain Rule (Exp)', explanation: '∫ e^u du = e^u' });
        return node;
     }
     return null;
  }

private areEquivalent(a: CanonicalAST, b: CanonicalAST, variable: string): boolean {
    const diff = this.simplifier.simplify({ type: 'Operator', operator: '-', args: [a, b] });
    if (diff.type === 'Number' && diff.value === '0') return true;
    return ASTUtils.structuralEquals(this.simplifier.simplify(a), this.simplifier.simplify(b));
  }
}
