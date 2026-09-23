import * as math from 'mathjs';
import { CanonicalAST } from '../types/ast';
import { MathSecurityLimits, SecurityViolationError } from '../types/security';

export class ExpressionParser {
  private nodeCount = 0;

  public parse(expression: string): CanonicalAST {
    if (expression.length > MathSecurityLimits.MAX_EXPRESSION_LENGTH) {
      throw new SecurityViolationError(`Expression length exceeds limit of ${MathSecurityLimits.MAX_EXPRESSION_LENGTH}`);
    }

    this.nodeCount = 0;
    try {
      const mathNode = math.parse(expression);
      return this.toCanonical(mathNode, 0);
    } catch (err: any) {
      if (err instanceof SecurityViolationError) throw err;
      throw new Error(`Parse Error: ${err.message}`);
    }
  }

  private toCanonical(node: math.MathNode, depth: number): CanonicalAST {
    this.nodeCount++;
    if (depth > MathSecurityLimits.MAX_AST_DEPTH) {
      throw new SecurityViolationError(`AST depth exceeds limit of ${MathSecurityLimits.MAX_AST_DEPTH}`);
    }
    if (this.nodeCount > MathSecurityLimits.MAX_AST_NODES) {
      throw new SecurityViolationError(`AST node count exceeds limit of ${MathSecurityLimits.MAX_AST_NODES}`);
    }

    if (node.isSymbolNode) {
      const name = (node as any).name;
      if (['pi', 'e', 'i'].includes(name)) {
        return { type: 'Constant', name };
      }
      return { type: 'Symbol', name };
    }

    if (node.isConstantNode) {
      return { type: 'Number', value: (node as any).value.toString() };
    }

    if (node.isOperatorNode) {
      const opNode = node as any;
      const op = opNode.implicit ? 'implicit_multiply' : opNode.op;
      return {
        type: 'Operator',
        operator: op,
        args: opNode.args.map((arg: math.MathNode) => this.toCanonical(arg, depth + 1))
      };
    }

    if (node.isFunctionNode) {
      const fnNode = node as any;
      return {
        type: 'Function',
        name: fnNode.fn.name,
        args: fnNode.args.map((arg: math.MathNode) => this.toCanonical(arg, depth + 1))
      };
    }

    if (node.isParenthesisNode) {
      return {
        type: 'Parenthesis',
        content: this.toCanonical((node as any).content, depth + 1)
      };
    }

    if (node.isAssignmentNode) {
      const eqNode = node as any;
      return {
        type: 'Equation',
        lhs: this.toCanonical(eqNode.object, depth + 1),
        rhs: this.toCanonical(eqNode.value, depth + 1)
      };
    }

    // Default fallback to string representation for unsupported nodes temporarily
    return { type: 'Symbol', name: node.toString() };
  }
}
