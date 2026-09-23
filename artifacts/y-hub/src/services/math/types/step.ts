export type VerificationStatus = 
  | 'exactly_equivalent' 
  | 'numerically_consistent' 
  | 'not_proven' 
  | 'not_equivalent' 
  | 'verification_failed';

export interface VerificationResult {
  status: VerificationStatus;
  evidence?: string;
  method: 'symbolic' | 'numeric' | 'hybrid';
}

export interface TransformationData {
  method: string;
  before: any; // CanonicalAST
  after: any;  // CanonicalAST
  restrictionsAdded: string[];
  justification: string;
  verified: boolean;
}

export interface MathStep {
  id: string;
  title: string;
  explanation: string;
  transformation?: TransformationData; // Structured transformation trace
  subSteps?: MathStep[];
}
