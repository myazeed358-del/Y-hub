import { describe, expect, it } from 'vitest';
import { getDefaultPlotExpression } from '../domain/plotModeDefaults';

describe('getDefaultPlotExpression', () => {
  it('returns the surface expression', () => {
    expect(
      getDefaultPlotExpression('surface')
    ).toBe('x^2 - y^2');
  });

  it('returns the parametric expression', () => {
    expect(
      getDefaultPlotExpression('parametric')
    ).toBe('cos(t), sin(t), t');
  });

  it('returns the vector field expression', () => {
    expect(
      getDefaultPlotExpression('vector')
    ).toBe('-y, x, z');
  });
});
