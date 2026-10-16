import { describe, expect, it } from 'vitest';
import { solveCalculus1Derivative } from '../services/calculus1Service';

describe('Derivative domain safety', () => {
  it('reports strict log-domain restrictions', () => {
    const result = solveCalculus1Derivative('ln(x)');

    expect(result.domain?.scope).toBe('constraints_only');
    expect(result.domain?.original.some(
      c => c.kind === 'logarithm' &&
           c.condition.includes('> 0')
    )).toBe(true);

    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('distinguishes sqrt input and derivative constraints', () => {
    const result = solveCalculus1Derivative('sqrt(x)');

    expect(result.domain?.original.some(
      c => c.kind === 'even_root'
    )).toBe(true);

    expect(result.domain?.derivativeFormula.some(
      c => c.kind === 'denominator'
    )).toBe(true);
  });

  it('records absolute-value derivative formula restrictions', () => {
    const result = solveCalculus1Derivative('abs(x)');

    expect(result.domain?.derivativeFormula.some(
      c => c.kind === 'denominator'
    )).toBe(true);
  });

  it('records denominator restrictions', () => {
    const result = solveCalculus1Derivative('1/x');

    expect(result.domain?.original.some(
      c => c.kind === 'denominator'
    )).toBe(true);
  });

  it('records sufficient positive-base assumption for x^x', () => {
    const result = solveCalculus1Derivative('x^x');

    expect(result.domain?.original.some(
      c => c.kind === 'general_real_power' &&
           c.strength === 'sufficient'
    )).toBe(true);
  });

  it('does not invent restrictions for ordinary polynomials', () => {
    const result = solveCalculus1Derivative('x^2+3*x');

    expect(result.domain?.original).toEqual([]);
    expect(result.domain?.derivativeFormula).toEqual([]);
  });

  it('does not claim a complete differentiability domain', () => {
    const result = solveCalculus1Derivative('abs(x^2)');

    expect(result.domain?.scope).toBe('constraints_only');
    expect(result.domain?.notes.length).toBeGreaterThan(0);
  });
});
