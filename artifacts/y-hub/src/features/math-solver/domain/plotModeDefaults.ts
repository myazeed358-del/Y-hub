import type { PlotMode } from '../types';

const DEFAULT_EXPRESSIONS: Record<PlotMode, string> = {
  surface: 'x^2 - y^2',
  parametric: 'cos(t), sin(t), t',
  vector: '-y, x, z',
};

export function getDefaultPlotExpression(
  mode: PlotMode
): string {
  return DEFAULT_EXPRESSIONS[mode];
}
