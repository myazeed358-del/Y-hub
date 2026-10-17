import { CellRange } from './cell';

export interface ColumnFilter {
  col: number;
  selectedValues: string[];
  allSelected: boolean;
}

export interface SheetFilter {
  range: CellRange;
  columns: Record<number, ColumnFilter>;
}

export type SortDirection = 'asc' | 'desc';

export interface SortOptions {
  col: number;
  direction: SortDirection;
  hasHeader?: boolean;
}
