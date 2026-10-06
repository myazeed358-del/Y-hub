import * as math from 'mathjs';
import { CanonicalAST, OperatorNode } from '../types/ast';
import {
  MathSecurityLimits,
  SecurityViolationError
} from '../types/security';

type MathNodeWithName = math.MathNode & {
  name: string;
};

type MathNodeWithValue = math.MathNode & {
  value: unknown;
};

type MathOperatorNode = math.MathNode & {
  op: string;
  implicit?: boolean;
  args: math.MathNode[];
};

type MathFunctionNode = math.MathNode & {
  fn: math.MathNode;
  args: math.MathNode[];
};

type MathParenthesisNode = math.MathNode & {
  content: math.MathNode;
};

type MathAssignmentNode = math.MathNode & {
  object: math.MathNode;
  value: math.MathNode;
};

export class ExpressionParser {
  private nodeCount = 0;

  public parse(expression: string): CanonicalAST {
    if (
      expression.length >
      MathSecurityLimits.MAX_EXPRESSION_LENGTH
    ) {
      throw new SecurityViolationError(
        `Expression length exceeds limit of ${MathSecurityLimits.MAX_EXPRESSION_LENGTH}`
      );
    }

    this.nodeCount = 0;

    try {
      const equation = this.splitTopLevelEquation(expression);

      if (equation) {
        const [lhsText, rhsText] = equation;

        return {
          type: 'Equation',
          lhs: this.parseFragment(lhsText, 1),
          rhs: this.parseFragment(rhsText, 1)
        };
      }

      return this.parseFragment(expression, 0);
    } catch (err: unknown) {
      if (err instanceof SecurityViolationError) {
        throw err;
      }

      const message =
        err instanceof Error
          ? err.message
          : String(err);

      throw new Error(`Parse Error: ${message}`);
    }
  }

  /**
   * MathJS interprets "=" as assignment syntax, which rejects
   * mathematical equations such as:
   *
   *   x^2 + 1 = 0
   *
   * Equations are part of Y-Hub's canonical AST, so detect a
   * top-level equality first and parse each side independently.
   */
  private splitTopLevelEquation(
    expression: string
  ): [string, string] | null {
    let depth = 0;
    let equalityIndex = -1;

    for (let i = 0; i < expression.length; i++) {
      const char = expression[i];

      if (
        char === '(' ||
        char === '[' ||
        char === '{'
      ) {
        depth++;
        continue;
      }

      if (
        char === ')' ||
        char === ']' ||
        char === '}'
      ) {
        depth = Math.max(0, depth - 1);
        continue;
      }

      if (char !== '=' || depth !== 0) {
        continue;
      }

      const previous = expression[i - 1] ?? '';
      const next = expression[i + 1] ?? '';

      // Do not treat <=, >=, !=, == as equations here.
      if (
        previous === '<' ||
        previous === '>' ||
        previous === '!' ||
        previous === '=' ||
        next === '='
      ) {
        continue;
      }

      if (equalityIndex !== -1) {
        throw new Error(
          'Multiple top-level equality operators are not supported.'
        );
      }

      equalityIndex = i;
    }

    if (equalityIndex === -1) {
      return null;
    }

    const lhs = expression
      .slice(0, equalityIndex)
      .trim();

    const rhs = expression
      .slice(equalityIndex + 1)
      .trim();

    if (!lhs || !rhs) {
      throw new Error(
        'Equation must contain both a left-hand side and a right-hand side.'
      );
    }

    return [lhs, rhs];
  }

  private parseFragment(
    expression: string,
    depth: number
  ): CanonicalAST {
    const mathNode = math.parse(expression);
    return this.toCanonical(mathNode, depth);
  }

  private toCanonical(
    node: math.MathNode,
    depth: number
  ): CanonicalAST {
    this.nodeCount++;

    if (depth > MathSecurityLimits.MAX_AST_DEPTH) {
      throw new SecurityViolationError(
        `AST depth exceeds limit of ${MathSecurityLimits.MAX_AST_DEPTH}`
      );
    }

    if (
      this.nodeCount >
      MathSecurityLimits.MAX_AST_NODES
    ) {
      throw new SecurityViolationError(
        `AST node count exceeds limit of ${MathSecurityLimits.MAX_AST_NODES}`
      );
    }

    switch (node.type) {
      case 'SymbolNode': {
        const symbolNode = node as MathNodeWithName;
        const name = symbolNode.name;

        if (['pi', 'e', 'i'].includes(name)) {
          return {
            type: 'Constant',
            name
          };
        }

        return {
          type: 'Symbol',
          name
        };
      }

      case 'ConstantNode': {
        const constantNode = node as MathNodeWithValue;

        return {
          type: 'Number',
          value: String(constantNode.value)
        };
      }

      case 'OperatorNode': {
        const operatorNode = node as MathOperatorNode;
        const operator = this.toCanonicalOperator(
          operatorNode.op,
          operatorNode.implicit === true
        );

        return {
          type: 'Operator',
          operator,
          args: operatorNode.args.map(arg =>
            this.toCanonical(arg, depth + 1)
          )
        };
      }

      case 'FunctionNode': {
        const functionNode = node as MathFunctionNode;

        const name =
          functionNode.fn.type === 'SymbolNode'
            ? (functionNode.fn as MathNodeWithName).name
            : functionNode.fn.toString();

        return {
          type: 'Function',
          name,
          args: functionNode.args.map(arg =>
            this.toCanonical(arg, depth + 1)
          )
        };
      }

      case 'ParenthesisNode': {
        const parenthesisNode =
          node as MathParenthesisNode;

        return {
          type: 'Parenthesis',
          content: this.toCanonical(
            parenthesisNode.content,
            depth + 1
          )
        };
      }

      case 'AssignmentNode': {
        const assignmentNode =
          node as MathAssignmentNode;

        return {
          type: 'Equation',
          lhs: this.toCanonical(
            assignmentNode.object,
            depth + 1
          ),
          rhs: this.toCanonical(
            assignmentNode.value,
            depth + 1
          )
        };
      }

      default:
        return {
          type: 'Symbol',
          name: node.toString()
        };
    }
  }

  private toCanonicalOperator(
    operator: string,
    implicit: boolean
  ): OperatorNode['operator'] {
    if (implicit) {
      return 'implicit_multiply';
    }

    switch (operator) {
      case '+':
      case '-':
      case '*':
      case '/':
      case '^':
      case '!':
      case '%':
        return operator;

      case 'mod':
        return '%';

      default:
        throw new Error(
          `Unsupported operator: ${operator}`
        );
    }
  }
}
