import { RuleBase, RuleEngineConfig, LinguisticVariable, RuleEvaluation, FuzzifiedVariable } from './rule_types';
import { FuzzyDefuzzificationMethod } from './types';

export interface MamdaniConfig extends RuleEngineConfig {
  implicationMethod: 'clipping' | 'scaling';
  aggregationMethod: 'max';
  defuzzificationMethod: FuzzyDefuzzificationMethod;
  outputResolution?: number;
}

export interface MamdaniInferenceRequest {
  ruleBase: RuleBase;
  inputs: Record<string, number>;
  outputVariables: Record<string, LinguisticVariable>;
  config: MamdaniConfig;
}

export interface MamdaniImplicatedOutput {
  ruleId: string;
  variable: string;
  term: string;
  points: { x: number; y: number }[];
}

export interface MamdaniAggregatedOutput {
  variable: string;
  points: { x: number; y: number }[];
}

export interface MamdaniOutputResult {
  variable: string;
  defuzzifiedValue: number;
  status: string;
  aggregatedOutput: MamdaniAggregatedOutput;
  implications: MamdaniImplicatedOutput[];
}

export interface MamdaniInferenceResult {
  outputs: Record<string, MamdaniOutputResult>;
  fuzzification: Record<string, FuzzifiedVariable>;
  ruleEvaluations: RuleEvaluation[];
  provider: string;
  status: string;
  mathematicalExactness: 'numerical' | 'exact';
  representationAccuracy: 'sampled' | 'parametric';
  verificationStatus: string;
  trace: any[];
  warnings?: string[];
  visualizationData?: any;
}
