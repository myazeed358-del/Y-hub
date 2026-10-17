import { ASTNode } from './parser';
import { CellRange, CellValue } from '../types/cell';
import { functionRegistry } from './functions/registry';

export type CellResolver = (row: number, col: number, sheetName?: string) => CellValue;
export type RangeResolver = (range: CellRange, sheetName?: string) => CellValue[][];

export interface EvaluationContext {
  resolveCell: CellResolver;
  resolveRange: RangeResolver;
  currentSheetName?: string;
}

export class FormulaEvaluator {
  private context: EvaluationContext;

  constructor(context: EvaluationContext) {
    this.context = context;
  }

  public evaluate(node: ASTNode): CellValue | CellValue[][] {
    switch (node.type) {
      case 'Number':
        return node.value;

      case 'String':
        return node.value;

      case 'Boolean':
        return node.value;

      case 'CellRef': {
        const val = this.context.resolveCell(
          node.row,
          node.col,
          node.sheetName || this.context.currentSheetName
        );
        return val;
      }

      case 'RangeRef': {
        return this.context.resolveRange(
          node.range,
          node.sheetName || this.context.currentSheetName
        );
      }

      case 'UnaryOp': {
        const argVal = this.evaluate(node.argument);
        if (this.isError(argVal)) return argVal;
        const num = this.toNumber(argVal);
        if (node.operator === '-') return -num;
        return num;
      }

      case 'BinaryOp': {
        return this.evaluateBinaryOp(node);
      }

      case 'FunctionCall': {
        return this.evaluateFunctionCall(node);
      }
    }
  }

  private evaluateBinaryOp(node: { operator: string; left: ASTNode; right: ASTNode }): CellValue {
    const leftVal = this.evaluate(node.left);
    if (this.isError(leftVal)) return leftVal;

    const rightVal = this.evaluate(node.right);
    if (this.isError(rightVal)) return rightVal;

    // String concatenation
    if (node.operator === '&') {
      const leftStr = leftVal === null || leftVal === undefined ? '' : String(leftVal);
      const rightStr = rightVal === null || rightVal === undefined ? '' : String(rightVal);
      return leftStr + rightStr;
    }

    // Comparison operators
    if (['=', '<>', '<', '>', '<=', '>='].includes(node.operator)) {
      return this.evaluateComparison(node.operator, leftVal, rightVal);
    }

    // Arithmetic operators require numbers
    const lNum = this.toNumber(leftVal);
    const rNum = this.toNumber(rightVal);

    switch (node.operator) {
      case '+':
        return lNum + rNum;
      case '-':
        return lNum - rNum;
      case '*':
        return lNum * rNum;
      case '/':
        if (rNum === 0) throw new Error('#DIV/0! Division by zero');
        return lNum / rNum;
      case '%':
        if (rNum === 0) throw new Error('#DIV/0! Modulo by zero');
        return lNum - rNum * Math.floor(lNum / rNum);
      case '^': {
        const res = Math.pow(lNum, rNum);
        if (isNaN(res)) throw new Error('#NUM! Invalid numeric operation');
        return res;
      }
      default:
        throw new Error(`#ERROR! Unsupported operator: ${node.operator}`);
    }
  }

  private evaluateComparison(op: string, left: unknown, right: unknown): boolean {
    // If both are strings, compare case-insensitively like Excel
    if (typeof left === 'string' && typeof right === 'string') {
      const l = left.toUpperCase();
      const r = right.toUpperCase();
      switch (op) {
        case '=':
          return l === r;
        case '<>':
          return l !== r;
        case '<':
          return l < r;
        case '>':
          return l > r;
        case '<=':
          return l <= r;
        case '>=':
          return l >= r;
      }
    }

    // General comparisons (numbers, booleans, mixed)
    const l = (left ?? '') as string | number | boolean;
    const r = (right ?? '') as string | number | boolean;

    switch (op) {
      case '=':
        return l === r;
      case '<>':
        return l !== r;
      case '<':
        return l < r;
      case '>':
        return l > r;
      case '<=':
        return l <= r;
      case '>=':
        return l >= r;
      default:
        return false;
    }
  }

  private evaluateFunctionCall(node: { name: string; args: ASTNode[] }): CellValue {
    const fn = functionRegistry.get(node.name);
    if (!fn) {
      throw new Error(`#NAME? Unknown function: ${node.name}`);
    }

    // Evaluate each argument
    const evaluatedArgs: unknown[] = [];
    for (const argNode of node.args) {
      const val = this.evaluate(argNode);
      evaluatedArgs.push(val);
    }

    return fn(evaluatedArgs);
  }

  private toNumber(val: unknown): number {
    if (typeof val === 'number') return val;
    if (typeof val === 'boolean') return val ? 1 : 0;
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'string') {
      const parsed = Number(val);
      if (isNaN(parsed)) {
        throw new Error('#VALUE! Cannot convert string to number');
      }
      return parsed;
    }
    throw new Error('#VALUE! Invalid numeric value');
  }

  private isError(val: unknown): val is string {
    return typeof val === 'string' && val.startsWith('#') && (val.endsWith('!') || val.endsWith('?'));
  }
}
