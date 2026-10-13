import type { GraphPoint } from '../types';

export type NumericEvaluator = (
  expression: string,
  variables: { x: number }
) => number;

export function sampleFunctionGraph(
  expression: string,
  evaluate: NumericEvaluator
): GraphPoint[] {
  const data: GraphPoint[] = [];

  for (let x = -10; x <= 10; x += 0.5) {
    const y = evaluate(expression, { x });

    if (!isNaN(y) && Math.abs(y) < 100) {
      data.push({ x, y });
    }
  }

  return data;
}
