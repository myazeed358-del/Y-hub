import { mathEngine } from '@/utils/mathEngine';

export function evaluateCalculusAt(
  expression: string,
  variables: { x: number }
): number {
  return mathEngine.evaluateNumerically(
    expression,
    variables
  );
}
