import { MathStep, VerificationResult, VerificationStatus } from './step';
import { CanonicalAST } from './ast';
import { LimitApproach, LimitDirection } from './limit';

export type MathResultType = 
  | 'symbolic' | 'numeric' | 'equation' | 'inequality' | 'limit'
  | 'matrix' | 'vector' | 'set' | 'sequence' | 'series'
  | 'ode' | 'statistical' | 'graph' | 'composite' 
  | 'unsupported' | 'ambiguous' | 'error';

export interface BaseResult {
  type: MathResultType;
  steps: MathStep[];
  warnings: string[];
  conditions: string[];
  verification?: VerificationResult;
  computationTimeMs?: number;
  engineUsed: 'local_ts' | 'python_sympy' | 'python_scipy' | 'api_fallback';
}

// ... existing types ...
export interface SymbolicResult extends BaseResult {
  type: 'symbolic';
  expression: string;
  latex: string;
  exact: boolean;
}

export interface NumericResult extends BaseResult {
  type: 'numeric';
  value: number | number[];
  tolerance: number;
  iterations?: number;
}

export interface EquationSolution {
  value: CanonicalAST;
  exact: boolean;
  conditions: string[]; 
  verification: VerificationStatus;
  extraneous: boolean; 
  multiplicity?: number; 
  approximation?: boolean; 
  residual?: number;
}

export interface EquationResult extends BaseResult {
  type: 'equation';
  solutions: EquationSolution[];
  rejectedSolutions: EquationSolution[]; 
  completeness: 'all_roots_found' | 'partial_numerical_roots_found' | 'root_search_incomplete' | 'unsupported';
  infiniteSolutions: boolean;
  noSolutions: boolean;
  solutionSetLatex?: string;
}

// --- NEW LIMIT TYPES ---

export type LimitClassification = 
  | 'finite' 
  | '+infinity' 
  | '-infinity' 
  | 'does_not_exist' 
  | 'indeterminate' 
  | 'undefined' 
  | 'not_proven' 
  | 'unsupported';
  
export type IndeterminateForm = '0/0' | 'inf/inf' | '0*inf' | 'inf-inf' | '0^0' | '1^inf' | 'inf^0' | 'none';

export interface LimitResult extends BaseResult {
  type: 'limit';
  value?: CanonicalAST; 
  classification: LimitClassification;
  indeterminateForm: IndeterminateForm;
  direction: LimitDirection;
  approachPoint: LimitApproach;
  strategy: string; 
}

// -----------------------

export interface ErrorResult extends BaseResult {
  type: 'error';
  errorType: 'parse_error' | 'internal_error' | 'unsupported';
  errorMessage: string;
}

export interface UnsupportedResult extends BaseResult {
  type: 'unsupported';
  reason: string;
}

export type MathResult = 
  | SymbolicResult
  | NumericResult
  | EquationResult
  | LimitResult
  | ErrorResult
  | UnsupportedResult;
