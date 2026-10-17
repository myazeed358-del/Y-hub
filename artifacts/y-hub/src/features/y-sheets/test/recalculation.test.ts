import { describe, it, expect } from 'vitest';
import { RecalculationEngine } from '../engine/recalculationEngine';
import { WorkbookData } from '../types/workbook';
import { cellCoordToKey } from '../types/sheet';

describe('Spreadsheet Recalculation and Dependency Tracking', () => {
  const engine = new RecalculationEngine();

  it('recalculates dependent cells automatically', () => {
    const wb: WorkbookData = {
      id: 'test-wb',
      name: 'Test',
      sheets: [
        {
          id: 's1',
          name: 'Sheet1',
          rowCount: 10,
          colCount: 10,
          cells: {
            [cellCoordToKey(0, 0)]: { raw: '10' }, // A1
            [cellCoordToKey(0, 1)]: { raw: '20' }, // B1
            [cellCoordToKey(0, 2)]: { raw: '=A1 + B1' }, // C1
            [cellCoordToKey(0, 3)]: { raw: '=C1 * 2' }, // D1
          },
          columnWidths: {},
          rowHeights: {},
          mergedCells: [],
          conditionalFormats: [],
          validations: {},
        },
      ],
      activeSheetId: 's1',
      version: 1,
    };

    const evaluated = engine.recalculateWorkbook(wb);
    const sheet = evaluated.sheets[0]!;

    expect(sheet.cells[cellCoordToKey(0, 0)]?.computed).toBe(10);
    expect(sheet.cells[cellCoordToKey(0, 1)]?.computed).toBe(20);
    expect(sheet.cells[cellCoordToKey(0, 2)]?.computed).toBe(30); // C1 = 10 + 20
    expect(sheet.cells[cellCoordToKey(0, 3)]?.computed).toBe(60); // D1 = 30 * 2
  });

  it('detects direct circular references and marks #CIRCULAR!', () => {
    const wb: WorkbookData = {
      id: 'test-wb',
      name: 'Test',
      sheets: [
        {
          id: 's1',
          name: 'Sheet1',
          rowCount: 10,
          colCount: 10,
          cells: {
            [cellCoordToKey(0, 0)]: { raw: '=B1' }, // A1 = B1
            [cellCoordToKey(0, 1)]: { raw: '=A1' }, // B1 = A1
          },
          columnWidths: {},
          rowHeights: {},
          mergedCells: [],
          conditionalFormats: [],
          validations: {},
        },
      ],
      activeSheetId: 's1',
      version: 1,
    };

    const evaluated = engine.recalculateWorkbook(wb);
    const sheet = evaluated.sheets[0]!;

    expect(sheet.cells[cellCoordToKey(0, 0)]?.error).toBe('#CIRCULAR!');
    expect(sheet.cells[cellCoordToKey(0, 1)]?.error).toBe('#CIRCULAR!');
  });

  it('detects indirect 3-cell circular references', () => {
    const wb: WorkbookData = {
      id: 'test-wb',
      name: 'Test',
      sheets: [
        {
          id: 's1',
          name: 'Sheet1',
          rowCount: 10,
          colCount: 10,
          cells: {
            [cellCoordToKey(0, 0)]: { raw: '=B1' }, // A1 = B1
            [cellCoordToKey(0, 1)]: { raw: '=C1' }, // B1 = C1
            [cellCoordToKey(0, 2)]: { raw: '=A1 + 5' }, // C1 = A1 + 5
          },
          columnWidths: {},
          rowHeights: {},
          mergedCells: [],
          conditionalFormats: [],
          validations: {},
        },
      ],
      activeSheetId: 's1',
      version: 1,
    };

    const evaluated = engine.recalculateWorkbook(wb);
    const sheet = evaluated.sheets[0]!;

    expect(sheet.cells[cellCoordToKey(0, 0)]?.error).toBe('#CIRCULAR!');
    expect(sheet.cells[cellCoordToKey(0, 1)]?.error).toBe('#CIRCULAR!');
    expect(sheet.cells[cellCoordToKey(0, 2)]?.error).toBe('#CIRCULAR!');
  });
});
