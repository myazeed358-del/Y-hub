import { CellStyle, CellValue } from '../types/cell';
import { ConditionalFormatRule } from '../types/formatting';

/**
 * Checks if a cell position falls within a rule range
 */
export function isPositionInRange(
  row: number,
  col: number,
  range: { startRow: number; startCol: number; endRow: number; endCol: number }
): boolean {
  const minRow = Math.min(range.startRow, range.endRow);
  const maxRow = Math.max(range.startRow, range.endRow);
  const minCol = Math.min(range.startCol, range.endCol);
  const maxCol = Math.max(range.startCol, range.endCol);

  return row >= minRow && row <= maxRow && col >= minCol && col <= maxCol;
}

/**
 * Evaluates whether a conditional formatting rule matches the cell value
 */
export function evaluateConditionalRule(value: CellValue, rule: ConditionalFormatRule): boolean {
  if (value === null || value === undefined) return false;

  const numVal = typeof value === 'number' ? value : Number(value);
  const isNumeric = !isNaN(numVal) && typeof value !== 'boolean';
  const strVal = String(value);

  switch (rule.type) {
    case 'greaterThan': {
      if (!isNumeric) return false;
      const target = Number(rule.value1);
      return !isNaN(target) && numVal > target;
    }

    case 'lessThan': {
      if (!isNumeric) return false;
      const target = Number(rule.value1);
      return !isNaN(target) && numVal < target;
    }

    case 'equalTo': {
      if (isNumeric && !isNaN(Number(rule.value1))) {
        return numVal === Number(rule.value1);
      }
      return strVal.toLowerCase() === String(rule.value1).toLowerCase();
    }

    case 'between': {
      if (!isNumeric) return false;
      const min = Math.min(Number(rule.value1), Number(rule.value2 ?? rule.value1));
      const max = Math.max(Number(rule.value1), Number(rule.value2 ?? rule.value1));
      return numVal >= min && numVal <= max;
    }

    case 'textContains': {
      const search = String(rule.value1).toLowerCase();
      return strVal.toLowerCase().includes(search);
    }

    default:
      return false;
  }
}

/**
 * Applies active conditional format rules to a cell and returns the combined style
 */
export function applyConditionalFormatting(
  row: number,
  col: number,
  value: CellValue,
  baseStyle?: CellStyle,
  rules: ConditionalFormatRule[] = []
): CellStyle {
  let combinedStyle: CellStyle = { ...(baseStyle || {}) };

  for (const rule of rules) {
    if (isPositionInRange(row, col, rule.range)) {
      if (evaluateConditionalRule(value, rule)) {
        combinedStyle = {
          ...combinedStyle,
          ...rule.style,
        };
      }
    }
  }

  return combinedStyle;
}
