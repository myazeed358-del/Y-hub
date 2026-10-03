Task: determine the intended execution order of solveCauchyEuler.

Do NOT edit files.
Do NOT stage.
Do NOT commit.
Do NOT push.

We have confirmed:
- second_order_linear.ts has 17 scope/order errors
- the solveCauchyEuler body is unchanged from HEAD
- the current worktree hunk adding solveConstantCoeffs is not the source of these 17 errors

I need a mathematical/control-flow audit before any fix.

Inspect:
1. The complete solveCauchyEuler method.
2. The definitions and behavior of:
   - solveParticular
   - the characteristic-root calculation
   - the construction of y1/y2
   - the construction of yh
   - the construction of finalY
   - the steps/trace mechanism
3. Related second-order ODE methods in the repository that show the intended pattern.
4. Tests covering second_order_linear / Cauchy-Euler behavior, if any.
5. Git history for second_order_linear.ts and the last uncorrupted version of solveCauchyEuler, if available.

Answer these questions:

A. What is the intended mathematical/control-flow order of:
   characteristic roots → y1/y2 → yh → particular solution → finalY → steps/trace?

B. Where should each of these values be created?
   - steps
   - y1
   - y2
   - finalY

C. Why are they currently referenced before declaration/scope?

D. Is there evidence that this method was corrupted or partially rearranged historically?

E. Propose the MINIMAL internal restructuring needed to remove the 17 scope errors while preserving:
   - the mathematical meaning
   - the returned solution
   - the trace semantics
   - the public API

Do NOT implement the restructuring.
Do NOT change any file.

At the end, give:
- exact blocks that would move/change
- expected number of TypeScript errors removed
- any mathematical behavior that still needs testsimport { CanonicalAST } from './ast';
import { SolutionSet, Endpoint, Interval } from './set';
import { MathStep } from './step';

export interface FunctionAnalysisRequest {
  expression: CanonicalAST;
  variable: string;
  mode: 'real';
}

export type FunctionClassification = 
  | 'constant'
  | 'linear'
  | 'polynomial'
  | 'rational'
  | 'radical'
  | 'absolute_value'
  | 'exponential'
  | 'logarithmic'
  | 'trigonometric'
  | 'piecewise'
  | 'composite'
  | 'mixed';

export type ContinuityStatus = 
  | 'continuous'
  | 'removable_discontinuity'
  | 'jump_discontinuity'
  | 'infinite_discontinuity'
  | 'domain_boundary'
  | 'unresolved';

export interface DiscontinuityPoint {
  point: Endpoint;
  status: ContinuityStatus;
  limitValue?: CanonicalAST | null; // For removable
  leftDomainAccessible?: boolean;
  rightDomainAccessible?: boolean;
}

export interface VerificationFailure {
  conditionFailed: 
    | 'function_undefined'
    | 'left_limit_mismatch'
    | 'right_limit_mismatch'
    | 'two_sided_limit_missing'
    | 'limit_infinite'
    | 'domain_boundary';
}

export interface CriticalPoint {
  point: Endpoint;
  source: ('derivative_zero' | 'derivative_undefined_in_domain' | 'domain_boundary' | 'discontinuity')[];
  inFunctionDomain: boolean;
  derivativeDefined: boolean;
  functionDefined: boolean;
}

export interface ExtremaPoint {
  point: Endpoint;
  type: 'local_maximum' | 'local_minimum' | 'global_maximum' | 'global_minimum';
}

export interface InflectionPoint {
  point: Endpoint;
  status: 'inflection_point' | 'inflection_candidate';
}

export interface Asymptote {
  type: 'vertical' | 'horizontal' | 'slant';
  equation: CanonicalAST; 
  direction?: 'left' | 'right' | 'both' | '+infinity' | '-infinity';
}

export interface InfiniteBehavior {
  limitAtPlusInfinity: CanonicalAST | 'does_not_exist' | 'unresolved';
  limitAtMinusInfinity: CanonicalAST | 'does_not_exist' | 'unresolved';
}

export interface GraphSegment {
  interval: Interval;
  monotonicity: 'increasing' | 'decreasing' | 'constant' | 'unknown';
  concavity: 'concave_up' | 'concave_down' | 'linear' | 'unknown';
}

export interface GraphData {
  domainIntervals: Interval[];
  criticalPoints: CriticalPoint[];
  intercepts: Endpoint[];
  extrema: ExtremaPoint[];
  inflectionPoints: InflectionPoint[];
  verticalAsymptotes: Asymptote[];
  horizontalAsymptotes: Asymptote[];
  slantAsymptotes: Asymptote[];
  behaviorSegments: GraphSegment[];
  suggestedPlottingRange?: { xMin: number; xMax: number; yMin: number; yMax: number };
}

export interface DerivativeAnalysis {
  firstDerivative: CanonicalAST;
  firstDerivativeDomain: SolutionSet;
  secondDerivative?: CanonicalAST;
  secondDerivativeDomain?: SolutionSet;
}

export interface FunctionAnalysisResult {
  variable: string;
  domain: SolutionSet;
  classification: FunctionClassification[]; 
  xIntercepts: Endpoint[] | 'root_isolation_incomplete';
  yIntercept: Endpoint | undefined;
  discontinuities: DiscontinuityPoint[];
  
  derivativeAnalysis?: DerivativeAnalysis;
  criticalPoints?: CriticalPoint[];
  
  increasingIntervals?: Interval[];
  decreasingIntervals?: Interval[];
  extrema?: ExtremaPoint[];
  
  concaveUpIntervals?: Interval[];
  concaveDownIntervals?: Interval[];
  inflectionPoints?: InflectionPoint[];
  
  asymptotes?: Asymptote[];
  infiniteBehavior?: InfiniteBehavior;
  
  graphData?: GraphData;
  
  verification: VerificationFailure[];
  steps: MathStep[];
}
