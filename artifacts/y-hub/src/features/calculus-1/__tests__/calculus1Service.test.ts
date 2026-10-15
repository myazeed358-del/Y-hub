import { describe, expect, it } from 'vitest';
import * as math from 'mathjs';
import {
  solveCalculus1Derivative,
  solveCalculus1Limit,
} from '../services/calculus1Service';

describe('Calculus 1 internal engine integration', () => {
  it('solves the standard trigonometric limit', () => {
    const result = solveCalculus1Limit('sin(x)/x', '0', 'both');
    expect(result.status).toBe('computed');
    expect(result.latex).toBe('1');
  });

  it('differentiates x squared using the local engine', () => {
    const result = solveCalculus1Derivative('x^2');
    expect(result.status).toBe('computed');
    expect(result.expression).toBeDefined();
    expect(
      math.evaluate(result.expression!, { x: 3 })
    ).toBeCloseTo(6, 8);
  });

  it('preserves native derivative steps', () => {
    const result = solveCalculus1Derivative('x^2');

    expect(result.steps.length).toBeGreaterThan(0);
    expect(result.steps.some(
      step => step.id === 'power_rule'
    )).toBe(true);
  });

  it('preserves nested one-sided limit steps', () => {
    const result = solveCalculus1Limit(
      'sin(x)/x', '0', 'both'
    );

    const split = result.steps.find(
      step => step.title === 'Two-Sided Limit Analysis'
    );

    expect(split?.subSteps).toHaveLength(2);
    expect(split?.subSteps?.[0]?.subSteps).toBeDefined();
    expect(split?.subSteps?.[1]?.subSteps).toBeDefined();
  });

  it('records structured chain-rule derivation', () => {
    const result = solveCalculus1Derivative('(x^2+1)^3');

    const power = result.steps.find(
      step => step.id === 'power_rule'
    );

    expect(power?.derivation?.kind).toBe('derivative');
    expect(power?.derivation?.verification).toBe('not_proven');
    expect(power?.subSteps?.some(
      step => step.id === 'sum_rule'
    )).toBe(true);

    expect(
      math.evaluate(result.expression!, { x: 2 })
    ).toBeCloseTo(300, 8);
  });

  it.each([
    {
      name: 'product',
      expression: 'x^2*sin(x)',
      ruleId: 'product_rule',
      x: 1.2
    },
    {
      name: 'quotient',
      expression: '(x^2+1)/(x+1)',
      ruleId: 'quotient_rule',
      x: 2
    }
  ])(
    'records structured product and quotient steps: $name',
    ({ expression, ruleId, x }) => {
      const result = solveCalculus1Derivative(expression);

      expect(result.status).toBe('computed');
      expect(result.expression).toBeDefined();

      const ruleStep = result.steps.find(
        step => step.id === ruleId
      );

      expect(ruleStep?.derivation?.kind).toBe('derivative');
      expect(ruleStep?.derivation?.verification).toBe(
        'not_proven'
      );
      expect(ruleStep?.subSteps?.length).toBeGreaterThan(0);

      const h = 0.00001;

      const evaluateOriginal = (point: number): number =>
        math.evaluate(expression, { x: point }) as number;

      const numericalDerivative =
        (evaluateOriginal(x + h) -
          evaluateOriginal(x - h)) / (2 * h);

      const engineDerivative = math.evaluate(
        result.expression!,
        { x }
      ) as number;

      expect(engineDerivative).toBeCloseTo(
        numericalDerivative,
        5
      );
    }
  );

  it.each([
    {
      expression: 'sin(x^2)',
      rule: 'chain_rule_sin',
      child: 'power_rule',
      x: 1.2
    },
    {
      expression: 'exp(sin(x))',
      rule: 'chain_rule_exp',
      child: 'chain_rule_sin',
      x: 0.4
    }
  ])(
    'records nested function chain-rule steps: $expression',
    ({ expression, rule, child, x }) => {
      const result = solveCalculus1Derivative(expression);

      expect(result.status).toBe('computed');
      expect(result.expression).toBeDefined();

      const step = result.steps.find(
        item => item.id === rule
      );

      expect(step?.derivation?.kind).toBe('derivative');
      expect(step?.derivation?.verification).toBe('not_proven');
      expect(step?.subSteps?.some(
        item => item.id === child
      )).toBe(true);

      const h = 0.00001;
      const f = (value: number): number =>
        math.evaluate(expression, { x: value }) as number;

      const numerical =
        (f(x + h) - f(x - h)) / (2 * h);

      const symbolic = math.evaluate(
        result.expression!,
        { x }
      ) as number;

      expect(symbolic).toBeCloseTo(numerical, 5);
    }
  );

  it('rejects empty expressions', () => {
    expect(() => solveCalculus1Derivative('')).toThrow();
    expect(() => solveCalculus1Limit('', '0', 'both')).toThrow();
  });

  it('rejects equations in the basic derivative tool', () => {
    expect(() =>
      solveCalculus1Derivative('x^2 = 1')
    ).toThrow();
  });
});
