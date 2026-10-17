import { WorksheetData, cellCoordToKey } from '../types/sheet';
import { CellRange, CellData } from '../types/cell';
import { SortDirection } from '../types/filter';

/**
 * Sorts rows within a range by a specific column
 */
export function sortRange(
  sheet: WorksheetData,
  range: CellRange,
  sortCol: number,
  direction: SortDirection = 'asc',
  hasHeader = false
): WorksheetData {
  const startRow = hasHeader ? range.startRow + 1 : range.startRow;
  const endRow = range.endRow;

  if (startRow >= endRow) return sheet;

  // Extract row slices
  interface RowData {
    originalRow: number;
    cells: Map<number, CellData | undefined>;
    sortValue: string | number;
  }

  const rows: RowData[] = [];

  for (let r = startRow; r <= endRow; r++) {
    const rowCells = new Map<number, CellData | undefined>();
    for (let c = range.startCol; c <= range.endCol; c++) {
      const key = cellCoordToKey(r, c);
      rowCells.set(c, sheet.cells[key]);
    }

    const sortCell = rowCells.get(sortCol);
    let val: string | number = '';
    if (sortCell) {
      if (typeof sortCell.computed === 'number') {
        val = sortCell.computed;
      } else if (typeof sortCell.computed === 'string') {
        const num = Number(sortCell.computed);
        val = !isNaN(num) && sortCell.computed.trim() !== '' ? num : sortCell.computed.toLowerCase();
      } else if (sortCell.raw) {
        const num = Number(sortCell.raw);
        val = !isNaN(num) && sortCell.raw.trim() !== '' ? num : sortCell.raw.toLowerCase();
      }
    }

    rows.push({
      originalRow: r,
      cells: rowCells,
      sortValue: val,
    });
  }

  // Sort rows
  rows.sort((a, b) => {
    const valA = a.sortValue;
    const valB = b.sortValue;

    // Put empty values at the end
    if (valA === '' && valB !== '') return 1;
    if (valA !== '' && valB === '') return -1;
    if (valA === '' && valB === '') return 0;

    if (typeof valA === 'number' && typeof valB === 'number') {
      return direction === 'asc' ? valA - valB : valB - valA;
    }

    const strA = String(valA);
    const strB = String(valB);
    return direction === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
  });

  // Re-assign sorted cell data back to the sheet
  const newCells = { ...sheet.cells };

  for (let i = 0; i < rows.length; i++) {
    const targetRow = startRow + i;
    const sortedRow = rows[i]!;

    for (let c = range.startCol; c <= range.endCol; c++) {
      const targetKey = cellCoordToKey(targetRow, c);
      const cellData = sortedRow.cells.get(c);
      if (cellData) {
        newCells[targetKey] = cellData;
      } else {
        delete newCells[targetKey];
      }
    }
  }

  return {
    ...sheet,
    cells: newCells,
  };
}
