export type ValidationType = 'list' | 'wholeNumber' | 'decimal' | 'textLength';

export type ValidationOperator = 'between' | 'notBetween' | 'equalTo' | 'notEqualTo' | 'greaterThan' | 'lessThan' | 'greaterThanOrEqualTo' | 'lessThanOrEqualTo';

export interface ValidationRule {
  type: ValidationType;
  operator?: ValidationOperator;
  value1: string | number;
  value2?: string | number;
  allowBlank?: boolean;
  errorMessage?: string;
}

export interface ValidationResult {
  isValid: boolean;
  message?: string;
}
