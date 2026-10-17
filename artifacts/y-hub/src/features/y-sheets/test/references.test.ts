import { describe, it, expect } from 'vitest';
import {
  colIndexToLabel,
  colLabelToIndex,
  parseCellReference,
  parseRangeReference,
  shiftFormulaReferences,
  expandRange,
} from '../engine/references';

describe('Spreadsheet References and Coordinates', () => {
  it('converts column index to Excel label', () => {
    expect(colIndexToLabel(0)).toBe('A');
    expect(colIndexToLabel(25)).toBe('Z');
    expect(colIndexToLabel(26)).toBe('AA');
    expect(colIndexToLabel(27)).toBe('AB');
    expect(colIndexToLabel(51)).toBe('AZ');
    expect(colIndexToLabel(52)).toBe('BA');
  });

  it('converts column label to 0-based index', () => {
    expect(colLabelToIndex('A')).toBe(0);
    expect(colLabelToIndex('Z')).toBe(25);
    expect(colLabelToIndex('AA')).toBe(26);
    expect(colLabelToIndex('AB')).toBe(27);
  });

  it('parses cell references with relative and absolute parts', () => {
    const a1 = parseCellReference('A1');
    expect(a1).toEqual({ row: 0, col: 0, rowAbsolute: false, colAbsolute: false, sheetName: undefined });

    const abs = parseCellReference('$B$5');
    expect(abs).toEqual({ row: 4, col: 1, rowAbsolute: true, colAbsolute: true, sheetName: undefined });

    const mixed = parseCellReference('$C10');
    expect(mixed).toEqual({ row: 9, col: 2, rowAbsolute: false, colAbsolute: true, sheetName: undefined });

    const sheetRef = parseCellReference('Sheet1!D12');
    expect(sheetRef).toEqual({ row: 11, col: 3, rowAbsolute: false, colAbsolute: false, sheetName: 'Sheet1' });
  });

  it('parses range references', () => {
    const range = parseRangeReference('A1:C5');
    expect(range?.range).toEqual({
      startRow: 0,
      startCol: 0,
      endRow: 4,
      endCol: 2,
    });
  });

  it('expands ranges to cell coordinates', () => {
    const cells = expandRange({ startRow: 0, startCol: 0, endRow: 1, endCol: 1 });
    expect(cells).toEqual([
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 1, col: 0 },
      { row: 1, col: 1 },
    ]);
  });

  it('shifts formula references correctly when row or column inserted', () => {
    // Relative references shift
    expect(shiftFormulaReferences('=A1 + B1', 1, 0)).toBe('=A2 + B2');
    expect(shiftFormulaReferences('=A1 + B1', 0, 1)).toBe('=B1 + C1');

    // Absolute references do not shift
    expect(shiftFormulaReferences('=$A$1 + B1', 1, 0)).toBe('=$A$1 + B2');
    expect(shiftFormulaReferences('=$A$1 + B1', 0, 1)).toBe('=$A$1 + C1');
  });
});
