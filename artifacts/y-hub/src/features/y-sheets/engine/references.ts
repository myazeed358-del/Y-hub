import { CellPosition, CellRange } from '../types/cell';

/**
 * Converts a 0-based column index to an Excel column label (e.g. 0 -> "A", 25 -> "Z", 26 -> "AA")
 */
export function colIndexToLabel(col: number): string {
  if (col < 0) return '';
  let label = '';
  let c = col;
  while (c >= 0) {
    label = String.fromCharCode((c % 26) + 65) + label;
    c = Math.floor(c / 26) - 1;
  }
  return label;
}

/**
 * Converts an Excel column label to a 0-based column index (e.g. "A" -> 0, "Z" -> 25, "AA" -> 26)
 */
export function colLabelToIndex(label: string): number {
  const clean = label.toUpperCase().trim();
  let index = 0;
  for (let i = 0; i < clean.length; i++) {
    index = index * 26 + (clean.charCodeAt(i) - 64);
  }
  return index - 1;
}

export interface ParsedCellReference {
  row: number; // 0-based
  col: number; // 0-based
  rowAbsolute: boolean;
  colAbsolute: boolean;
  sheetName?: string;
}

const CELL_REF_REGEX = /^(?:(?:'([^']+)'|([A-Za-z0-9_]+))!)?(\$?)([A-Za-z]+)(\$?)([1-9][0-9]*)$/;

/**
 * Parses a cell reference like "A1", "$B$2", "Sheet1!C3", "'My Sheet'!$D5"
 */
export function parseCellReference(ref: string): ParsedCellReference | null {
  const match = ref.trim().match(CELL_REF_REGEX);
  if (!match) return null;

  const sheetName = match[1] || match[2];
  const colAbsolute = match[3] === '$';
  const colLabel = match[4] || '';
  const rowAbsolute = match[5] === '$';
  const rowNumber = parseInt(match[6] || '0', 10);

  const col = colLabelToIndex(colLabel);
  const row = rowNumber - 1; // 0-based

  if (row < 0 || col < 0) return null;

  return {
    row,
    col,
    rowAbsolute,
    colAbsolute,
    sheetName,
  };
}

/**
 * Formats coordinates into an Excel cell string (e.g. (0,0) -> "A1", with absolutes "$A$1")
 */
export function formatCellReference(
  row: number,
  col: number,
  rowAbsolute = false,
  colAbsolute = false,
  sheetName?: string
): string {
  const colPart = (colAbsolute ? '$' : '') + colIndexToLabel(col);
  const rowPart = (rowAbsolute ? '$' : '') + (row + 1);
  const cellRef = `${colPart}${rowPart}`;

  if (!sheetName) return cellRef;
  const quote = sheetName.includes(' ') || !/^[A-Za-z0-9_]+$/.test(sheetName);
  return quote ? `'${sheetName}'!${cellRef}` : `${sheetName}!${cellRef}`;
}

const RANGE_REF_REGEX = /^(?:(?:'([^']+)'|([A-Za-z0-9_]+))!)?(\$?)([A-Za-z]+)(\$?)([1-9][0-9]*):(\$?)([A-Za-z]+)(\$?)([1-9][0-9]*)$/;

export interface ParsedRangeReference {
  range: CellRange;
  startRowAbsolute: boolean;
  startColAbsolute: boolean;
  endRowAbsolute: boolean;
  endColAbsolute: boolean;
  sheetName?: string;
}

/**
 * Parses a range reference like "A1:B10", "$A$1:$C$5", "Sheet1!A1:B2"
 */
export function parseRangeReference(ref: string): ParsedRangeReference | null {
  const match = ref.trim().match(RANGE_REF_REGEX);
  if (!match) return null;

  const sheetName = match[1] || match[2];
  const startColAbs = match[3] === '$';
  const startColLabel = match[4] || '';
  const startRowAbs = match[5] === '$';
  const startRowNum = parseInt(match[6] || '0', 10);

  const endColAbs = match[7] === '$';
  const endColLabel = match[8] || '';
  const endRowAbs = match[9] === '$';
  const endRowNum = parseInt(match[10] || '0', 10);

  const startCol = colLabelToIndex(startColLabel);
  const startRow = startRowNum - 1;
  const endCol = colLabelToIndex(endColLabel);
  const endRow = endRowNum - 1;

  if (startCol < 0 || startRow < 0 || endCol < 0 || endRow < 0) return null;

  return {
    range: {
      startRow: Math.min(startRow, endRow),
      startCol: Math.min(startCol, endCol),
      endRow: Math.max(startRow, endRow),
      endCol: Math.max(startCol, endCol),
    },
    startRowAbsolute: startRowAbs,
    startColAbsolute: startColAbs,
    endRowAbsolute: endRowAbs,
    endColAbsolute: endColAbs,
    sheetName,
  };
}

/**
 * Formats a range into string, e.g. "A1:C10"
 */
export function formatRangeReference(range: CellRange, sheetName?: string): string {
  const start = formatCellReference(range.startRow, range.startCol);
  const end = formatCellReference(range.endRow, range.endCol);
  const res = `${start}:${end}`;
  if (!sheetName) return res;
  const quote = sheetName.includes(' ') || !/^[A-Za-z0-9_]+$/.test(sheetName);
  return quote ? `'${sheetName}'!${res}` : `${sheetName}!${res}`;
}

/**
 * Expands a range into an array of cell positions
 */
export function expandRange(range: CellRange): CellPosition[] {
  const positions: CellPosition[] = [];
  const minRow = Math.min(range.startRow, range.endRow);
  const maxRow = Math.max(range.startRow, range.endRow);
  const minCol = Math.min(range.startCol, range.endCol);
  const maxCol = Math.max(range.startCol, range.endCol);

  for (let r = minRow; r <= maxRow; r++) {
    for (let c = minCol; c <= maxCol; c++) {
      positions.push({ row: r, col: c });
    }
  }
  return positions;
}

/**
 * Shifts formula references by deltaRow and deltaCol, respecting absolute ($) references
 */
export function shiftFormulaReferences(formula: string, deltaRow: number, deltaCol: number): string {
  if (!formula.startsWith('=')) return formula;

  // Replace cell references
  const tokenRegex = /('(?:[^']*)'!|[A-Za-z0-9_]+!)?(\$?)([A-Za-z]+)(\$?)([1-9][0-9]*)/g;

  return formula.replace(tokenRegex, (_match, sheet, colDollar, colLabel, rowDollar, rowNumStr) => {
    // If it's preceded by a letter or part of a function name, we need to check boundary
    const isColAbs = colDollar === '$';
    const isRowAbs = rowDollar === '$';

    let col = colLabelToIndex(colLabel);
    let row = parseInt(rowNumStr, 10) - 1;

    if (!isColAbs) col += deltaCol;
    if (!isRowAbs) row += deltaRow;

    if (row < 0 || col < 0) return '#REF!';

    const prefix = sheet || '';
    const newColStr = (isColAbs ? '$' : '') + colIndexToLabel(col);
    const newRowStr = (isRowAbs ? '$' : '') + (row + 1);

    return `${prefix}${newColStr}${newRowStr}`;
  });
}
