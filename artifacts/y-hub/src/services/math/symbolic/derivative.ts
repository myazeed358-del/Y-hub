import { CanonicalAST } from '../types/ast';
import { MathStep } from '../types/step';
import { SymbolicSimplifier } from './simplifier';
import { ASTUtils } from './utils';

export class DerivativeEngine {
  private simplifier = new SymbolicSimplifier();

  public differentiate(node: CanonicalAST, variable: string, steps: MathStep[] = []): CanonicalAST {
    const rawDeriv = this.applyRules(node, variable, steps);
    const simplified = this.simplifier.simplify(rawDeriv);
    
    if (!ASTUtils.structuralEquals(rawDeriv, simplified)) {
      steps.push({
        id: `simplification_${Date.now()}`,
        title: 'Simplification',
        explanation: 'Simplified the resulting derivative expression.',
      });
    }
    
    return simplified;
  }

  public differentiateN(node: CanonicalAST, variable: string, n: number, steps: MathStep[] = []): CanonicalAST {
    let current = node;
    for (let i = 0; i < n; i++) {
      steps.push({ id: `higher_order_${i+1}`, title: `Derivative Order ${i+1}`, explanation: `Taking derivative with respect to ${variable}` });
      current = this.differentiate(current, variable, steps);
    }
    return current;
  }

  private applyRules(node: CanonicalAST, variable: string, steps: MathStep[]): CanonicalAST {
    if (node.type === 'Number' || node.type === 'Constant') {
      return { type: 'Number', value: '0' };
    }

    if (node.type === 'Symbol') {
      return node.name === variable 
        ? { type: 'Number', value: '1' } 
        : { type: 'Number', value: '0' }; 
    }

    if (node.type === 'Operator') {
      const { operator, args } = node as any;
      
      if (operator === '+' || operator === '-') {
        steps.push({ id: `sum_rule`, title: 'Linearity', explanation: 'Differentiating term by term.' });
        return {
          type: 'Operator',
          operator,
          args: args.map((arg: CanonicalAST) => this.applyRules(arg, variable, steps))
        };
      }

      if (operator === '*' || operator === 'implicit_multiply') {
        steps.push({
          id: `product_rule`,
          title: 'Product Rule',
          explanation: 'Applied the product rule to all factors.'
        });

        if (args.length === 0) {
          return { type: 'Number', value: '0' };
        }

        if (args.length === 1) {
          return this.applyRules(args[0], variable, steps);
        }

        // d(f1*f2*...*fn)
        // = sum_i [ fi' * product_(j != i) fj ]
        const derivativeTerms: CanonicalAST[] = args.map(
          (factor: CanonicalAST, index: number) => {
            const differentiated =
              this.applyRules(factor, variable, steps);

            return {
              type: 'Operator',
              operator: '*',
              args: args.map(
                (original: CanonicalAST, factorIndex: number) =>
                  factorIndex === index
                    ? differentiated
                    : original
              )
            } as CanonicalAST;
          }
        );

        return {
          type: 'Operator',
          operator: '+',
          args: derivativeTerms
        };
      }

      if (operator === '/') {
        steps.push({ id: `quotient_rule`, title: 'Quotient Rule', explanation: 'd(u/v) = (u\'v - uv\') / v^2' });
        const u = args[0], v = args[1];
        const du = this.applyRules(u, variable, steps);
        const dv = this.applyRules(v, variable, steps);
        return {
          type: 'Operator', operator: '/', args: [
            { type: 'Operator', operator: '-', args: [
                { type: 'Operator', operator: '*', args: [du, v] },
                { type: 'Operator', operator: '*', args: [u, dv] }
            ]},
            { type: 'Operator', operator: '^', args: [v, { type: 'Number', value: '2' }] }
          ]
        };
      }

      if (operator === '^') {
        const u = args[0], v = args[1];
        // Power Rule: u^n
        if (v.type === 'Number' || (v.type === 'Symbol' && v.name !== variable && ASTUtils.extractSymbols(v).size === 0)) {
          steps.push({ id: `power_rule`, title: 'Power Rule', explanation: 'd(u^n) = n * u^(n-1) * u\'' });
          const du = this.applyRules(u, variable, steps);
          const newVal = parseFloat((v as any).value || '0') - 1;
          
          return {
            type: 'Operator', operator: '*', args: [
              { type: 'Operator', operator: '*', args: [
                  v,
                  { type: 'Operator', operator: '^', args: [u, { type: 'Number', value: newVal.toString() }] }
              ]},
              du
            ]
          };
        } 
        // Exponential Rule: a^x where a is constant
        else if (u.type === 'Number' || (u.type === 'Symbol' && u.name !== variable)) {
          steps.push({ id: `exp_base_rule`, title: 'Exponential Base Rule', explanation: 'd(a^v) = a^v * ln(a) * v\'' });
          const dv = this.applyRules(v, variable, steps);
          const lnA = { type: 'Function', name: 'ln', args: [u] } as CanonicalAST;
          return {
            type: 'Operator', operator: '*', args: [
              node, // a^v
              { type: 'Operator', operator: '*', args: [lnA, dv] }
            ]
          };
        }
        else {
          // General u^v = exp(v * ln(u))
          steps.push({ id: 'general_exp_rule', title: 'Logarithmic Differentiation', explanation: "d(u^v) = u^v * d(v*ln(u))" });
          const lnU = { type: 'Function', name: 'ln', args: [u] } as CanonicalAST;
          const vLnU = { type: 'Operator', operator: '*', args: [v, lnU] } as CanonicalAST;
          const dVLnU = this.applyRules(vLnU, variable, steps);
          return { type: 'Operator', operator: '*', args: [node, dVLnU] };
        }
      }
    }

    if (node.type === 'Function') {
      const { name, args } = node as any;
      const u = args[0];
      const du = this.applyRules(u, variable, steps);
      
      steps.push({ id: `chain_rule_${name}`, title: `Derivative of ${name}`, explanation: `Applying chain rule for ${name}(u)` });

      const n1 = { type: 'Number', value: '1' } as CanonicalAST;
      const n2 = { type: 'Number', value: '2' } as CanonicalAST;
      const n_neg1 = { type: 'Number', value: '-1' } as CanonicalAST;
      
      const u2 = { type: 'Operator', operator: '^', args: [u, n2] } as CanonicalAST;
      const one_minus_u2 = { type: 'Operator', operator: '-', args: [n1, u2] } as CanonicalAST;
      const one_plus_u2 = { type: 'Operator', operator: '+', args: [n1, u2] } as CanonicalAST;

      // Trigonometric
      if (name === 'sin') return { type: 'Operator', operator: '*', args: [{ type: 'Function', name: 'cos', args: [u] }, du] };
      if (name === 'cos') return { type: 'Operator', operator: '*', args: [{ type: 'Operator', operator: '*', args: [n_neg1, { type: 'Function', name: 'sin', args: [u] }] }, du] };
      if (name === 'tan') return { type: 'Operator', operator: '*', args: [{ type: 'Operator', operator: '^', args: [{ type: 'Function', name: 'sec', args: [u] }, n2] }, du] };
      if (name === 'sec') return { type: 'Operator', operator: '*', args: [{ type: 'Operator', operator: '*', args: [{ type: 'Function', name: 'sec', args: [u] }, { type: 'Function', name: 'tan', args: [u] }] }, du] };
      if (name === 'csc') return { type: 'Operator', operator: '*', args: [{ type: 'Operator', operator: '*', args: [n_neg1, { type: 'Operator', operator: '*', args: [{ type: 'Function', name: 'csc', args: [u] }, { type: 'Function', name: 'cot', args: [u] }] }] }, du] };
      if (name === 'cot') return { type: 'Operator', operator: '*', args: [{ type: 'Operator', operator: '*', args: [n_neg1, { type: 'Operator', operator: '^', args: [{ type: 'Function', name: 'csc', args: [u] }, n2] }] }, du] };
      
      // Inverse Trigonometric - Corrected EXACT forms (u' / sqrt(1 - u^2))
      if (name === 'asin') return { type: 'Operator', operator: '/', args: [du, { type: 'Function', name: 'sqrt', args: [one_minus_u2] }] };
      if (name === 'acos') return { type: 'Operator', operator: '/', args: [{ type: 'Operator', operator: '*', args: [n_neg1, du] }, { type: 'Function', name: 'sqrt', args: [one_minus_u2] }] };
      if (name === 'atan') return { type: 'Operator', operator: '/', args: [du, one_plus_u2] };
      if (name === 'acot') return { type: 'Operator', operator: '/', args: [{ type: 'Operator', operator: '*', args: [n_neg1, du] }, one_plus_u2] };
      
      const u2_minus_one = { type: 'Operator', operator: '-', args: [u2, n1] } as CanonicalAST;
      const abs_u = { type: 'Function', name: 'abs', args: [u] } as CanonicalAST;
      const denom_asec = { type: 'Operator', operator: '*', args: [abs_u, { type: 'Function', name: 'sqrt', args: [u2_minus_one] }] } as CanonicalAST;
      if (name === 'asec') return { type: 'Operator', operator: '/', args: [du, denom_asec] };
      if (name === 'acsc') return { type: 'Operator', operator: '/', args: [{ type: 'Operator', operator: '*', args: [n_neg1, du] }, denom_asec] };
      
      // Hyperbolic
      if (name === 'sinh') return { type: 'Operator', operator: '*', args: [{ type: 'Function', name: 'cosh', args: [u] }, du] };
      if (name === 'cosh') return { type: 'Operator', operator: '*', args: [{ type: 'Function', name: 'sinh', args: [u] }, du] };
      if (name === 'tanh') return { type: 'Operator', operator: '*', args: [{ type: 'Operator', operator: '^', args: [{ type: 'Function', name: 'sech', args: [u] }, n2] }, du] };
      
      // Exp / Log
      if (name === 'exp') return { type: 'Operator', operator: '*', args: [{ type: 'Function', name: 'exp', args: [u] }, du] };
      if (name === 'log' || name === 'ln') return { type: 'Operator', operator: '/', args: [du, u] };
      if (name === 'sqrt') return { type: 'Operator', operator: '/', args: [du, { type: 'Operator', operator: '*', args: [n2, { type: 'Function', name: 'sqrt', args: [u] }] }] };
      if (name === 'abs') return { type: 'Operator', operator: '*', args: [{ type: 'Operator', operator: '/', args: [u, { type: 'Function', name: 'abs', args: [u] }] }, du] };

      throw new Error(`Derivative for function ${name} is currently unsupported locally.`);
    }

    if (node.type === 'Parenthesis') {
      return { type: 'Parenthesis', content: this.applyRules((node as any).content, variable, steps) };
    }

    throw new Error(`Cannot differentiate node type ${node.type}`);
  }
}
