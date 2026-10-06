import { CanonicalAST } from '../types/ast';
import { MathStep } from '../types/step';
import { ASTUtils } from './utils';
import { SymbolicSimplifier } from './simplifier';
import { DerivativeEngine } from './derivative';
import { IntegrationByPartsStep } from '../types/integration';
import { Rat } from '../utils/rational';

export class PartsEngine {
  private simplifier = new SymbolicSimplifier();
  private derivativeEngine = new DerivativeEngine();
  private maxPolynomialDegree = 3;

  public matchParts(
    integrand: CanonicalAST,
    variable: string,
    integrateFn: (node: CanonicalAST, v: string, steps: MathStep[], depth: number) => CanonicalAST,
    steps: MathStep[],
    depth: number
  ): { result: CanonicalAST, partsStep: IntegrationByPartsStep } | null {
    
    const candidate = this.detectPattern(integrand, variable);
    if (!candidate) return null;

    const { u, dv } = candidate;

    // Bound repeated integration by parts by the structural
    // polynomial degree of u, rather than the generic integration
    // recursion depth. Generic depth also increases for harmless
    // transformations such as constant extraction.
    if (
       this.getPolynomialDegree(u, variable) >
       this.maxPolynomialDegree
    ) {
       return null;
    }

    let du: CanonicalAST;
    try {
       du = this.simplifier.simplify(this.derivativeEngine.differentiate(u, variable));
    } catch {
       return null;
    }

    let v: CanonicalAST;
    try {
       // Isolate the dv integration so it doesn't pollute the main steps if it fails
       const tempSteps: MathStep[] = [];
       v = integrateFn(dv, variable, tempSteps, depth); // dv doesn't increase parts depth
    } catch {
       return null;
    }

    // Form reduced integral: ∫ v du
    const v_du = this.simplifier.simplify({ type: 'Operator', operator: '*', args: [v, du] });
    
    let reducedIntegrated: CanonicalAST;
    try {
       // Explicitly bound recursion by relying on the orchestrator's depth
       reducedIntegrated = integrateFn(v_du, variable, steps, depth + 1); 
    } catch {
       return null;
    }

    // u v - ∫ v du
    const u_v = this.simplifier.simplify({ type: 'Operator', operator: '*', args: [u, v] });
    const result = this.simplifier.simplify({ type: 'Operator', operator: '-', args: [u_v, reducedIntegrated] });

    const partsStep: IntegrationByPartsStep = {
       originalExpression: integrand,
       uExpression: u,
       dvExpression: dv,
       duExpression: du,
       vExpression: v,
       reducedIntegral: v_du,
       resultExpression: result
    };

    steps.push({
       id: `parts_${Date.now()}_${depth}`,
       title: 'Integration by Parts',
       explanation: `Let u = ${ASTUtils.serialize(u)}, dv = ${ASTUtils.serialize(dv)} dx.\nThen du = ${ASTUtils.serialize(du)} dx, v = ${ASTUtils.serialize(v)}.\n∫ u dv = u v - ∫ v du`
    });

    return { result, partsStep };
  }

  // Strictly bounded structural patterns
  private detectPattern(node: CanonicalAST, variable: string): { u: CanonicalAST, dv: CanonicalAST } | null {
     if (node.type === 'Operator' && node.operator === '*') {
        const terms = node.args;
        if (terms.length !== 2) return null;

        const [t1, t2] = terms;

        // Pattern: x^n * e^x, x^n * sin(x), x^n * cos(x)
        if (this.isPowerOfX(t1, variable) && this.isExpTrig(t2, variable)) return { u: t1, dv: t2 };
        if (this.isPowerOfX(t2, variable) && this.isExpTrig(t1, variable)) return { u: t2, dv: t1 };

        // Pattern: x^n * ln(x)
        if (this.isPowerOfX(t1, variable) && this.isLog(t2, variable)) return { u: t2, dv: t1 };
        if (this.isPowerOfX(t2, variable) && this.isLog(t1, variable)) return { u: t1, dv: t2 };
     }

     // Pattern: ln(x)
     if (this.isLog(node, variable)) {
        return { u: node, dv: { type: 'Number', value: '1' } };
     }

     return null;
  }

  private getPolynomialDegree(
     node: CanonicalAST,
     variable: string
  ): number {
     if (
        node.type === 'Symbol' &&
        node.name === variable
     ) {
        return 1;
     }

     if (
        node.type === 'Operator' &&
        node.operator === '^' &&
        node.args[0].type === 'Symbol' &&
        node.args[0].name === variable &&
        node.args[1].type === 'Number'
     ) {
        try {
           const power = Rat.fromString(
              node.args[1].value
           );

           if (
              power.den === 1n &&
              power.num > 0n
           ) {
              return Number(power.num);
           }
        } catch {
           return Number.POSITIVE_INFINITY;
        }
     }

     // ln(x) and other explicitly supported non-polynomial
     // choices require only one integration-by-parts step.
     return 1;
  }

  private isPowerOfX(node: CanonicalAST, variable: string): boolean {
     if (node.type === 'Symbol' && node.name === variable) return true;
     if (node.type === 'Operator' && node.operator === '^' && node.args[0].type === 'Symbol' && node.args[0].name === variable && node.args[1].type === 'Number') {
        try {
           const p = Rat.fromString(node.args[1].value);
           return p.num > 0n && p.den === 1n; // Positive integer
        } catch {
           return false;
        }
     }
     return false;
  }

  private isExpTrig(node: CanonicalAST, variable: string): boolean {
     if (node.type === 'Function' && node.args.length === 1 && (node.name === 'exp' || node.name === 'sin' || node.name === 'cos')) {
        return true; // we could check if inner is linear, but 6A/6B will fail integration of dv if it's not supported anyway
     }
     if (node.type === 'Operator' && node.operator === '^' && node.args[0].type === 'Symbol' && node.args[0].name === 'e') {
        return true;
     }
     return false;
  }

  private isLog(node: CanonicalAST, variable: string): boolean {
     if (node.type === 'Function' && node.args.length === 1 && (node.name === 'ln' || node.name === 'log')) {
        return ASTUtils.containsVariable(node.args[0], variable); // Must contain variable, though realistically it's x
     }
     return false;
  }
}
