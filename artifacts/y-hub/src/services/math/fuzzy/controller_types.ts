import { LinguisticVariable, RuleBase, RuleEngineConfig } from './rule_types';

export interface ControllerConfiguration extends RuleEngineConfig {
  inferenceMethod: 'mamdani' | 'sugeno_zero' | 'sugeno_first' | 'tsukamoto';
  implicationMethod?: 'clipping' | 'scaling'; // Mamdani
  aggregationMethod?: 'max'; // Mamdani
  defuzzificationMethod?: string; // Mamdani
  outputResolution?: number; // Mamdani
}

export interface FuzzyController {
  id: string;
  name: string;
  description?: string;
  inputVariables: Record<string, LinguisticVariable>;
  outputVariables: Record<string, LinguisticVariable>;
  ruleBase: RuleBase;
  configuration: ControllerConfiguration;
}

export interface ControllerRequest {
  controller: FuzzyController;
  inputs: Record<string, number>;
}

export interface ControllerDiagnostics {
  undefinedVariables: string[];
  undefinedTerms: string[];
  unreachableRules: string[];
  contradictoryRules: string[];
  invalidWeights: string[];
  invalidDomains: string[];
  isMathematicallyValid: boolean;
}

export interface ControllerVerification {
  isValid: boolean;
  failures: string[];
}

export interface ControllerResult {
  provider: string;
  inferenceMethod: string;
  mathematicalExactness: 'exact' | 'numerical';
  representationAccuracy: 'exact' | 'sampled' | 'parametric';
  status: string;
  warnings: string[];
  diagnostics: ControllerDiagnostics;
  verification: ControllerVerification;
  outputs: Record<string, any>; // Unified output
  fuzzification: any;
  ruleEvaluations: any;
  trace: any[];
  visualizationData: any;
}

export interface SensitivityAnalysisRequest {
  controller: FuzzyController;
  baseInputs: Record<string, number>;
  targetVariable: string;
  delta: number;
}

export interface ResponseAnalysisRequest {
  controller: FuzzyController;
  fixedInputs: Record<string, number>;
  sweepVariable: string;
  targetOutput: string;
  points: number;
}
