import { Token, Tokenizer } from './tokenizer';
import { parseCellReference, parseRangeReference } from './references';
import { CellRange } from '../types/cell';

export type ASTNode =
  | NumberNode
  | StringNode
  | BooleanNode
  | CellRefNode
  | RangeRefNode
  | UnaryOpNode
  | BinaryOpNode
  | FunctionCallNode;

export interface NumberNode {
  type: 'Number';
  value: number;
}

export interface StringNode {
  type: 'String';
  value: string;
}

export interface BooleanNode {
  type: 'Boolean';
  value: boolean;
}

export interface CellRefNode {
  type: 'CellRef';
  raw: string;
  row: number;
  col: number;
  sheetName?: string;
}

export interface RangeRefNode {
  type: 'RangeRef';
  raw: string;
  range: CellRange;
  sheetName?: string;
}

export interface UnaryOpNode {
  type: 'UnaryOp';
  operator: '+' | '-';
  argument: ASTNode;
}

export interface BinaryOpNode {
  type: 'BinaryOp';
  operator: string;
  left: ASTNode;
  right: ASTNode;
}

export interface FunctionCallNode {
  type: 'FunctionCall';
  name: string;
  args: ASTNode[];
}

export class FormulaParser {
  private tokens: Token[];
  private current = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  public static parse(formula: string): ASTNode {
    const tokenizer = new Tokenizer(formula);
    const tokens = tokenizer.tokenize();
    const parser = new FormulaParser(tokens);
    return parser.parseExpression();
  }

  public parseExpression(): ASTNode {
    return this.parseComparison();
  }

  /**
   * Comparison operators: =, <>, <, >, <=, >=
   */
  private parseComparison(): ASTNode {
    let left = this.parseConcatenation();

    while (this.matchOperator('=', '<>', '<', '>', '<=', '>=')) {
      const operator = this.previous().value;
      const right = this.parseConcatenation();
      left = {
        type: 'BinaryOp',
        operator,
        left,
        right,
      };
    }

    return left;
  }

  /**
   * String concatenation: &
   */
  private parseConcatenation(): ASTNode {
    let left = this.parseAdditive();

    while (this.matchOperator('&')) {
      const operator = this.previous().value;
      const right = this.parseAdditive();
      left = {
        type: 'BinaryOp',
        operator,
        left,
        right,
      };
    }

    return left;
  }

  /**
   * Addition and Subtraction: +, -
   */
  private parseAdditive(): ASTNode {
    let left = this.parseMultiplicative();

    while (this.matchOperator('+', '-')) {
      const operator = this.previous().value;
      const right = this.parseMultiplicative();
      left = {
        type: 'BinaryOp',
        operator,
        left,
        right,
      };
    }

    return left;
  }

  /**
   * Multiplication, Division, Modulo: *, /, %
   */
  private parseMultiplicative(): ASTNode {
    let left = this.parseExponentiation();

    while (this.matchOperator('*', '/', '%')) {
      const operator = this.previous().value;
      const right = this.parseExponentiation();
      left = {
        type: 'BinaryOp',
        operator,
        left,
        right,
      };
    }

    return left;
  }

  /**
   * Exponentiation: ^ (right-associative)
   */
  private parseExponentiation(): ASTNode {
    const left = this.parseUnary();

    if (this.matchOperator('^')) {
      const operator = this.previous().value;
      const right = this.parseExponentiation();
      return {
        type: 'BinaryOp',
        operator,
        left,
        right,
      };
    }

    return left;
  }

  /**
   * Unary prefix: +, -
   */
  private parseUnary(): ASTNode {
    if (this.matchOperator('+', '-')) {
      const op = this.previous().value as '+' | '-';
      const argument = this.parseUnary();
      return {
        type: 'UnaryOp',
        operator: op,
        argument,
      };
    }

    return this.parsePrimary();
  }

  /**
   * Primary nodes: Numbers, Strings, Booleans, Cell References, Range References,
   * Function calls, and Parenthesized expressions
   */
  private parsePrimary(): ASTNode {
    const token = this.peek();

    // Number
    if (this.match('NUMBER')) {
      return {
        type: 'Number',
        value: parseFloat(this.previous().value),
      };
    }

    // String
    if (this.match('STRING')) {
      return {
        type: 'String',
        value: this.previous().value,
      };
    }

    // Boolean
    if (this.match('BOOLEAN')) {
      return {
        type: 'Boolean',
        value: this.previous().value.toUpperCase() === 'TRUE',
      };
    }

    // Range reference
    if (this.match('RANGE_REF')) {
      const raw = this.previous().value;
      const parsed = parseRangeReference(raw);
      if (!parsed) {
        throw new Error(`#REF! Invalid range: ${raw}`);
      }
      return {
        type: 'RangeRef',
        raw,
        range: parsed.range,
        sheetName: parsed.sheetName,
      };
    }

    // Cell reference
    if (this.match('CELL_REF')) {
      const raw = this.previous().value;
      const parsed = parseCellReference(raw);
      if (!parsed) {
        throw new Error(`#REF! Invalid cell reference: ${raw}`);
      }
      return {
        type: 'CellRef',
        raw,
        row: parsed.row,
        col: parsed.col,
        sheetName: parsed.sheetName,
      };
    }

    // Function call
    if (this.match('IDENTIFIER')) {
      const name = this.previous().value.toUpperCase();
      this.consume('LPAREN', `Expected '(' after function name '${name}'`);

      const args: ASTNode[] = [];
      if (!this.check('RPAREN')) {
        do {
          args.push(this.parseExpression());
        } while (this.match('COMMA'));
      }

      this.consume('RPAREN', `Expected ')' after function arguments for '${name}'`);

      return {
        type: 'FunctionCall',
        name,
        args,
      };
    }

    // Parentheses
    if (this.match('LPAREN')) {
      const expr = this.parseExpression();
      this.consume('RPAREN', "Expected ')' after expression");
      return expr;
    }

    throw new Error(`#ERROR! Unexpected token: ${token.value || token.type}`);
  }

  private match(...types: string[]): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  private matchOperator(...ops: string[]): boolean {
    if (this.check('OPERATOR') && ops.includes(this.peek().value)) {
      this.advance();
      return true;
    }
    return false;
  }

  private check(type: string): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  private isAtEnd(): boolean {
    return this.peek().type === 'EOF';
  }

  private peek(): Token {
    return this.tokens[this.current] || { type: 'EOF', value: '', position: 0 };
  }

  private previous(): Token {
    return this.tokens[this.current - 1] || { type: 'EOF', value: '', position: 0 };
  }

  private consume(type: string, message: string): Token {
    if (this.check(type)) return this.advance();
    throw new Error(`#ERROR! ${message}`);
  }
}
