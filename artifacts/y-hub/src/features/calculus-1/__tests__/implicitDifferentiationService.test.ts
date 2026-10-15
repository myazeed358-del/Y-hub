import { describe, expect, it } from 'vitest';
import * as math from 'mathjs';
import {
  solveCalculus1ImplicitDerivative
} from '../services/implicitDifferentiationService';

describe('Implicit differentiation', () => {
  it('solves the circle x^2+y^2=25', () => {
    const result = solveCalculus1ImplicitDerivative(
      'x^2+y^2=25'
    );

    expect(result.status).toBe('computed');

    expect(
      math.evaluate(result.expression!, {
        x: 3,
        y: 4
      })
    ).toBeCloseTo(-0.75, 9);

    expect(result.steps.some(
      step => step.id === 'implicit_chain_rule'
    )).toBe(true);
  });

  it('solves x*y=1', () => {
    const result = solveCalculus1ImplicitDerivative('x*y=1');

    expect(result.status).toBe('computed');

    expect(
      math.evaluate(result.expression!, {
        x: 2,
        y: 0.5
      })
    ).toBeCloseTo(-0.25, 9);
  });

  it('solves y^2=x', () => {
    const result = solveCalculus1ImplicitDerivative('y^2=x');

    expect(result.status).toBe('computed');

    expect(
      math.evaluate(result.expression!, {
        x: 4,
        y: 2
      })
    ).toBeCloseTo(0.25, 9);
  });

  it('reports unresolved when F_y is zero', () => {
    const result = solveCalculus1ImplicitDerivative('x^2=25');

    expect(result.status).toBe('unresolved');
    expect(result.expression).toBeUndefined();
  });

  it('requires an equation', () => {
    expect(() =>
      solveCalculus1ImplicitDerivative('x^2+y^2')
    ).toThrow();
  });

  it('does not claim support for non-polynomial equations', () => {
    expect(() =>
      solveCalculus1ImplicitDerivative('sin(x)+y=1')
    ).toThrow(/polynomial/);
  });

  it('does not support variable exponents yet', () => {
    expect(() =>
      solveCalculus1ImplicitDerivative('x^y=2')
    ).toThrow(/polynomial/);
  });
});
