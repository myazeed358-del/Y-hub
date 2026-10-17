import { WorkbookData } from '../types/workbook';
import { CellRange, CellStyle } from '../types/cell';
import { ValidationRule } from '../types/validation';
import { ConditionalFormatRule } from '../types/formatting';
import { SheetFilter, SortDirection } from '../types/filter';

export type WorkbookAction =
  | { type: 'SET_WORKBOOK'; payload: WorkbookData }
  | { type: 'SET_WORKBOOK_NAME'; payload: string }
  | { type: 'SET_ACTIVE_SHEET'; payload: string }
  | { type: 'ADD_SHEET'; payload?: { name?: string } }
  | { type: 'DELETE_SHEET'; payload: string }
  | { type: 'RENAME_SHEET'; payload: { sheetId: string; newName: string } }
  | { type: 'REORDER_SHEETS'; payload: { fromIndex: number; toIndex: number } }
  | { type: 'SET_CELL_RAW'; payload: { sheetId: string; row: number; col: number; raw: string } }
  | { type: 'SET_CELLS_BATCH'; payload: { sheetId: string; updates: Array<{ row: number; col: number; raw: string }> } }
  | { type: 'FORMAT_CELLS'; payload: { sheetId: string; range: CellRange; style: Partial<CellStyle> } }
  | { type: 'SET_CELL_VALIDATION'; payload: { sheetId: string; row: number; col: number; rule: ValidationRule } }
  | { type: 'REMOVE_CELL_VALIDATION'; payload: { sheetId: string; row: number; col: number } }
  | { type: 'ADD_CONDITIONAL_FORMAT'; payload: { sheetId: string; rule: ConditionalFormatRule } }
  | { type: 'REMOVE_CONDITIONAL_FORMAT'; payload: { sheetId: string; ruleId: string } }
  | { type: 'MERGE_CELLS'; payload: { sheetId: string; range: CellRange } }
  | { type: 'UNMERGE_CELLS'; payload: { sheetId: string; range: CellRange } }
  | { type: 'INSERT_ROW'; payload: { sheetId: string; row: number; before: boolean } }
  | { type: 'DELETE_ROW'; payload: { sheetId: string; row: number } }
  | { type: 'INSERT_COL'; payload: { sheetId: string; col: number; before: boolean } }
  | { type: 'DELETE_COL'; payload: { sheetId: string; col: number } }
  | { type: 'SET_COL_WIDTH'; payload: { sheetId: string; col: number; width: number } }
  | { type: 'SET_ROW_HEIGHT'; payload: { sheetId: string; row: number; height: number } }
  | { type: 'SORT_RANGE'; payload: { sheetId: string; range: CellRange; col: number; direction: SortDirection; hasHeader: boolean } }
  | { type: 'SET_FILTER'; payload: { sheetId: string; filter?: SheetFilter } };
