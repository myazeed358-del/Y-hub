import { CanonicalAST } from './ast';
import { MathStep } from './step';
import { SolutionSet } from './set';
import { VerificationFailure } from './analysis'; // using the verification failure from analysis

export type IntegrationStatus = 'exact_symbolic' | 'conditionally_valid' | 'numerically_supported' | 'unresolved' | 'unsupported';
export type VerificationStatus = 'exactly_equivalent' | 'numerically_consistent' | 'not_proven' | 'not_equivalent' | 'verification_failed';

export type IntegrationMode = 'symbolic_indefinite' | 'symbolic_definite' | 'symbolic_improper' | 'numerical' | 'auto';

export interface IntegrationExecutionContext {
  activeStrategies: Set<string>;
  attemptedStrategies: Set<string>;
  depth: number;
  transformationCount: number;
  maxDepth: number;
  maxAttempts: number;
  maxTransformations: number;
}

export interface OrchestrationContext extends IntegrationExecutionContext {
  parentStrategy: string | null;
}

export interface IntegrationRequest {
  expression: CanonicalAST;
  integrand: CanonicalAST; // alias for expression
  variable: string;
  context?: OrchestrationContext;
}

export interface IntegrationStrategyTrace {
  strategy: string;
  applicability: 'applicable' | 'inapplicable' | 'unknown';
  attempted: boolean;
  depth: number;
  resultStatus: string;
  verificationStatus?: VerificationStatus;
  reason?: string;
}

export interface OrchestrationRequest {
  mode: IntegrationMode;
  integrand: CanonicalAST;
  variable: string;
  lowerBound?: CanonicalAST;
  upperBound?: CanonicalAST;
  numericalMethod?: 'trapezoidal' | 'simpson' | 'adaptive_simpson';
  numericalTolerance?: number;
  numericalSubdivisions?: number;
  maxStrategyAttempts?: number;
  maxDepth?: number;
  maxTransformations?: number;
}

export interface OrchestrationResult {
  request: OrchestrationRequest;
  modeExecuted: IntegrationMode;
  finalClassification: string;
  symbolicResult?: CanonicalAST | null;
  definiteResult?: DefiniteIntegrationResult | null;
  improperResult?: ImproperIntegrationResult | null;
  numericalResult?: NumericalIntegrationResult | null;
  trace: IntegrationStrategyTrace[];
  warnings: string[];
}

export interface SubstitutionStep {
  originalExpression: CanonicalAST;
  substitutionVariable: string;
  uExpression: CanonicalAST;       // u = g(x)
  duExpression: CanonicalAST;      // du = g'(x) dx
  transformedExpression: CanonicalAST; // e.g. cos(u)
  integratedExpression: CanonicalAST;  // e.g. sin(u)
  backSubstitutedExpression: CanonicalAST; // e.g. sin(x^2)
}

export interface IntegrationByPartsStep {
  originalExpression: CanonicalAST;
  uExpression: CanonicalAST;
  dvExpression: CanonicalAST;
  duExpression: CanonicalAST;
  vExpression: CanonicalAST;
  reducedIntegral: CanonicalAST; // ∫ v du
  resultExpression: CanonicalAST; // u v - ∫ v du
}

export interface TrigIdentityStep {
  identity: string;
  originalExpression: CanonicalAST;
  transformedExpression: CanonicalAST;
  verificationStatus: VerificationStatus;
}

export interface TrigSubstitutionStep {
  substitutionFamily: 'sin' | 'tan' | 'sec';
  originalVariable: string;
  auxiliaryVariable: string;
  substitution: CanonicalAST; // e.g. x = a sin(theta)
  inverseSubstitution: CanonicalAST; // e.g. theta = asin(x/a)
  dxTransformation: CanonicalAST; // e.g. a cos(theta)
  radicalTransformation: CanonicalAST; // e.g. a cos(theta)
  branchCondition: string; // e.g. "a > 0, cos(theta) >= 0"
  transformedExpression: CanonicalAST; // the theta-integral
  verificationStatus: VerificationStatus;
}

export interface IntegrationResult {
  request: IntegrationRequest;
  status: IntegrationStatus;
  antiderivative: CanonicalAST | null; // Does not include + C natively in the AST to allow differentiation, but it represents the F(x)
  domain: SolutionSet | null; // Domain of the original function
  verificationStatus: VerificationStatus;
  substitution?: SubstitutionStep;
  parts?: IntegrationByPartsStep[];
  trigSteps?: TrigIdentityStep[];
  trigSubSteps?: TrigSubstitutionStep[];
  steps: MathStep[];
}

export type DefiniteIntegrationClassification = 'proper_exact' | 'proper_symbolic' | 'improper_detected' | 'domain_invalid' | 'requires_assumption' | 'unsupported' | 'unresolved' | 'resource_limit';

export interface DefiniteIntegrationRequest {
  integrand: CanonicalAST;
  variable: string;
  lowerBound: CanonicalAST;
  upperBound: CanonicalAST;
  trustedOrientation?: 1 | -1 | 0;
  trustedDomainCheck?: boolean;
}

export interface DefiniteIntegrationResult {
  request: DefiniteIntegrationRequest;
  classification: DefiniteIntegrationClassification;
  orientation: 1 | -1 | 0; // 1 for a < b, -1 for a > b, 0 for a = b
  originalDomain: SolutionSet | null;
  detectedSingularities: CanonicalAST[]; // specific points within [a, b] where function is undefined
  antiderivative: CanonicalAST | null;
  lowerEvaluation: CanonicalAST | null;
  upperEvaluation: CanonicalAST | null;
  finalValue: CanonicalAST | null;
  verificationStatus: VerificationStatus;
  assumptions: string[];
  steps: MathStep[];
}

export type ImproperIntegrationClassification = 
  | 'convergent_exact' 
  | 'convergent_symbolic' 
  | 'divergent_positive_infinity' 
  | 'divergent_negative_infinity' 
  | 'divergent_two_sided' 
  | 'oscillatory_or_nonconvergent' 
  | 'unresolved' 
  | 'unsupported' 
  | 'requires_assumption' 
  | 'resource_limit';

export interface ImproperIntegralPiece {
  lowerBound: CanonicalAST;
  upperBound: CanonicalAST;
  improperLeft: boolean;
  improperRight: boolean;
  
  // For singly improper pieces
  limitVariable: string | null;
  limitDirection: 'left' | 'right' | 'both' | null;
  subintegralResult: DefiniteIntegrationResult | null;
  limitResult: any | null; // LimitResult

  // For doubly improper pieces, independently evaluated around a finite split point c
  doublyImproperSplitPoint?: CanonicalAST | null;
  leftComponent?: {
      limitVariable: string;
      limitDirection: 'right';
      subintegralResult: DefiniteIntegrationResult;
      limitResult: any;
  };
  rightComponent?: {
      limitVariable: string;
      limitDirection: 'left';
      subintegralResult: DefiniteIntegrationResult;
      limitResult: any;
  };

  converges: boolean;
  divergenceType?: 'positive_infinity' | 'negative_infinity' | 'oscillatory' | 'unresolved' | 'divergent_two_sided';
  value: CanonicalAST | null;
}

export interface ImproperIntegrationResult {
  request: DefiniteIntegrationRequest;
  classification: ImproperIntegrationClassification;
  pieces: ImproperIntegralPiece[];
  originalDomain: SolutionSet | null;
  detectedSingularities: CanonicalAST[];
  finalValue: CanonicalAST | null;
  verificationStatus: VerificationStatus;
  assumptions: string[];
  steps: MathStep[];
}

export type NumericalIntegrationClassification = 
  | 'converged'
  | 'tolerance_not_met'
  | 'domain_invalid'
  | 'singularity_detected'
  | 'endpoint_singularity'
  | 'non_finite_evaluation'
  | 'requires_improper'
  | 'requires_even_subdivision_count'
  | 'resource_limit'
  | 'unsupported'
  | 'unresolved'
  | 'invalid_tolerance'
  | 'invalid_subdivision_count';

export interface NumericalIntegrationRequest {
  integrand: CanonicalAST;
  variable: string;
  lowerBound: CanonicalAST;
  upperBound: CanonicalAST;
  method: 'trapezoidal' | 'simpson' | 'adaptive_simpson';
  subdivisions?: number;
  tolerance?: number;
  maxEvaluations?: number;
  maxRecursionDepth?: number;
}

export interface NumericalIntegrationStep {
  method: string;
  interval: [number, number];
  subdivisionCount: number;
  evaluationCount: number;
  approximation: number;
  estimatedError: number;
  tolerance: number | null;
}

export interface NumericalIntegrationResult {
  request: NumericalIntegrationRequest;
  classification: NumericalIntegrationClassification;
  numericalValue: number | null;
  estimatedError: number | null;
  tolerance: number | null;
  method: string;
  lowerBound: number | null;
  upperBound: number | null;
  orientation: 1 | -1 | 0;
  subdivisionCount: number;
  evaluationCount: number;
  trace: NumericalIntegrationStep[];
  warnings: string[];
}
