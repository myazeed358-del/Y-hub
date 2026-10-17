import * as XLSX from 'xlsx';
import { WorkbookData } from '../types/workbook';
import { WorksheetData, cellCoordToKey } from '../types/sheet';
import { colIndexToLabel, colLabelToIndex } from '../engine/references';

/**
 * Exports a multi-sheet WorkbookData to an XLSX file in browser or Node
 */
export function exportWorkbookToXLSX(workbook: WorkbookData, filename = 'Workbook.xlsx'): void {
  const wb = XLSX.utils.book_new();

  for (const sheet of workbook.sheets) {
    const ws: XLSX.WorkSheet = {};
    let maxRow = 0;
    let maxCol = 0;

    for (const [key, cell] of Object.entries(sheet.cells)) {
      if (!cell || (cell.raw === '' && cell.computed === undefined)) continue;
      const [rStr, cStr] = key.split(',');
      const r = parseInt(rStr || '0', 10);
      const c = parseInt(cStr || '0', 10);

      if (r > maxRow) maxRow = r;
      if (c > maxCol) maxCol = c;

      const cellRef = `${colIndexToLabel(c)}${r + 1}`;
      const cellObj: XLSX.CellObject = { v: '', t: 's' };

      if (cell.raw.startsWith('=')) {
        // Formula
        cellObj.f = cell.raw.slice(1);
        if (cell.computed !== undefined && cell.computed !== null) {
          if (typeof cell.computed === 'number') {
            cellObj.v = cell.computed;
            cellObj.t = 'n';
          } else if (typeof cell.computed === 'boolean') {
            cellObj.v = cell.computed;
            cellObj.t = 'b';
          } else {
            cellObj.v = String(cell.computed);
            cellObj.t = 's';
          }
        }
      } else {
        const num = Number(cell.raw);
        if (!isNaN(num) && cell.raw.trim() !== '') {
          cellObj.v = num;
          cellObj.t = 'n';
        } else if (cell.raw.toUpperCase() === 'TRUE') {
          cellObj.v = true;
          cellObj.t = 'b';
        } else if (cell.raw.toUpperCase() === 'FALSE') {
          cellObj.v = false;
          cellObj.t = 'b';
        } else {
          cellObj.v = cell.raw;
          cellObj.t = 's';
        }
      }

      ws[cellRef] = cellObj;
    }

    // Set sheet bounds
    ws['!ref'] = `A1:${colIndexToLabel(maxCol)}${maxRow + 1}`;

    // Merged regions
    if (sheet.mergedCells && sheet.mergedCells.length > 0) {
      ws['!merges'] = sheet.mergedCells.map((m) => ({
        s: { r: m.startRow, c: m.startCol },
        e: { r: m.endRow, c: m.endCol },
      }));
    }

    XLSX.utils.book_append_sheet(wb, ws, sheet.name);
  }

  XLSX.writeFile(wb, filename);
}

/**
 * Imports an XLSX file buffer into a WorkbookData object
 */
export function importWorkbookFromXLSX(data: ArrayBuffer | Uint8Array): WorkbookData {
  const wb = XLSX.read(data, { type: 'array', cellFormula: true, cellStyles: true });
  const sheets: WorksheetData[] = [];

  for (let sIdx = 0; sIdx < wb.SheetNames.length; sIdx++) {
    const sheetName = wb.SheetNames[sIdx] || `Sheet${sIdx + 1}`;
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;

    const cells: WorksheetData['cells'] = {};
    let maxRow = 50;
    let maxCol = 26;

    for (const [cellRef, cellObj] of Object.entries(ws)) {
      if (cellRef.startsWith('!')) continue;

      // Parse cellRef like "A1"
      const match = cellRef.match(/^([A-Za-z]+)([1-9][0-9]*)$/);
      if (!match) continue;

      const colLabel = match[1] || 'A';
      const rowNum = parseInt(match[2] || '1', 10);
      const col = colLabelToIndex(colLabel);
      const row = rowNum - 1;

      if (row > maxRow) maxRow = row + 10;
      if (col > maxCol) maxCol = col + 5;

      const cObj = cellObj as XLSX.CellObject;
      let raw = '';
      let computed = cObj.v !== undefined ? cObj.v : '';

      if (cObj.f) {
        raw = `=${cObj.f}`;
      } else if (cObj.v !== undefined && cObj.v !== null) {
        raw = String(cObj.v);
      }

      cells[cellCoordToKey(row, col)] = {
        raw,
        computed: computed as string | number | boolean | null,
      };
    }

    // Merged cells
    const mergedCells: WorksheetData['mergedCells'] = [];
    if (ws['!merges']) {
      for (let i = 0; i < ws['!merges'].length; i++) {
        const m = ws['!merges'][i];
        if (m) {
          mergedCells.push({
            id: `merge-${i}`,
            startRow: m.s.r,
            startCol: m.s.c,
            endRow: m.e.r,
            endCol: m.e.c,
          });
        }
      }
    }

    sheets.push({
      id: `sheet-${sIdx}-${Date.now()}`,
      name: sheetName,
      rowCount: Math.max(maxRow, 50),
      colCount: Math.max(maxCol, 26),
      cells,
      columnWidths: {},
      rowHeights: {},
      mergedCells,
      conditionalFormats: [],
      validations: {},
    });
  }

  const firstSheetId = sheets[0]?.id || 'sheet-1';

  return {
    id: `workbook-${Date.now()}`,
    name: 'Imported Workbook',
    sheets,
    activeSheetId: firstSheetId,
    version: 1,
  };
}
