import { WorksheetData, cellCoordToKey, keyToCellCoord } from '../types/sheet';
import { CellPosition } from '../types/cell';

export interface FindOptions {
  matchCase?: boolean;
  exactMatch?: boolean;
}

/**
 * Finds all cell positions matching the query string
 */
export function findMatches(
  sheet: WorksheetData,
  query: string,
  options: FindOptions = {}
): CellPosition[] {
  if (!query) return [];

  const matches: CellPosition[] = [];
  const queryStr = options.matchCase ? query : query.toLowerCase();

  for (const [key, cell] of Object.entries(sheet.cells)) {
    if (!cell) continue;

    const rawStr = options.matchCase ? cell.raw : cell.raw.toLowerCase();
    const compStr = cell.computed !== undefined && cell.computed !== null
      ? (options.matchCase ? String(cell.computed) : String(cell.computed).toLowerCase())
      : '';

    let isMatch = false;
    if (options.exactMatch) {
      isMatch = rawStr === queryStr || compStr === queryStr;
    } else {
      isMatch = rawStr.includes(queryStr) || compStr.includes(queryStr);
    }

    if (isMatch) {
      matches.push(keyToCellCoord(key));
    }
  }

  // Sort by row, then col
  return matches.sort((a, b) => (a.row === b.row ? a.col - b.col : a.row - b.row));
}

/**
 * Replaces a query string in a single cell
 */
export function replaceMatch(
  sheet: WorksheetData,
  pos: CellPosition,
  query: string,
  replacement: string,
  options: FindOptions = {}
): WorksheetData {
  const key = cellCoordToKey(pos.row, pos.col);
  const cell = sheet.cells[key];
  if (!cell || !cell.raw) return sheet;

  let newRaw = cell.raw;
  if (options.exactMatch) {
    const match = options.matchCase
      ? cell.raw === query
      : cell.raw.toLowerCase() === query.toLowerCase();
    if (match) {
      newRaw = replacement;
    }
  } else {
    const flags = options.matchCase ? 'g' : 'gi';
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    newRaw = cell.raw.replace(new RegExp(escaped, flags), replacement);
  }

  return {
    ...sheet,
    cells: {
      ...sheet.cells,
      [key]: {
        ...cell,
        raw: newRaw,
      },
    },
  };
}

/**
 * Replaces all occurrences across the worksheet
 */
export function replaceAll(
  sheet: WorksheetData,
  query: string,
  replacement: string,
  options: FindOptions = {}
): { updatedSheet: WorksheetData; count: number } {
  const matches = findMatches(sheet, query, options);
  if (matches.length === 0) {
    return { updatedSheet: sheet, count: 0 };
  }

  let current = sheet;
  for (const pos of matches) {
    current = replaceMatch(current, pos, query, replacement, options);
  }

  return {
    updatedSheet: current,
    count: matches.length,
  };
}
