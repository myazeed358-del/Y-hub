export interface MathSolverStep {
  desc: string;
  math?: string;
}

export type PlotMode =
  | 'surface'
  | 'parametric'
  | 'vector';
