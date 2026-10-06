import { CanonicalAST } from './ast';
import { Rational } from '../symbolic/series';

export interface AlgebraicEndpointMetadata {
  ast: CanonicalAST;
  degree: number;
  isolatingInterval: {
    left: Rational;
    right: Rational;
  };
  polyCoeffsRat: Rational[];
}

export type Endpoint =
  | { type: 'infinity'; sign: 1 | -1 }
  | {
      type: 'value';
      ast: CanonicalAST;
      rational?: Rational;
      algebraic?: AlgebraicEndpointMetadata;
    };

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
