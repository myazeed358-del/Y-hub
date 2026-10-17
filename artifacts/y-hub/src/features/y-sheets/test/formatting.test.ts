import { describe, it, expect } from 'vitest';
import { formatCellValue } from '../formatting/numberFormatter';
import { evaluateConditionalRule, applyConditionalFormatting } from '../formatting/conditionalFormatter';
import { ConditionalFormatRule } from '../types/formatting';

describe('Spreadsheet Formatting', () => {
  describe('Number Formatter', () => {
    it('formats plain numbers with decimals', () => {
      expect(formatCellValue(1234.56, { numberFormat: 'number', decimalPlaces: 2 })).toBe('1,234.56');
      expect(formatCellValue(50, { numberFormat: 'number', decimalPlaces: 0 })).toBe('50');
    });

    it('formats currency', () => {
      const formatted = formatCellValue(1234.5, { numberFormat: 'currency', decimalPlaces: 2 });
      expect(formatted).toContain('$1,234.50');
    });

    it('formats percentages', () => {
      expect(formatCellValue(0.255, { numberFormat: 'percentage', decimalPlaces: 1 })).toBe('25.5%');
    });

    it('preserves error strings without alteration', () => {
      expect(formatCellValue('#DIV/0!')).toBe('#DIV/0!');
      expect(formatCellValue('#VALUE!')).toBe('#VALUE!');
    });
  });

  describe('Conditional Formatting', () => {
    const rule: ConditionalFormatRule = {
      id: 'r1',
      range: { startRow: 0, startCol: 0, endRow: 5, endCol: 5 },
      type: 'greaterThan',
      value1: 100,
      style: { backgroundColor: '#dcfce7', bold: true },
    };

    it('matches greaterThan condition', () => {
      expect(evaluateConditionalRule(150, rule)).toBe(true);
      expect(evaluateConditionalRule(80, rule)).toBe(false);
    });

    it('applies style override when rule matches', () => {
      const baseStyle = { textColor: '#000000' };
      const applied = applyConditionalFormatting(1, 1, 150, baseStyle, [rule]);
      expect(applied.backgroundColor).toBe('#dcfce7');
      expect(applied.bold).toBe(true);
      expect(applied.textColor).toBe('#000000');
    });
  });
});
