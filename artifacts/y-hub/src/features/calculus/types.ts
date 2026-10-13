export interface Step {
  desc: string;
  math?: string;
  isError?: boolean;
}

export interface CalculusHistoryEntry {
  id: number;
  engine: string;
  expr: string;
  result: string;
}

export interface GraphPoint {
  x: number;
  y: number;
}

export type EngineType =
  | 'limits'
  | 'derivatives'
  | 'integrals'
  | 'applications'
  | 'series'
  | 'history';
