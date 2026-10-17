import { describe, expect, it } from 'vitest';
import { createDefaultWorkbook } from '../state/defaultWorkbook';
import { replaceWorkbookContents } from '../io/importIntoCurrentWorkbook';

describe('Import into existing cloud workbook', () => {
  it('preserves the existing cloud workbook ID', () => {
    const current = {
      ...createDefaultWorkbook(),
      id: 'existing-cloud-id',
      name: 'My Workbook',
      version: 5,
    };

    const imported = {
      ...createDefaultWorkbook(),
      id: 'external-file-id',
      name: 'Imported File',
      version: 1,
    };

    const result = replaceWorkbookContents(current, imported);

    expect(result.id).toBe('existing-cloud-id');
    expect(result.name).toBe('My Workbook');
    expect(result.version).toBe(6);
    expect(result.sheets).toEqual(imported.sheets);
  });

  it('does not mutate the source workbooks', () => {
    const current = createDefaultWorkbook();
    const imported = createDefaultWorkbook();

    const originalId = imported.id;
    const originalVersion = current.version;

    replaceWorkbookContents(current, imported);

    expect(imported.id).toBe(originalId);
    expect(current.version).toBe(originalVersion);
  });

  it('rejects a workbook without sheets', () => {
    const current = createDefaultWorkbook();

    const imported = {
      ...createDefaultWorkbook(),
      sheets: [],
    };

    expect(() =>
      replaceWorkbookContents(current, imported)
    ).toThrow();
  });

  it('rejects an invalid active sheet reference', () => {
    const current = createDefaultWorkbook();

    const imported = {
      ...createDefaultWorkbook(),
      activeSheetId: 'missing-sheet',
    };

    expect(() =>
      replaceWorkbookContents(current, imported)
    ).toThrow();
  });
});
