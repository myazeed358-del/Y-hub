export type HedgeType = 'none' | 'very' | 'somewhat' | 'more-or-less';

export interface RulePredicate {
  type: 'predicate';
  variable: string;
  term: string;
  hedge: HedgeType;
}

export interface LogicalExpression {
  type: 'AND' | 'OR' | 'NOT';
  children: RuleNode[];
}

export type RuleNode = RulePredicate | LogicalExpression;

export interface Rule {
  id: string;
  antecedent: RuleNode;
  consequents: RulePredicate[];
  weight: number;
  rawText?: string;
}

export interface LinguisticTerm {
  name: string;
  // F1 membership function shape definition
  membership: {
    type: 'triangle' | 'trapezoid' | 'gaussian' | 'constant' | 'linear' | 'monotonic_up' | 'monotonic_down';
    params: Record<string, number>;
  };
}

export interface LinguisticVariable {
  name: string;
  domain: [number, number];
  terms: Record<string, LinguisticTerm>;
}

export interface RuleBase {
  variables: Record<string, LinguisticVariable>;
  rules: Rule[];
}

export interface FuzzifiedTerm {
  term: string;
  membership: number;
}

export interface FuzzifiedVariable {
  variable: string;
  crispInput: number;
  terms: Record<string, FuzzifiedTerm>;
  activeTerms: string[];
}

export interface RuleEvaluation {
  ruleId: string;
  firingStrength: number;
  consequents: { variable: string; term: string; hedge: HedgeType; weight: number }[];
  trace: any[];
}

export interface RuleEngineResult {
  fuzzification: Record<string, FuzzifiedVariable>;
  evaluations: RuleEvaluation[];
  diagnostics: RuleDiagnostics;
  provider: string;
  mathematicalExactness: 'numerical' | 'exact';
  representationAccuracy: 'sampled' | 'parametric';
  status: string;
  warnings?: string[];
}

export interface RuleDiagnostics {
  duplicates: [string, string][];
  contradictions: [string, string][];
  unreferencedVariables: string[];
  unreferencedTerms: string[];
  undefinedVariables: string[];
  undefinedTerms: string[];
  neverFiredRules?: string[];
}

export interface RuleEngineConfig {
  tNorm: 'min' | 'product';
  tConorm: 'max' | 'prob_sum';
  domainPolicy?: 'reject' | 'clamp';
}



