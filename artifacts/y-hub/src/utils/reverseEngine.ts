export type TNormType = 'standard' | 'algebraic' | 'bounded' | 'drastic';

export type ReverseChallenge = {
  operation: TNormType;
  a: number;
  result: number;
  solutionType: 'exact' | 'range' | 'none' | 'any';
  exactSolution?: number;
  minSolution?: number;
  maxSolution?: number;
};

// Generates a reverse challenge where given `a`, `operation`, and `result`, the user must find `b`.
export function generateReverseTNormChallenge(operation: TNormType, a: number, b: number): ReverseChallenge {
  let result = 0;
  switch (operation) {
    case 'standard':
      result = Math.min(a, b);
      break;
    case 'algebraic':
      result = a * b;
      break;
    case 'bounded':
      result = Math.max(0, a + b - 1);
      break;
    case 'drastic':
      if (b === 1) result = a;
      else if (a === 1) result = b;
      else result = 0;
      break;
  }

  // Now, calculate the reverse logic: what are the valid values for `b` given `a` and `result`?
  let solutionType: ReverseChallenge['solutionType'] = 'none';
  let exactSolution: number | undefined;
  let minSolution: number | undefined;
  let maxSolution: number | undefined;

  switch (operation) {
    case 'standard':
      // min(a, b) = result
      if (result < a) {
        solutionType = 'exact';
        exactSolution = result;
      } else if (result === a) {
        solutionType = 'range';
        minSolution = a;
        maxSolution = 1;
      }
      break;
    case 'algebraic':
      // a * b = result
      if (a > 0) {
        solutionType = 'exact';
        exactSolution = result / a;
      } else if (result === 0) {
        solutionType = 'range';
        minSolution = 0;
        maxSolution = 1;
      }
      break;
    case 'bounded':
      // max(0, a + b - 1) = result
      if (result > 0) {
        solutionType = 'exact';
        exactSolution = result + 1 - a;
      } else {
        solutionType = 'range';
        minSolution = 0;
        maxSolution = 1 - a;
      }
      break;
    case 'drastic':
      if (result > 0) {
        if (a === 1) {
          solutionType = 'exact';
          exactSolution = result;
        } else if (result === a) {
          solutionType = 'exact';
          exactSolution = 1;
        }
      } else {
        if (a === 1) {
          solutionType = 'exact';
          exactSolution = 0;
        } else {
          solutionType = 'range';
          minSolution = 0;
          maxSolution = 1; // Actually [0, 1), but we simplify for the challenge
        }
      }
      break;
  }

  // Round values for floating point precision
  if (exactSolution !== undefined) exactSolution = Number(exactSolution.toFixed(2));
  if (minSolution !== undefined) minSolution = Number(minSolution.toFixed(2));
  if (maxSolution !== undefined) maxSolution = Number(maxSolution.toFixed(2));
  result = Number(result.toFixed(2));
  a = Number(a.toFixed(2));

  return {
    operation,
    a,
    result,
    solutionType,
    exactSolution,
    minSolution,
    maxSolution,
  };
}

export function validateReverseChallenge(challenge: ReverseChallenge, userB: number): { isCorrect: boolean; proof: string } {
  let isCorrect = false;
  let proof = '';

  const b = Number(userB.toFixed(2));
  const { a, result, operation, solutionType, exactSolution, minSolution, maxSolution } = challenge;

  if (solutionType === 'exact') {
    isCorrect = b === exactSolution;
  } else if (solutionType === 'range') {
    // Note: for drastic, if result=0 and a!=1, b must be < 1.
    if (operation === 'drastic' && result === 0 && a !== 1 && b === 1) {
      isCorrect = false;
    } else {
      isCorrect = b >= (minSolution || 0) && b <= (maxSolution || 1);
    }
  }

  // Generate proof
  if (isCorrect) {
    if (solutionType === 'exact') {
      proof = `\\text{Correct! Solving for } b: \\\\ `;
      if (operation === 'standard') proof += `\\min(${a}, b) = ${result} \\implies b = ${result}`;
      if (operation === 'algebraic') proof += `${a} \\cdot b = ${result} \\implies b = ${result} / ${a} = ${exactSolution}`;
      if (operation === 'bounded') proof += `\\max(0, ${a} + b - 1) = ${result} \\implies b = ${result} + 1 - ${a} = ${exactSolution}`;
      if (operation === 'drastic') {
        if (a === 1) proof += `a = 1 \\implies b = ${result}`;
        else proof += `a = ${a} \\neq 1 \\text{ and result is non-zero} \\implies b = 1`;
      }
    } else if (solutionType === 'range') {
      proof = `\\text{Correct! The valid range for } b \\text{ is } [${minSolution}, ${maxSolution}]. \\\\ `;
      proof += `\\text{Your answer } ${b} \\text{ is valid.}`;
    }
  } else {
    proof = `\\text{Incorrect. Given } a = ${a} \\text{ and result } = ${result}, \\text{ the correct } b `;
    if (solutionType === 'exact') proof += `is exactly ${exactSolution}.`;
    else proof += `is in the range [${minSolution}, ${maxSolution}].`;
  }

  return { isCorrect, proof };
}
