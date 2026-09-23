import { CanonicalAST } from './ast';

export type MathOperation = 
  | 'evaluate'
  | 'simplify'
  | 'solve_equation'
  | 'solve_inequality'
  | 'derive'
  | 'integrate'
  | 'limit'
  | 'matrix_operation'
  | 'ode'
  | 'unknown';

export type AssumptionRelation = '>' | '>=' | '<' | '<=' | '=' | '!=' | 'in' | 'is';

export interface Assumption {
  variable: string;
  relation: AssumptionRelation;
  value: any; // e.g., 0, 'real', 'integer'
}

export interface MathOptions {
  mode: 'EXACT' | 'APPROXIMATE' | 'AUTO';
  domain?: 'real' | 'complex';
  tolerance?: number;
}

export interface MathProblemRequest {
  operation: MathOperation;
  expression?: CanonicalAST;
  rawInput: string;
  variable?: string;
  point?: CanonicalAST; // e.g. x -> 0 for limits
  assumptions: Assumption[];
  options: MathOptions;
}
