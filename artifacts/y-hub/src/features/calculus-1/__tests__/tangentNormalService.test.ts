import { describe, expect, it } from 'vitest';
import {
  solveCalculus1TangentNormal as solve
} from '../services/tangentNormalService';

describe('Exact tangent and normal lines', () => {
  it('finds tangent and normal to x^2 at x=3', () => {
    const result = solve('x^2', '3');

    expect(result.status).toBe('computed');
    expect(result.latex).toContain('Tangent:');
    expect(result.latex).toContain('Normal:');
    expect(result.latex).toContain('9');
    expect(result.latex).toContain('6');
    expect(result.steps).toHaveLength(4);
    expect(result.steps[1].explanation).toContain(
      'f\'(x) = 6'
    );
    expect(result.steps[3].explanation).toContain('-1/6');
  });

  it('handles a horizontal tangent', () => {
    const result = solve('x^2', '0');

    expect(result.status).toBe('computed');
    expect(result.steps[2].explanation).toContain('y = 0');
    expect(result.steps[3].explanation).toContain('x = 0');
  });

  it('supports negative input points', () => {
    const result = solve('x^2', '-2');

    expect(result.steps[1].explanation).toContain(
      "f'(x) = -4"
    );
  });

  it('retains exact decimal slopes', () => {
    const result = solve('0.5*x', '2');

    expect(result.steps[1].explanation).toContain(
      "f'(x) = 1/2"
    );
    expect(result.steps[3].explanation).toContain('-2');
  });

  it('rejects non-polynomial expressions', () => {
    expect(() => solve('sin(x)', '1')).toThrow(
      /polynomials/
    );
  });

  it('rejects missing or invalid points', () => {
    expect(() => solve('x^2', '')).toThrow();
    expect(() => solve('x^2', 'abc')).toThrow();
  });

  it('rejects equations', () => {
    expect(() => solve('x^2=9', '3')).toThrow(
      /polynomials/
    );
  });
});
