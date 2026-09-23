import { CanonicalAST } from './ast';
import { Assumption } from './problem';

export type LimitDirection = 'left' | 'right' | 'both';
export type LimitApproach = number | '+infinity' | '-infinity'; 

export interface LimitRequest {
  expression: CanonicalAST;
  variable: string;
  approach: LimitApproach;
  direction: LimitDirection;
  options?: {
    domain?: 'real' | 'complex';
    mode?: 'EXACT' | 'NUMERIC' | 'AUTO';
    assumptions?: Assumption[];
  };
}
