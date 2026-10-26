import { WORKBOOK_LIMITS } from './workbookValidation';
import { WorksheetData, cellCoordToKey } from '../types/sheet';

/**
 * RFC 4180 compliant CSV parser
 */
export function parseCSV(csvText: string): string[][] {
  if(new TextEncoder().encode(csvText).length>WORKBOOK_LIMITS.bytes) throw new Error('CSV exceeds 5 MiB.');
  const rows: string[][] = [];
  let count=0;
  // Check size limits while reading each CSV field.
  const field=() => {
    if(currentField.length>32767 || currentRow.length>=WORKBOOK_LIMITS.columns || ++count>WORKBOOK_LIMITS.cells || rows.length>=WORKBOOK_LIMITS.rows) throw new Error('CSV exceeds worksheet limits.');
    currentRow.push(currentField);
  };
  let currentRow: string[] = [];
  let currentField = '';
  let insideQuote = false;
  let i = 0;
  const len = csvText.length;

  while (i < len) {
    const ch = csvText[i];
    const nextCh = i + 1 < len ? csvText[i + 1] : '';

    if (insideQuote) {
      if (ch === '"') {
        if (nextCh === '"') {
          // Escaped quote
          currentField += '"';
          i += 2;
        } else {
          // End of quote
          insideQuote = false;
          i++;
        }
      } else {
        currentField += ch;
        i++;
      }
    } else {
      if (ch === '"') {
        insideQuote = true;
        i++;
      } else if (ch === ',') {
        field();
        currentField = '';
        i++;
      } else if (ch === '\r') {
        if (nextCh === '\n') {
          i++;
        }
        field();
        currentField = '';
        rows.push(currentRow);
        currentRow = [];
        i++;
      } else if (ch === '\n') {
        field();
        currentField = '';
        rows.push(currentRow);
        currentRow = [];
        i++;
      } else {
        currentField += ch;
        i++;
      }
    }
  }

  if(insideQuote) throw new Error('CSV contains an unclosed quoted field.');
  // Push last field and row if any
  if (currentField !== '' || currentRow.length > 0) {
    field();
    rows.push(currentRow);
  }

  return rows;
}

/**
 * Exports a Worksheet to an RFC 4180 CSV string
 */
export function exportSheetToCSV(sheet: WorksheetData): string {
  // Find max row and col with data
  let maxRow = 0;
  let maxCol = 0;

  for (const key of Object.keys(sheet.cells)) {
    const parts = key.split(',');
    const r = parseInt(parts[0] || '0', 10);
    const c = parseInt(parts[1] || '0', 10);
    if (r > maxRow) maxRow = r;
    if (c > maxCol) maxCol = c;
  }

  const lines: string[] = [];

  for (let r = 0; r <= maxRow; r++) {
    const rowFields: string[] = [];
    for (let c = 0; c <= maxCol; c++) {
      const cell = sheet.cells[cellCoordToKey(r, c)];
      let val = '';
      if (cell) {
        if (cell.raw.startsWith('=')) {
          // Export computed value or raw formula? Usually exported value or formula.
          // Standard CSV exports computed value if available, else raw
          val = cell.computed !== undefined && cell.computed !== null ? String(cell.computed) : cell.raw;
        } else {
          val = cell.raw;
        }
      }

      // Escape quotes and wrap in quotes if contains comma, quote, or newline
      if (val.includes('"') || val.includes(',') || val.includes('\n') || val.includes('\r')) {
        const escaped = val.replace(/"/g, '""');
        rowFields.push(`"${escaped}"`);
      } else {
        rowFields.push(val);
      }
    }
    lines.push(rowFields.join(','));
  }

  return lines.join('\r\n');
}

/**
 * Imports CSV text into a WorksheetData object
 */
export function importCSVToSheet(csvText: string, sheetName = 'Imported Sheet'): WorksheetData {
  const parsed = parseCSV(csvText);
  const rowCount = Math.max(parsed.length + 10, 50);
  let maxCol = 26;
  for (const r of parsed) {
    if (r.length > maxCol) maxCol = r.length;
  }
  const colCount = Math.max(maxCol + 5, 26);

  const cells: WorksheetData['cells'] = {};

  for (let r = 0; r < parsed.length; r++) {
    const row = parsed[r] || [];
    for (let c = 0; c < row.length; c++) {
      const val = row[c] || '';
      if (val !== '') {
        const isNum = !isNaN(Number(val));
        cells[cellCoordToKey(r, c)] = {
          raw: val,
          computed: isNum ? Number(val) : val,
        };
      }
    }
  }

  return {
    id: `sheet-${Date.now()}`,
    name: sheetName,
    rowCount,
    colCount,
    cells,
    columnWidths: {},
    rowHeights: {},
    mergedCells: [],
    conditionalFormats: [],
    validations: {},
  };
}
