import {
  tNormStandard,
  tNormAlgebraic,
  tNormBounded,
  tNormDrastic,
} from '@/utils/fuzzyLogic';

import type { TNormType } from '@/utils/reverseEngine';

export function normalizeMembershipInput(value: string): number {
  return Math.max(0, Math.min(1, parseFloat(value) || 0));
}

export function evaluateTNorm(
  numA: number,
  numB: number,
  tnorm: TNormType,
  isArabic: boolean
): { result: number; proof: string } {
  let result = 0;
  let proof = '';

  switch (tnorm) {
    case 'standard':
      result = tNormStandard(numA, numB);
      proof = `\\mu_{A \\cap B}(x) = \\min(${numA}, ${numB}) = ${result}`;
      break;
    case 'algebraic':
      result = tNormAlgebraic(numA, numB);
      proof = `\\mu_{A \\cdot B}(x) = ${numA} \\cdot ${numB} = ${result}`;
      break;
    case 'bounded':
      result = tNormBounded(numA, numB);
      proof = `\\mu_{A \\odot B}(x) = \\max(0, ${numA} + ${numB} - 1) = \\max(0, ${(numA + numB - 1).toFixed(2)}) = ${result}`;
      break;
    case 'drastic':
      result = tNormDrastic(numA, numB);
      if (numB === 1) {
        proof = isArabic
          ? `\\text{بما أن } b = 1, \\mu_{A \\wedge B}(x) = a = ${result}`
          : `\\text{Since } b = 1, \\mu_{A \\wedge B}(x) = a = ${result}`;
      } else if (numA === 1) {
        proof = isArabic
          ? `\\text{بما أن } a = 1, \\mu_{A \\wedge B}(x) = b = ${result}`
          : `\\text{Since } a = 1, \\mu_{A \\wedge B}(x) = b = ${result}`;
      } else {
        proof = isArabic
          ? `\\text{بما أن } a \\neq 1 \\text{ و } b \\neq 1, \\mu_{A \\wedge B}(x) = 0`
          : `\\text{Since neither } a = 1 \\text{ nor } b = 1, \\mu_{A \\wedge B}(x) = 0`;
      }
      break;
  }

  return { result, proof };
}
