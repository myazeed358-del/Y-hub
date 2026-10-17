import { CellValue } from '../types/cell';
import { ValidationRule, ValidationResult } from '../types/validation';

/**
 * Validates a cell value against a validation rule
 */
export function validateCellValue(value: CellValue, rule?: ValidationRule): ValidationResult {
  if (!rule) {
    return { isValid: true };
  }

  // Handle blanks
  if (value === null || value === undefined || value === '') {
    if (rule.allowBlank !== false) {
      return { isValid: true };
    }
    return {
      isValid: false,
      message: rule.errorMessage || 'This cell cannot be blank.',
    };
  }

  const strVal = String(value).trim();

  // 1. List validation
  if (rule.type === 'list') {
    const allowed = String(rule.value1)
      .split(',')
      .map((s) => s.trim().toLowerCase());
    const match = allowed.includes(strVal.toLowerCase());
    return {
      isValid: match,
      message: match ? undefined : rule.errorMessage || `Value must be one of: ${rule.value1}`,
    };
  }

  // 2. Numeric validations (wholeNumber, decimal, textLength)
  let testNum: number;
  if (rule.type === 'textLength') {
    testNum = strVal.length;
  } else {
    testNum = Number(strVal);
    if (isNaN(testNum)) {
      return {
        isValid: false,
        message: rule.errorMessage || 'Value must be a valid number.',
      };
    }
    if (rule.type === 'wholeNumber' && !Number.isInteger(testNum)) {
      return {
        isValid: false,
        message: rule.errorMessage || 'Value must be a whole number.',
      };
    }
  }

  const v1 = Number(rule.value1);
  const v2 = rule.value2 !== undefined ? Number(rule.value2) : v1;

  let valid = false;
  switch (rule.operator || 'equalTo') {
    case 'between':
      valid = testNum >= Math.min(v1, v2) && testNum <= Math.max(v1, v2);
      break;
    case 'notBetween':
      valid = testNum < Math.min(v1, v2) || testNum > Math.max(v1, v2);
      break;
    case 'equalTo':
      valid = testNum === v1;
      break;
    case 'notEqualTo':
      valid = testNum !== v1;
      break;
    case 'greaterThan':
      valid = testNum > v1;
      break;
    case 'lessThan':
      valid = testNum < v1;
      break;
    case 'greaterThanOrEqualTo':
      valid = testNum >= v1;
      break;
    case 'lessThanOrEqualTo':
      valid = testNum <= v1;
      break;
  }

  return {
    isValid: valid,
    message: valid ? undefined : rule.errorMessage || `Validation criteria not met for ${rule.type}.`,
  };
}
