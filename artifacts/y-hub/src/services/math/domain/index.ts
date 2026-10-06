import { CanonicalAST } from '../types/ast';

export interface DomainRestriction {
  type: 'denominator' | 'logarithm' | 'even_root' | 'inverse_trig' | 'inverse_sec_csc';
  conditionAST: CanonicalAST; // The expression that must be != 0, > 0, etc.
  message: string;
}

export class DomainAnalyzer {
  /**
   * Scans an AST to find domain restrictions.
   * Conservative approach: logs what components strictly impose limitations.
   */
  public analyze(ast: CanonicalAST): DomainRestriction[] {
    const restrictions: DomainRestriction[] = [];
    this.walk(ast, restrictions);
    return restrictions;
  }

  private walk(node: CanonicalAST, restrictions: DomainRestriction[]) {
    if (node.type === 'Operator' && node.operator === '/') {
      // Denominator cannot be zero
      restrictions.push({
        type: 'denominator',
        conditionAST: node.args[1],
        message: 'Denominator must not equal zero'
      });
    }

    if (node.type === 'Function') {
      const fn = node.name.toLowerCase();

      // Trigonometric functions with reciprocal definitions carry
      // non-zero denominator constraints.
      //
      // tan(u), sec(u): cos(u) != 0
      // cot(u), csc(u): sin(u) != 0
      if (fn === 'tan' || fn === 'sec') {
        restrictions.push({
          type: 'denominator',
          conditionAST: {
            type: 'Function',
            name: 'cos',
            args: [node.args[0]]
          },
          message: 'cos(argument) must not equal zero'
        });
      }

      if (fn === 'cot' || fn === 'csc') {
        restrictions.push({
          type: 'denominator',
          conditionAST: {
            type: 'Function',
            name: 'sin',
            args: [node.args[0]]
          },
          message: 'sin(argument) must not equal zero'
        });
      }
      if (fn === 'log' || fn === 'ln') {
        restrictions.push({
          type: 'logarithm',
          conditionAST: node.args[0],
          message: 'Argument of logarithm must be strictly greater than zero'
        });
      }
      if (fn === 'sqrt') {
        restrictions.push({
          type: 'even_root',
          conditionAST: node.args[0],
          message: 'Argument of square root must be greater than or equal to zero in the real domain'
        });
      }
      if (fn === 'asin' || fn === 'acos') {
        restrictions.push({
          type: 'inverse_trig',
          conditionAST: node.args[0],
          message: 'Argument of arcsin/arccos must be in the interval [-1, 1]'
        });
      }
      if (fn === 'asec' || fn === 'acsc') {
        restrictions.push({
          type: 'inverse_sec_csc',
          conditionAST: node.args[0],
          message: 'Argument of arcsec/arccsc must be <= -1 or >= 1 in the real domain'
        });
      }
    }

    // Recurse
    if (node.type === 'Operator' || node.type === 'Function') {
      node.args.forEach(arg => this.walk(arg, restrictions));
    } else if (node.type === 'Parenthesis') {
      this.walk(node.content, restrictions);
    } else if (node.type === 'Equation' || node.type === 'Inequality') {
      this.walk(node.lhs, restrictions);
      this.walk(node.rhs, restrictions);
    }
  }
}
