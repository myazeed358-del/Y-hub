import { WorksheetData, cellCoordToKey } from '../types/sheet';
import { CellRange } from '../types/cell';
import { SheetFilter } from '../types/filter';

/**
 * Gets unique string values present in a specific column within the filter range
 */
export function getColumnUniqueValues(
  sheet: WorksheetData,
  col: number,
  range: CellRange,
  hasHeader = true
): string[] {
  const startRow = hasHeader ? range.startRow + 1 : range.startRow;
  const values = new Set<string>();

  for (let r = startRow; r <= range.endRow; r++) {
    const key = cellCoordToKey(r, col);
    const cell = sheet.cells[key];
    const val = cell?.computed !== undefined && cell.computed !== null
      ? String(cell.computed)
      : cell?.raw || '(Blanks)';
    values.add(val.trim() === '' ? '(Blanks)' : val);
  }

  return Array.from(values).sort((a, b) => a.localeCompare(b));
}

/**
 * Applies a sheet filter by computing which rows should be hidden
 */
export function applySheetFilter(sheet: WorksheetData, filter?: SheetFilter): WorksheetData {
  if (!filter || Object.keys(filter.columns).length === 0) {
    return {
      ...sheet,
      filter: undefined,
      hiddenRows: {},
    };
  }

  const hiddenRows: Record<number, boolean> = {};
  const dataStartRow = filter.range.startRow + 1; // Header is first row

  for (let r = dataStartRow; r <= filter.range.endRow; r++) {
    let rowVisible = true;

    for (const [colStr, colFilter] of Object.entries(filter.columns)) {
      if (colFilter.allSelected) continue;

      const col = parseInt(colStr, 10);
      const key = cellCoordToKey(r, col);
      const cell = sheet.cells[key];
      const val = cell?.computed !== undefined && cell.computed !== null
        ? String(cell.computed)
        : cell?.raw || '(Blanks)';
      const normalizedVal = val.trim() === '' ? '(Blanks)' : val;

      if (!colFilter.selectedValues.includes(normalizedVal)) {
        rowVisible = false;
        break;
      }
    }

    if (!rowVisible) {
      hiddenRows[r] = true;
    }
  }

  return {
    ...sheet,
    filter,
    hiddenRows,
  };
}
