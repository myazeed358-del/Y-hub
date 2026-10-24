import { WorkbookData } from '../types/workbook';
import { WorksheetData, cellCoordToKey, keyToCellCoord } from '../types/sheet';
import { MergedRegion } from '../types/cell';
import { WorkbookAction } from './workbookActions';
import { recalculationEngine } from '../engine/recalculationEngine';
import { shiftFormulaReferences } from '../engine/references';
import { sortRange } from '../data/sort';
import { applySheetFilter } from '../data/filter';

export function workbookReducer(state: WorkbookData, action: WorkbookAction): WorkbookData {
  switch (action.type) {
    case 'SET_WORKBOOK': {
      return recalculationEngine.recalculateWorkbook(action.payload);
    }

    case 'SET_WORKBOOK_NAME': {
      return {
        ...state,
        name: action.payload,
        version: state.version + 1,
      };
    }

    case 'SET_ACTIVE_SHEET': {
      if (state.activeSheetId === action.payload) return state;
      return {
        ...state,
        activeSheetId: action.payload,
      };
    }

    case 'ADD_SHEET': {
      const newIndex = state.sheets.length + 1;
      const sheetName = action.payload?.name || `Sheet${newIndex}`;
      const newSheetId = `sheet-${Date.now()}`;
      const newSheet: WorksheetData = {
        id: newSheetId,
        name: sheetName,
        rowCount: 50,
        colCount: 26,
        cells: {},
        columnWidths: {},
        rowHeights: {},
        mergedCells: [],
        conditionalFormats: [],
        validations: {},
      };
      return {
        ...state,
        sheets: [...state.sheets, newSheet],
        activeSheetId: newSheetId,
        version: state.version + 1,
      };
    }

    case 'DELETE_SHEET': {
      if (state.sheets.length <= 1) return state; // Must keep at least one sheet
      const filtered = state.sheets.filter((s) => s.id !== action.payload);
      let newActiveId = state.activeSheetId;
      if (state.activeSheetId === action.payload) {
        newActiveId = filtered[0]?.id || '';
      }
      return {
        ...state,
        sheets: filtered,
        activeSheetId: newActiveId,
        version: state.version + 1,
      };
    }

    case 'RENAME_SHEET': {
      const { sheetId, newName } = action.payload;
      const cleanName = newName.trim();
      if (!cleanName) return state;
      // Ensure name is unique
      const nameExists = state.sheets.some((s) => s.id !== sheetId && s.name.toLowerCase() === cleanName.toLowerCase());
      if (nameExists) return state;

      return {
        ...state,
        sheets: state.sheets.map((s) => (s.id === sheetId ? { ...s, name: cleanName } : s)),
        version: state.version + 1,
      };
    }

    case 'REORDER_SHEETS': {
      const { fromIndex, toIndex } = action.payload;
      if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= state.sheets.length || toIndex >= state.sheets.length) {
        return state;
      }
      const reordered = [...state.sheets];
      const [moved] = reordered.splice(fromIndex, 1);
      if (moved) {
        reordered.splice(toIndex, 0, moved);
      }
      return {
        ...state,
        sheets: reordered,
        version: state.version + 1,
      };
    }

    case 'SET_CELL_RAW': {
      const { sheetId, row, col, raw } = action.payload;
      const key = cellCoordToKey(row, col);

      const nextSheets = state.sheets.map((sheet) => {
        if (sheet.id !== sheetId) return sheet;
        const currentCell = sheet.cells[key] || { raw: '' };
        const updatedCells = { ...sheet.cells };

        if (raw === '') {
          delete updatedCells[key];
        } else {
          updatedCells[key] = {
            ...currentCell,
            raw,
          };
        }

        return {
          ...sheet,
          cells: updatedCells,
        };
      });

      const nextWorkbook: WorkbookData = {
        ...state,
        sheets: nextSheets,
        version: state.version + 1,
      };

      return recalculationEngine.recalculateWorkbook(nextWorkbook);
    }

    case 'SET_CELLS_BATCH': {
      const { sheetId, updates, clearSource } = action.payload;
      const nextSheets = state.sheets.map((sheet) => {
        if (sheet.id !== sheetId && sheet.id !== clearSource?.sheetId) return sheet;
        const updatedCells = { ...sheet.cells };

        // Clear captured source values first, then write the destination. This is
        // one history/save transaction, including overlapping or cross-sheet cuts.
        if (sheet.id === clearSource?.sheetId) {
          for (const cell of clearSource.cells) {
            const key = cellCoordToKey(cell.row, cell.col);
            if ((updatedCells[key]?.raw ?? '') === cell.raw) delete updatedCells[key];
          }
        }
        for (const u of sheet.id === sheetId ? updates : []) {
          const key = cellCoordToKey(u.row, u.col);
          const current = sheet.cells[key] || { raw: '' };
          if (u.raw === '') {
            delete updatedCells[key];
          } else {
            updatedCells[key] = {
              ...current,
              raw: u.raw,
            };
          }
        }

        return {
          ...sheet,
          cells: updatedCells,
        };
      });

      const nextWorkbook: WorkbookData = {
        ...state,
        sheets: nextSheets,
        version: state.version + 1,
      };

      return recalculationEngine.recalculateWorkbook(nextWorkbook);
    }

    case 'FORMAT_CELLS': {
      const { sheetId, range, style } = action.payload;
      const minRow = Math.min(range.startRow, range.endRow);
      const maxRow = Math.max(range.startRow, range.endRow);
      const minCol = Math.min(range.startCol, range.endCol);
      const maxCol = Math.max(range.startCol, range.endCol);

      const nextSheets = state.sheets.map((sheet) => {
        if (sheet.id !== sheetId) return sheet;
        const updatedCells = { ...sheet.cells };

        for (let r = minRow; r <= maxRow; r++) {
          for (let c = minCol; c <= maxCol; c++) {
            const key = cellCoordToKey(r, c);
            const current = updatedCells[key] || { raw: '' };
            updatedCells[key] = {
              ...current,
              style: {
                ...(current.style || {}),
                ...style,
              },
            };
          }
        }

        return {
          ...sheet,
          cells: updatedCells,
        };
      });

      return {
        ...state,
        sheets: nextSheets,
        version: state.version + 1,
      };
    }

    case 'SET_CELL_VALIDATION': {
      const { sheetId, row, col, rule } = action.payload;
      const key = cellCoordToKey(row, col);
      return {
        ...state,
        sheets: state.sheets.map((sheet) => {
          if (sheet.id !== sheetId) return sheet;
          return {
            ...sheet,
            validations: {
              ...sheet.validations,
              [key]: rule,
            },
          };
        }),
        version: state.version + 1,
      };
    }

    case 'REMOVE_CELL_VALIDATION': {
      const { sheetId, row, col } = action.payload;
      const key = cellCoordToKey(row, col);
      return {
        ...state,
        sheets: state.sheets.map((sheet) => {
          if (sheet.id !== sheetId) return sheet;
          const nextVal = { ...sheet.validations };
          delete nextVal[key];
          return {
            ...sheet,
            validations: nextVal,
          };
        }),
        version: state.version + 1,
      };
    }

    case 'ADD_CONDITIONAL_FORMAT': {
      const { sheetId, rule } = action.payload;
      return {
        ...state,
        sheets: state.sheets.map((sheet) => {
          if (sheet.id !== sheetId) return sheet;
          return {
            ...sheet,
            conditionalFormats: [...sheet.conditionalFormats, rule],
          };
        }),
        version: state.version + 1,
      };
    }

    case 'REMOVE_CONDITIONAL_FORMAT': {
      const { sheetId, ruleId } = action.payload;
      return {
        ...state,
        sheets: state.sheets.map((sheet) => {
          if (sheet.id !== sheetId) return sheet;
          return {
            ...sheet,
            conditionalFormats: sheet.conditionalFormats.filter((r) => r.id !== ruleId),
          };
        }),
        version: state.version + 1,
      };
    }

    case 'MERGE_CELLS': {
      const { sheetId, range } = action.payload;
      const minRow = Math.min(range.startRow, range.endRow);
      const maxRow = Math.max(range.startRow, range.endRow);
      const minCol = Math.min(range.startCol, range.endCol);
      const maxCol = Math.max(range.startCol, range.endCol);

      if (minRow === maxRow && minCol === maxCol) return state; // Can't merge single cell

      const newMerge: MergedRegion = {
        id: `merge-${Date.now()}`,
        startRow: minRow,
        startCol: minCol,
        endRow: maxRow,
        endCol: maxCol,
      };

      return {
        ...state,
        sheets: state.sheets.map((sheet) => {
          if (sheet.id !== sheetId) return sheet;
          // Remove overlapping existing merges
          const remaining = sheet.mergedCells.filter(
            (m) => !(m.startRow <= maxRow && m.endRow >= minRow && m.startCol <= maxCol && m.endCol >= minCol)
          );
          return {
            ...sheet,
            mergedCells: [...remaining, newMerge],
          };
        }),
        version: state.version + 1,
      };
    }

    case 'UNMERGE_CELLS': {
      const { sheetId, range } = action.payload;
      const minRow = Math.min(range.startRow, range.endRow);
      const maxRow = Math.max(range.startRow, range.endRow);
      const minCol = Math.min(range.startCol, range.endCol);
      const maxCol = Math.max(range.startCol, range.endCol);

      return {
        ...state,
        sheets: state.sheets.map((sheet) => {
          if (sheet.id !== sheetId) return sheet;
          const remaining = sheet.mergedCells.filter(
            (m) => !(m.startRow <= maxRow && m.endRow >= minRow && m.startCol <= maxCol && m.endCol >= minCol)
          );
          return {
            ...sheet,
            mergedCells: remaining,
          };
        }),
        version: state.version + 1,
      };
    }

    case 'INSERT_ROW': {
      const { sheetId, row, before } = action.payload;
      const insertAt = before ? row : row + 1;

      const nextSheets = state.sheets.map((sheet) => {
        if (sheet.id !== sheetId) return sheet;
        const newCells: WorksheetData['cells'] = {};

        for (const [key, cell] of Object.entries(sheet.cells)) {
          const coord = keyToCellCoord(key);
          if (coord.row >= insertAt) {
            // Shift down
            const newKey = cellCoordToKey(coord.row + 1, coord.col);
            const shiftedRaw = cell.raw.startsWith('=')
              ? shiftFormulaReferences(cell.raw, 1, 0)
              : cell.raw;
            newCells[newKey] = { ...cell, raw: shiftedRaw };
          } else {
            newCells[key] = cell;
          }
        }

        // Shift row heights
        const newRowHeights: Record<number, number> = {};
        for (const [rStr, h] of Object.entries(sheet.rowHeights)) {
          const r = parseInt(rStr, 10);
          if (r >= insertAt) {
            newRowHeights[r + 1] = h;
          } else {
            newRowHeights[r] = h;
          }
        }

        return {
          ...sheet,
          rowCount: sheet.rowCount + 1,
          cells: newCells,
          rowHeights: newRowHeights,
        };
      });

      const nextWb = {
        ...state,
        sheets: nextSheets,
        version: state.version + 1,
      };
      return recalculationEngine.recalculateWorkbook(nextWb);
    }

    case 'DELETE_ROW': {
      const { sheetId, row } = action.payload;

      const nextSheets = state.sheets.map((sheet) => {
        if (sheet.id !== sheetId || sheet.rowCount <= 1) return sheet;
        const newCells: WorksheetData['cells'] = {};

        for (const [key, cell] of Object.entries(sheet.cells)) {
          const coord = keyToCellCoord(key);
          if (coord.row === row) {
            // Deleted row, omit
            continue;
          } else if (coord.row > row) {
            // Shift up
            const newKey = cellCoordToKey(coord.row - 1, coord.col);
            const shiftedRaw = cell.raw.startsWith('=')
              ? shiftFormulaReferences(cell.raw, -1, 0)
              : cell.raw;
            newCells[newKey] = { ...cell, raw: shiftedRaw };
          } else {
            newCells[key] = cell;
          }
        }

        const newRowHeights: Record<number, number> = {};
        for (const [rStr, h] of Object.entries(sheet.rowHeights)) {
          const r = parseInt(rStr, 10);
          if (r === row) continue;
          if (r > row) {
            newRowHeights[r - 1] = h;
          } else {
            newRowHeights[r] = h;
          }
        }

        return {
          ...sheet,
          rowCount: Math.max(sheet.rowCount - 1, 1),
          cells: newCells,
          rowHeights: newRowHeights,
        };
      });

      const nextWb = {
        ...state,
        sheets: nextSheets,
        version: state.version + 1,
      };
      return recalculationEngine.recalculateWorkbook(nextWb);
    }

    case 'INSERT_COL': {
      const { sheetId, col, before } = action.payload;
      const insertAt = before ? col : col + 1;

      const nextSheets = state.sheets.map((sheet) => {
        if (sheet.id !== sheetId) return sheet;
        const newCells: WorksheetData['cells'] = {};

        for (const [key, cell] of Object.entries(sheet.cells)) {
          const coord = keyToCellCoord(key);
          if (coord.col >= insertAt) {
            const newKey = cellCoordToKey(coord.row, coord.col + 1);
            const shiftedRaw = cell.raw.startsWith('=')
              ? shiftFormulaReferences(cell.raw, 0, 1)
              : cell.raw;
            newCells[newKey] = { ...cell, raw: shiftedRaw };
          } else {
            newCells[key] = cell;
          }
        }

        const newColWidths: Record<number, number> = {};
        for (const [cStr, w] of Object.entries(sheet.columnWidths)) {
          const c = parseInt(cStr, 10);
          if (c >= insertAt) {
            newColWidths[c + 1] = w;
          } else {
            newColWidths[c] = w;
          }
        }

        return {
          ...sheet,
          colCount: sheet.colCount + 1,
          cells: newCells,
          columnWidths: newColWidths,
        };
      });

      const nextWb = {
        ...state,
        sheets: nextSheets,
        version: state.version + 1,
      };
      return recalculationEngine.recalculateWorkbook(nextWb);
    }

    case 'DELETE_COL': {
      const { sheetId, col } = action.payload;

      const nextSheets = state.sheets.map((sheet) => {
        if (sheet.id !== sheetId || sheet.colCount <= 1) return sheet;
        const newCells: WorksheetData['cells'] = {};

        for (const [key, cell] of Object.entries(sheet.cells)) {
          const coord = keyToCellCoord(key);
          if (coord.col === col) {
            continue;
          } else if (coord.col > col) {
            const newKey = cellCoordToKey(coord.row, coord.col - 1);
            const shiftedRaw = cell.raw.startsWith('=')
              ? shiftFormulaReferences(cell.raw, 0, -1)
              : cell.raw;
            newCells[newKey] = { ...cell, raw: shiftedRaw };
          } else {
            newCells[key] = cell;
          }
        }

        const newColWidths: Record<number, number> = {};
        for (const [cStr, w] of Object.entries(sheet.columnWidths)) {
          const c = parseInt(cStr, 10);
          if (c === col) continue;
          if (c > col) {
            newColWidths[c - 1] = w;
          } else {
            newColWidths[c] = w;
          }
        }

        return {
          ...sheet,
          colCount: Math.max(sheet.colCount - 1, 1),
          cells: newCells,
          columnWidths: newColWidths,
        };
      });

      const nextWb = {
        ...state,
        sheets: nextSheets,
        version: state.version + 1,
      };
      return recalculationEngine.recalculateWorkbook(nextWb);
    }

    case 'SET_COL_WIDTH': {
      const { sheetId, col, width } = action.payload;
      const clamped = Math.max(width, 30);
      return {
        ...state,
        sheets: state.sheets.map((sheet) => {
          if (sheet.id !== sheetId) return sheet;
          return {
            ...sheet,
            columnWidths: {
              ...sheet.columnWidths,
              [col]: clamped,
            },
          };
        }),
        version: state.version + 1,
      };
    }

    case 'SET_ROW_HEIGHT': {
      const { sheetId, row, height } = action.payload;
      const clamped = Math.max(height, 20);
      return {
        ...state,
        sheets: state.sheets.map((sheet) => {
          if (sheet.id !== sheetId) return sheet;
          return {
            ...sheet,
            rowHeights: {
              ...sheet.rowHeights,
              [row]: clamped,
            },
          };
        }),
        version: state.version + 1,
      };
    }

    case 'SORT_RANGE': {
      const { sheetId, range, col, direction, hasHeader } = action.payload;
      const nextSheets = state.sheets.map((sheet) => {
        if (sheet.id !== sheetId) return sheet;
        return sortRange(sheet, range, col, direction, hasHeader);
      });
      const nextWb = {
        ...state,
        sheets: nextSheets,
        version: state.version + 1,
      };
      return recalculationEngine.recalculateWorkbook(nextWb);
    }

    case 'SET_FILTER': {
      const { sheetId, filter } = action.payload;
      return {
        ...state,
        sheets: state.sheets.map((sheet) => {
          if (sheet.id !== sheetId) return sheet;
          return applySheetFilter(sheet, filter);
        }),
        version: state.version + 1,
      };
    }

    default:
      return state;
  }
}
