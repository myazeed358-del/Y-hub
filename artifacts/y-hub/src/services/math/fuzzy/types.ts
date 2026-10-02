export type MembershipFunctionType = 'triangle' | 'trapezoid' | 'gaussian' | 'bell' | 'sigmoid' | 'singleton';
export type TNormType = 'min' | 'prod' | 'bounded' | 'drastic';
export type TConormType = 'max' | 'probsum' | 'bounded' | 'drastic';

export interface MembershipFunction {
  type: MembershipFunctionType;
  params: Record<string, number>;
  evaluate(x: number): number;
}

export interface FuzzySet {
  name: string;
  universe: [number, number];
  membership: MembershipFunction;
}

export interface FuzzyRuleAntecedent {
  variable: string;
  term: string;
  modifier?: 'very' | 'somewhat' | 'not';
}

export interface FuzzyRule {
  id: string;
  antecedents: FuzzyRuleAntecedent[];
  operator: 'AND' | 'OR';
  consequents: Record<string, string>; // var -> term
  weight: number;
}

export type DefuzzificationMethod = 'centroid' | 'bisector' | 'mom' | 'som' | 'lom';
export type FuzzyDefuzzificationMethod = DefuzzificationMethod;

export interface DiscreteFuzzyPoint {
  x: number;
  y: number;
}

export interface FuzzyInferenceRequest {
  systemType: 'mamdani' | 'sugeno' | 'tsukamoto';
  inputs: Record<string, number>;
  variables: Record<string, Record<string, FuzzySet>>;
  rules: FuzzyRule[];
  defuzzification: DefuzzificationMethod;
  tNorm: TNormType;
  tConorm: TConormType;
}

export interface FuzzyResult {
  crispOutputs: Record<string, number>;
  provider: 'typescript' | 'python' | 'fallback_typescript';
  exactness: 'exact_symbolic' | 'numerical_approximation';
  verificationStatus: string;
  trace: any[];
  warnings: string[];
}

export interface AlphaCutResult {
  alpha: number;
  interval: { lower: number, upper: number };
  isStrong: boolean;
}

export interface FuzzyArithmeticResult extends FuzzyResult {
  operation: 'add' | 'sub' | 'mul' | 'div';
  alphaResolution: number;
  cuts: AlphaCutResult[];
  mathematicalExactness: 'exact' | 'symbolic' | 'numerical';
  representationAccuracy: 'exact' | 'sampled' | 'parametric';
  status: 'success' | 'invalid_domain' | 'resource_limited' | 'unsupported';
}


export interface FuzzyRelationData {
  matrix: number[][];
  rows: number;
  cols: number;
}

export interface RelationPropertyReport {
  reflexive: { is: boolean; counterexample?: [number, number] };
  irreflexive: { is: boolean; counterexample?: [number, number] };
  symmetric: { is: boolean; counterexample?: [number, number] };
  antisymmetric: { is: boolean; counterexample?: [number, number] };
  transitive: { is: boolean; counterexample?: [number, number, number] };
  isTolerance: boolean;
  isEquivalence: boolean;
}

export interface RelationCompositionRequest {
  matrixA: number[][];
  matrixB: number[][];
  compositionType: 'max-min' | 'max-product';
}

export interface RelationClosureResult {
  matrix: number[][];
  iterations: number;
  converged: boolean;
  trace: any[];
}

export interface RelationResult extends FuzzyResult {
  operation: string;
  relation?: FuzzyRelationData;
  properties?: RelationPropertyReport;
  closure?: RelationClosureResult;
  inclusion?: { isIncluded: boolean; isEqual: boolean; counterexample?: [number, number] };
}

export interface MembershipFunction {
  type: MembershipFunctionType;
  params: Record<string, number>;
  evaluate(x: number): number;
}

export interface FuzzySet {
  name: string;
  universe: [number, number];
  membership: MembershipFunction;
}

export interface FuzzyRuleAntecedent {
  variable: string;
  term: string;
  modifier?: 'very' | 'somewhat' | 'not';
}

export interface FuzzyRule {
  id: string;
  antecedents: FuzzyRuleAntecedent[];
  operator: 'AND' | 'OR';
  consequents: Record<string, string>; // var -> term
  weight: number;
}


export interface FuzzyInferenceRequest {
  systemType: 'mamdani' | 'sugeno' | 'tsukamoto';
  inputs: Record<string, number>;
  variables: Record<string, Record<string, FuzzySet>>;
  rules: FuzzyRule[];
  defuzzification: DefuzzificationMethod;
  tNorm: TNormType;
  tConorm: TConormType;
}

export interface FuzzyResult {
  crispOutputs: Record<string, number>;
  provider: 'typescript' | 'python' | 'fallback_typescript';
  exactness: 'exact_symbolic' | 'numerical_approximation';
  verificationStatus: string;
  trace: any[];
  warnings: string[];
}

export interface AlphaCutResult {
  alpha: number;
  interval: { lower: number, upper: number };
  isStrong: boolean;
}

export interface FuzzyArithmeticResult extends FuzzyResult {
  operation: 'add' | 'sub' | 'mul' | 'div';
  alphaResolution: number;
  cuts: AlphaCutResult[];
  mathematicalExactness: 'exact' | 'symbolic' | 'numerical';
  representationAccuracy: 'exact' | 'sampled' | 'parametric';
  status: 'success' | 'invalid_domain' | 'resource_limited' | 'unsupported';
}


export interface FuzzyRelationData {
  matrix: number[][];
  rows: number;
  cols: number;
}

export interface RelationPropertyReport {
  reflexive: { is: boolean; counterexample?: [number, number] };
  irreflexive: { is: boolean; counterexample?: [number, number] };
  symmetric: { is: boolean; counterexample?: [number, number] };
  antisymmetric: { is: boolean; counterexample?: [number, number] };
  transitive: { is: boolean; counterexample?: [number, number, number] };
  isTolerance: boolean;
  isEquivalence: boolean;
}

export interface RelationCompositionRequest {
  matrixA: number[][];
  matrixB: number[][];
  compositionType: 'max-min' | 'max-product';
}

export interface RelationClosureResult {
  matrix: number[][];
  iterations: number;
  converged: boolean;
  trace: any[];
}

export interface RelationResult extends FuzzyResult {
  operation: string;
  relation?: FuzzyRelationData;
  properties?: RelationPropertyReport;
  closure?: RelationClosureResult;
  inclusion?: { isIncluded: boolean; isEqual: boolean; counterexample?: [number, number] };
}


