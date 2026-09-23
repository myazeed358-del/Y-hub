import { CanonicalAST } from '../types/ast';

export class ASTNormalizer {
  /**
   * Normalizes an AST structurally.
   * Replaces function aliases (e.g., 'ln' -> 'log').
   * Can expand implicit multiplication explicitly if requested.
   */
  public normalize(ast: CanonicalAST, expandImplicit: boolean = false): CanonicalAST {
    return this.walk(ast, expandImplicit);
  }

  private walk(node: CanonicalAST, expandImplicit: boolean): CanonicalAST {
    switch (node.type) {
      case 'Function':
        return {
          ...node,
          name: this.normalizeFunctionName(node.name),
          args: node.args.map(arg => this.walk(arg, expandImplicit))
        };
      
      case 'Operator':
        return {
          ...node,
          operator: (expandImplicit && node.operator === 'implicit_multiply') ? '*' : node.operator,
          args: node.args.map(arg => this.walk(arg, expandImplicit))
        };

      case 'Parenthesis':
        return {
          ...node,
          content: this.walk(node.content, expandImplicit)
        };

      case 'Equation':
        return {
          ...node,
          lhs: this.walk(node.lhs, expandImplicit),
          rhs: this.walk(node.rhs, expandImplicit)
        };

      case 'Inequality':
        return {
          ...node,
          lhs: this.walk(node.lhs, expandImplicit),
          rhs: this.walk(node.rhs, expandImplicit)
        };
        
      default:
        // Number, Symbol, Constant return as-is
        return node;
    }
  }

  private normalizeFunctionName(name: string): string {
    const aliasMap: Record<string, string> = {
      'ln': 'log',
      'arcsin': 'asin',
      'arccos': 'acos',
      'arctan': 'atan'
    };
    return aliasMap[name] || name;
  }
}
