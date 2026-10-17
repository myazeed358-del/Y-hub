import { CellRange, CellStyle } from './cell';

export type ConditionalFormatType = 'greaterThan' | 'lessThan' | 'equalTo' | 'between' | 'textContains';

export interface ConditionalFormatRule {
  id: string;
  range: CellRange;
  type: ConditionalFormatType;
  value1: string | number;
  value2?: string | number;
  style: Partial<CellStyle>;
}
