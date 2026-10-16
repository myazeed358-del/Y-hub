import { describe, expect, it } from 'vitest';
import * as math from 'mathjs';
import {
  solveCalculus1HigherOrderDerivative as solve
} from '../services/higherOrderDerivativeService';

describe('Higher-order derivatives', () => {
  it('computes the second derivative of x^4', () => {
    const result = solve('x^4', 2);

    expect(result.status).toBe('computed');
    expect(
      math.evaluate(result.expression!, { x: 2 })
    ).toBeCloseTo(48, 8);

    expect(result.steps).toHaveLength(2);
  });

  it('computes the third derivative of x^4', () => {
    const result = solve('x^4', 3);

    expect(
      math.evaluate(result.expression!, { x: 2 })
    ).toBeCloseTo(48, 8);

    expect(result.steps).toHaveLength(3);
    expect(result.steps[2].title).toBe(
      'Derivative order 3'
    );
  });

  it('computes the second derivative of sin(x)', () => {
    const result = solve('sin(x)', 2);
    const x = 0.7;

    expect(
      math.evaluate(result.expression!, { x })
    ).toBeCloseTo(-Math.sin(x), 8);
  });

  it('computes the third derivative of x^2', () => {
    const result = solve('x^2', 3);

    expect(
      math.evaluate(result.expression!, { x: 4 })
    ).toBeCloseTo(0, 8);
  });

  it('preserves derivation steps for every order', () => {
    const result = solve('x^4+sin(x)', 2);

    expect(result.steps).toHaveLength(2);

    for (const step of result.steps) {
      expect(step.subSteps?.length).toBeGreaterThan(0);
    }
  });

  it.each([0, -1, 7, 1.5, NaN, Infinity])(
    'rejects invalid order %s',
    order => {
      expect(() => solve('x^4', order)).toThrow(
        /Derivative order/
      );
    }
  );

  it('rejects equations', () => {
    expect(() => solve('x^2=4', 2)).toThrow(
      /function/
    );
  });
});
