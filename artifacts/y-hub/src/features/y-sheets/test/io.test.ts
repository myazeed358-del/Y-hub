import { describe, it, expect } from 'vitest';
import { parseCSV, exportSheetToCSV, importCSVToSheet } from '../io/csvAdapter';
import { WorksheetData, cellCoordToKey } from '../types/sheet';

describe('CSV & File Import/Export', () => {
  it('parses standard comma-separated lines', () => {
    const csv = 'Name,Age,Role\nAlice,20,Student\nBob,22,Researcher';
    const parsed = parseCSV(csv);
    expect(parsed).toEqual([
      ['Name', 'Age', 'Role'],
      ['Alice', '20', 'Student'],
      ['Bob', '22', 'Researcher'],
    ]);
  });

  it('handles quotes containing commas and escaped quotes per RFC 4180', () => {
    const csv = 'Title,Description\n"CS 101","Intro to Programming, Algorithms"\n"Quote","He said ""Hello!"""';
    const parsed = parseCSV(csv);
    expect(parsed[1]![1]).toBe('Intro to Programming, Algorithms');
    expect(parsed[2]![1]).toBe('He said "Hello!"');
  });

  it('exports and re-imports worksheet data without loss', () => {
    const sheet: WorksheetData = {
      id: 's1',
      name: 'TestSheet',
      rowCount: 10,
      colCount: 10,
      cells: {
        [cellCoordToKey(0, 0)]: { raw: 'Item' },
        [cellCoordToKey(0, 1)]: { raw: 'Cost' },
        [cellCoordToKey(1, 0)]: { raw: 'Book' },
        [cellCoordToKey(1, 1)]: { raw: '45.50', computed: 45.5 },
      },
      columnWidths: {},
      rowHeights: {},
      mergedCells: [],
      conditionalFormats: [],
      validations: {},
    };

    const exported = exportSheetToCSV(sheet);
    expect(exported).toContain('Item,Cost');
    expect(exported).toContain('Book,45.5');

    const reimported = importCSVToSheet(exported, 'Imported');
    expect(reimported.cells[cellCoordToKey(0, 0)]?.raw).toBe('Item');
    expect(reimported.cells[cellCoordToKey(1, 1)]?.raw).toBe('45.50');
  });
});
