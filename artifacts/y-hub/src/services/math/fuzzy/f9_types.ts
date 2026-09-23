import { RuleBase, RuleEngineConfig, LinguisticVariable, RuleEvaluation, FuzzifiedVariable } from './rule_types';

export interface F9InferenceRequest {
  ruleBase: RuleBase;
  inputs: Record<string, number>;
  outputVariables: Record<string, LinguisticVariable>;
  config: RuleEngineConfig;
}

export interface RuleCrispOutput {
  ruleId: string;
  variable: string;
  term: string;
  firingStrength: number;
  z: number; // The crisp consequent output (e.g., polynomial eval or inverse eval)
}

export interface F9OutputResult {
  variable: string;
  defuzzifiedValue: number;
  status: string;
  ruleOutputs: RuleCrispOutput[];
}

export interface F9InferenceResult {
  outputs: Record<string, F9OutputResult>;
  fuzzification: Record<string, FuzzifiedVariable>;
  ruleEvaluations: RuleEvaluation[];
  provider: string;
  status: string;
  mathematicalExactness: 'exact' | 'numerical';
  representationAccuracy: 'exact' | 'numerical'; // Sugeno/Tsukamoto are analytically exact
  verificationStatus: string;
  trace: any[];
  warnings?: string[];
  visualizationData?: any;
}
