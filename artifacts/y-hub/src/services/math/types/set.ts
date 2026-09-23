import { CanonicalAST } from './ast';
import { Rational } from '../symbolic/series';

export type Endpoint = 
  | { type: 'infinity'; sign: 1 | -1 }
  | { type: 'value'; ast: CanonicalAST; rational?: Rational };

export interface Interval {
  left: Endpoint;
  right: Endpoint;
  leftClosed: boolean;
  rightClosed: boolean;
}

export interface SolutionSet {
  type: 'SolutionSet';
  variable: string;
  intervals: Interval[];
  domainRestrictions: string[];
}
