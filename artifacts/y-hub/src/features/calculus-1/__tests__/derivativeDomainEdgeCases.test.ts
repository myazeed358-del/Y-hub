import { describe, expect, it } from 'vitest';
import { solveCalculus1Derivative } from '../services/calculus1Service';

describe('Derivative domain edge cases', () => {
  it('preserves the log restriction for ln(x-2)', () => {
    const result = solveCalculus1Derivative('ln(x-2)');

    expect(result.domain?.original.some(
      constraint =>
        constraint.kind === 'logarithm' &&
        constraint.condition.includes('> 0') &&
        constraint.expression.includes('2')
    )).toBe(true);

    expect(result.domain?.scope).toBe('constraints_only');
  });

  it('records restrictions for sqrt(x^2)', () => {
    const result = solveCalculus1Derivative('sqrt(x^2)');

    expect(result.domain?.original.some(
      constraint => constraint.kind === 'even_root'
    )).toBe(true);

    expect(result.domain?.scope).toBe('constraints_only');
  });

  it('does not falsely certify differentiability of abs(x^2)', () => {
    const result = solveCalculus1Derivative('abs(x^2)');

    expect(result.domain?.scope).toBe('constraints_only');
    expect(result.domain?.notes.some(
      note => note.includes('do not prove differentiability')
    )).toBe(true);
  });

  it('tracks restrictions for a shifted denominator', () => {
    const result = solveCalculus1Derivative('1/(x-2)');

    expect(result.domain?.original.some(
      constraint =>
        constraint.kind === 'denominator' &&
        constraint.condition.includes('!= 0')
    )).toBe(true);
  });

  it('does not invent restrictions for sin(x)', () => {
    const result = solveCalculus1Derivative('sin(x)');

    expect(result.domain?.original).toEqual([]);
    expect(result.domain?.derivativeFormula).toEqual([]);
  });
});
