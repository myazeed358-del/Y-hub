import { CellData, MergedRegion } from './cell';
import { ConditionalFormatRule } from './formatting';
import { ValidationRule } from './validation';
import { SheetFilter } from './filter';

export interface WorksheetData {
  id: string;
  name: string;
  rowCount: number;
  colCount: number;
  cells: Record<string, CellData>; // key: `${row},${col}`
  columnWidths: Record<number, number>;
  rowHeights: Record<number, number>;
  mergedCells: MergedRegion[];
  conditionalFormats: ConditionalFormatRule[];
  validations: Record<string, ValidationRule>; // key: `${row},${col}`
  filter?: SheetFilter;
  hiddenRows?: Record<number, boolean>;
}

export const cellCoordToKey = (row: number, col: number): string => `${row},${col}`;

export const keyToCellCoord = (key: string): { row: number; col: number } => {
  const parts = key.split(',');
  return {
    row: parseInt(parts[0] || '0', 10),
    col: parseInt(parts[1] || '0', 10),
  };
};
