export type CellValue = string | number | boolean | null;

export interface CellPosition {
  row: number;
  col: number;
}

export interface CellRange {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

export interface CellBorder {
  style: 'thin' | 'medium' | 'thick' | 'double';
  color: string;
}

export type NumberFormatType = 'general' | 'number' | 'currency' | 'percentage' | 'text';

export interface CellStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  fontSize?: number;
  fontFamily?: string;
  textColor?: string;
  backgroundColor?: string;
  horizontalAlign?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  numberFormat?: NumberFormatType;
  decimalPlaces?: number;
  borderTop?: CellBorder;
  borderBottom?: CellBorder;
  borderLeft?: CellBorder;
  borderRight?: CellBorder;
}

export interface MergedRegion extends CellRange {
  id: string;
}

export interface CellData {
  raw: string;
  computed?: CellValue;
  style?: CellStyle;
  error?: string;
}
