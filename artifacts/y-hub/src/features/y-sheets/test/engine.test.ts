import { describe, it, expect } from 'vitest';
import { FormulaParser } from '../engine/parser';
import { FormulaEvaluator } from '../engine/evaluator';
import { CellRange, CellValue } from '../types/cell';

function evaluateFormula(
  formula: string,
  cells: Record<string, CellValue> = {},
  ranges: Record<string, CellValue[][]> = {}
): CellValue | CellValue[][] {
  const ast = FormulaParser.parse(formula);
  const evaluator = new FormulaEvaluator({
    resolveCell: (r, c) => {
      const colLetter = String.fromCharCode(65 + c);
      const key = `${colLetter}${r + 1}`;
      return cells[key] ?? null;
    },
    resolveRange: (range: CellRange) => {
      const startCol = String.fromCharCode(65 + range.startCol);
      const endCol = String.fromCharCode(65 + range.endCol);
      const key = `${startCol}${range.startRow + 1}:${endCol}${range.endRow + 1}`;
      return ranges[key] || [[]];
    },
  });

  return evaluator.evaluate(ast);
}

describe('Formula Calculation Engine', () => {
  describe('Basic Arithmetic Operations', () => {
    it('evaluates addition and subtraction', () => {
      expect(evaluateFormula('=10 + 20')).toBe(30);
      expect(evaluateFormula('=50 - 15')).toBe(35);
      expect(evaluateFormula('=10 + 20 - 5')).toBe(25);
    });

    it('evaluates multiplication and division', () => {
      expect(evaluateFormula('=6 * 7')).toBe(42);
      expect(evaluateFormula('=100 / 4')).toBe(25);
      expect(evaluateFormula('=10 + 2 * 5')).toBe(20); // operator precedence
    });

    it('evaluates exponentiation and modulo', () => {
      expect(evaluateFormula('=2 ^ 3')).toBe(8);
      expect(evaluateFormula('=17 % 5')).toBe(2);
    });

    it('evaluates parentheses', () => {
      expect(evaluateFormula('=(10 + 2) * 5')).toBe(60);
      expect(evaluateFormula('=(2 + 3) * (4 + 1)')).toBe(25);
    });

    it('evaluates unary minus and plus', () => {
      expect(evaluateFormula('=-15 + 20')).toBe(5);
      expect(evaluateFormula('=-(-10)')).toBe(10);
    });

    it('evaluates string concatenation with &', () => {
      expect(evaluateFormula('="Hello " & "World"')).toBe('Hello World');
    });

    it('handles division by zero with #DIV/0!', () => {
      expect(() => evaluateFormula('=10 / 0')).toThrow('#DIV/0!');
    });
  });

  describe('Cell and Range References', () => {
    it('resolves cell references correctly', () => {
      const cells = { A1: 50, B2: 25 };
      expect(evaluateFormula('=A1 + B2', cells)).toBe(75);
    });

    it('resolves absolute references', () => {
      const cells = { A1: 100 };
      expect(evaluateFormula('=$A$1 * 2', cells)).toBe(200);
      expect(evaluateFormula('=A$1 * 3', cells)).toBe(300);
      expect(evaluateFormula('=$A1 * 4', cells)).toBe(400);
    });
  });

  describe('Statistical Functions', () => {
    it('evaluates SUM with numbers and ranges', () => {
      const ranges = {
        'A1:A5': [[10], [20], [30], [40], [50]],
      };
      expect(evaluateFormula('=SUM(A1:A5)', {}, ranges)).toBe(150);
      expect(evaluateFormula('=SUM(5, 10, 15)')).toBe(30);
    });

    it('evaluates AVERAGE', () => {
      const ranges = {
        'A1:A4': [[10], [20], [30], [40]],
      };
      expect(evaluateFormula('=AVERAGE(A1:A4)', {}, ranges)).toBe(25);
    });

    it('evaluates MIN and MAX', () => {
      const ranges = {
        'B1:B5': [[45], [12], [89], [3], [67]],
      };
      expect(evaluateFormula('=MIN(B1:B5)', {}, ranges)).toBe(3);
      expect(evaluateFormula('=MAX(B1:B5)', {}, ranges)).toBe(89);
    });

    it('evaluates COUNT and COUNTA', () => {
      const ranges = {
        'C1:C5': [[10], ['Hello'], [null], [30], ['']],
      };
      expect(evaluateFormula('=COUNT(C1:C5)', {}, ranges)).toBe(2);
      expect(evaluateFormula('=COUNTA(C1:C5)', {}, ranges)).toBe(3);
    });
  });

  describe('Mathematical Functions', () => {
    it('evaluates ROUND', () => {
      expect(evaluateFormula('=ROUND(3.14159, 2)')).toBe(3.14);
      expect(evaluateFormula('=ROUND(125.7, 0)')).toBe(126);
    });

    it('evaluates ABS', () => {
      expect(evaluateFormula('=ABS(-42)')).toBe(42);
      expect(evaluateFormula('=ABS(42)')).toBe(42);
    });

    it('evaluates MOD', () => {
      expect(evaluateFormula('=MOD(10, 3)')).toBe(1);
      expect(evaluateFormula('=MOD(14, 4)')).toBe(2);
    });
  });

  describe('Logical Functions', () => {
    it('evaluates IF conditions', () => {
      expect(evaluateFormula('=IF(10 > 5, "Yes", "No")')).toBe('Yes');
      expect(evaluateFormula('=IF(2 = 3, "Equal", "Not Equal")')).toBe('Not Equal');
    });

    it('evaluates AND, OR, and NOT', () => {
      expect(evaluateFormula('=AND(TRUE, TRUE)')).toBe(true);
      expect(evaluateFormula('=AND(TRUE, FALSE)')).toBe(false);
      expect(evaluateFormula('=OR(FALSE, TRUE)')).toBe(true);
      expect(evaluateFormula('=OR(FALSE, FALSE)')).toBe(false);
      expect(evaluateFormula('=NOT(TRUE)')).toBe(false);
      expect(evaluateFormula('=NOT(FALSE)')).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('throws #NAME? on unknown function', () => {
      expect(() => evaluateFormula('=UNKNOWN_FUNC(10)')).toThrow('#NAME?');
    });

    it('throws #VALUE! on invalid numeric conversion', () => {
      expect(() => evaluateFormula('="Text" * 5')).toThrow('#VALUE!');
    });
  });
});
