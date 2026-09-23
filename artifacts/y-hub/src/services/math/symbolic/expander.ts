import { CanonicalAST } from '../types/ast';
import { ASTUtils } from './utils';

export class PolynomialExpander {
  /**
   * Structurally expands polynomial expressions.
   * e.g., (A + B) * C -> A*C + B*C
   * e.g., (A + B)^2 -> A^2 + 2AB + B^2
   */
  public expand(node: CanonicalAST): CanonicalAST {
    if (node.type === 'Parenthesis') {
      return this.expand(node.content);
    }

    if (node.type === 'Operator') {
      const args = node.args.map(arg => this.expand(arg));
      
      if (node.operator === '+') {
        return { type: 'Operator', operator: '+', args: this.flattenSum(args) };
      }
      
      if (node.operator === '-') {
        if (args.length === 1) return { type: 'Operator', operator: '*', args: [{ type: 'Number', value: '-1' }, args[0]] };
        const negArgs = args.slice(1).map(a => this.expand({ type: 'Operator', operator: '*', args: [{ type: 'Number', value: '-1' }, a] }));
        return { type: 'Operator', operator: '+', args: this.flattenSum([args[0], ...negArgs]) };
      }

      if (node.operator === '*' || node.operator === 'implicit_multiply') {
        return this.expandProductList(args);
      }

      if (node.operator === '^') {
        const base = args[0];
        const exp = args[1];
        if (exp.type === 'Number') {
          const n = parseFloat((exp as any).value);
          if (Number.isInteger(n) && n > 0 && n <= 10) { // Limit expansion to power 10 for safety
            let res = base;
            for (let i = 1; i < n; i++) {
              res = this.expandProduct(res, base);
            }
            return res;
          }
        }
      }
      
      return { ...node, args } as CanonicalAST;
    }

    if (node.type === 'Equation' || node.type === 'Inequality') {
      return { ...node, lhs: this.expand((node as any).lhs), rhs: this.expand((node as any).rhs) } as CanonicalAST;
    }

    return node;
  }

  private expandProductList(args: CanonicalAST[]): CanonicalAST {
    if (args.length === 0) return { type: 'Number', value: '1' };
    if (args.length === 1) return args[0];
    let res = args[0];
    for (let i = 1; i < args.length; i++) {
      res = this.expandProduct(res, args[i]);
    }
    return res;
  }

  private expandProduct(left: CanonicalAST, right: CanonicalAST): CanonicalAST {
    const lTerms = this.getSumTerms(left);
    const rTerms = this.getSumTerms(right);
    
    const products: CanonicalAST[] = [];
    for (const l of lTerms) {
      for (const r of rTerms) {
        products.push({ type: 'Operator', operator: '*', args: [l, r] });
      }
    }
    return { type: 'Operator', operator: '+', args: products };
  }

  private getSumTerms(node: CanonicalAST): CanonicalAST[] {
    if (node.type === 'Operator' && node.operator === '+') {
      return this.flattenSum(node.args);
    }
    return [node];
  }

  private flattenSum(args: CanonicalAST[]): CanonicalAST[] {
    const flat: CanonicalAST[] = [];
    for (const arg of args) {
      if (arg.type === 'Operator' && arg.operator === '+') {
        flat.push(...this.flattenSum(arg.args));
      } else {
        flat.push(arg);
      }
    }
    return flat;
  }
}
