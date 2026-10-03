import { CanonicalAST, InequalityNode } from './ast';
import { Endpoint } from './set';

export type VerificationStatus = 
  | 'exactly_equivalent' 
  | 'numerically_consistent' 
  | 'not_proven' 
  | 'not_equivalent' 
  | 'verification_failed';

export interface VerificationResult {
  status: VerificationStatus;
  evidence?: string;
  method?: 'symbolic' | 'numeric' | 'hybrid';
  methodUsed: 'independent_numerical_difference' | 'none' | 'differentiation' | 'substitution';
  explanation: string;
}

export interface TransformationData {
  method: string;
  before: CanonicalAST;
  after: CanonicalAST;
  restrictionsAdded: string[];
  justification: string;
  verified: boolean;
  normalizationType?: never;
}

export type InequalityTransformationData =
  | {
      method: 'rational_normalization';
      normalizationType: 'rational_difference';
      crossMultiplication: 'not_used';
      justification: string;
    }
  | {
      method: 'rational_sign_chart';
      normalizationType?: never;
      relation: InequalityNode['operator'];
      criticalPoints: Array<{
        value: number;
        numeratorMultiplicity: number;
        denominatorMultiplicity: number;
        domainAllowed: boolean;
        endpoint: Endpoint;
      }>;
      rootCompleteness: 'complete';
      justification: string;
    }
  | {
      method: 'linear_inequality_normalization';
      normalizationType?: never;
      before: InequalityNode;
      after: InequalityNode;
      relation: InequalityNode['operator'];
      coefficientSign: 'positive' | 'negative';
      directionChanged: boolean;
      restrictionsAdded: string[];
      justification: string;
      verified: 'exactly_verified';
    }
  | {
      method: 'polynomial_sign_chart';
      normalizationType?: never;
      relation: InequalityNode['operator'];
      rootCompleteness: 'complete';
      roots: Array<{ value: number; multiplicity: number; endpoint?: Endpoint }>;
      infinitySign: { plusInfinity: 'positive' | 'negative' };
      justification: string;
    }
  | {
      method: 'root_isolation_incomplete';
      normalizationType?: never;
      rootCompleteness: 'partial' | 'unknown';
      justification: string;
    }
  | {
      method: 'absolute_value_inequality';
      normalizationType?: never;
      boundSign: 'positive' | 'negative' | 'zero';
      rule: string;
      justification: string;
    }
  | {
      method: 'radical_squaring';
      normalizationType?: never;
      relation: InequalityNode['operator'];
      justification: string;
    };

export type MathStepTransformation = TransformationData | InequalityTransformationData;

export interface MathStep {
  id: string;
  title: string;
  explanation: string;
  type?: 'error' | 'info' | 'transformation';
  details?: Record<string, unknown>;
  transformation?: MathStepTransformation;
  subSteps?: MathStep[];
}
