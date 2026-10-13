import { describe, expect, it } from 'vitest';
import { sampleFunctionGraph } from '../domain/sampleFunctionGraph';

describe('sampleFunctionGraph', () => {
  it('samples the original 41 positions', () => {
    const points = sampleFunctionGraph(
      'x',
      (_expr, { x }) => x
    );

    expect(points).toHaveLength(41);
    expect(points[0]).toEqual({ x: -10, y: -10 });
    expect(points[40]).toEqual({ x: 10, y: 10 });
  });

  it('excludes invalid and excessively large values', () => {
    const points = sampleFunctionGraph(
      'x',
      (_expr, { x }) =>
        x === 0 ? NaN : x === 1 ? 100 : x
    );

    expect(points).toHaveLength(39);
    expect(
      points.some(p => p.x === 0 || p.x === 1)
    ).toBe(false);
  });

  it('preserves valid negative results', () => {
    const points = sampleFunctionGraph(
      'x',
      (_expr, { x }) => -Math.abs(x)
    );

    expect(points).toHaveLength(41);
    expect(
      points.every(p => p.y <= 0)
    ).toBe(true);
  });
});
