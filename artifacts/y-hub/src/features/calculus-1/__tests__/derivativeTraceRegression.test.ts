import { describe, expect, it } from 'vitest';
import * as math from 'mathjs';
import { solveCalculus1Derivative } from '../services/calculus1Service';
import { ASTUtils } from '@/services/math/symbolic/utils';
import type { MathStep } from '@/services/math/types/step';

const cases = [
  {
    input: 'sin(x^2)',
    expected: '2*x*cos(x^2)',
    points: [-1.2, 0.4, 1.6]
  },
  {
    input: 'exp(sin(x))',
    expected: 'exp(sin(x))*cos(x)',
    points: [-1.1, 0.5, 1.7]
  },
  {
    input: 'x^2*sin(x)',
    expected: '2*x*sin(x)+x^2*cos(x)',
    points: [-1.2, 0.5, 1.7]
  },
  {
    input: '(x^2+1)/(x+2)',
    expected: '(2*x*(x+2)-(x^2+1))/(x+2)^2',
    points: [-1.1, 0.4, 1.6]
  },
  {
    input: '(x^2+1)^3',
    expected: '6*x*(x^2+1)^2',
    points: [-1.1, 0.4, 1.6]
  },
  {
    input: 'sqrt(x^2+4)',
    expected: 'x/sqrt(x^2+4)',
    points: [-1.1, 0.4, 1.6]
  },
  {
    input: 'log(x^2+4)',
    expected: '2*x/(x^2+4)',
    points: [-1.1, 0.4, 1.6]
  },
  {
    input: 'x^x',
    expected: 'x^x*(log(x)+1)',
    points: [0.7, 1.3, 2.1]
  }
];

function evaluate(expression: string, x: number): number {
  const value = math.evaluate(expression, { x, ln: Math.log });

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(
      `Non-finite result for ${expression} at x=${x}`
    );
  }

  return value;
}

function expectClose(actual: number, expected: number) {
  const scale = Math.max(
    1,
    Math.abs(actual),
    Math.abs(expected)
  );

  expect(Math.abs(actual - expected))
    .toBeLessThan(0.0002 * scale);
}

function flatten(steps: readonly MathStep[]): MathStep[] {
  return steps.flatMap(step => [
    step,
    ...flatten(step.subSteps ?? [])
  ]);
}

describe('Calculus 1 derivative trace regression', () => {
  it('exports natural logarithms in MathJS-compatible syntax', () => {
    const result = solveCalculus1Derivative('x^x');

    expect(result.status).toBe('computed');
    expect(result.expression).toBeDefined();

    expect(result.expression).toMatch(/\blog\s*\(/);
    expect(result.expression).not.toMatch(/\bln\s*\(/);

    const x = 1.3;

    const actual = math.evaluate(
      result.expression!,
      { x }
    ) as number;

    const expected = x ** x * (Math.log(x) + 1);

    expect(actual).toBeCloseTo(expected, 8);
  });

  it.each(cases)(
    'checks final answer and generated steps: $input',
    ({ input, expected, points }) => {
      const result = solveCalculus1Derivative(input);

      expect(result.status).toBe('computed');
      expect(result.expression).toBeDefined();

      for (const x of points) {
        expectClose(
          evaluate(result.expression!, x),
          evaluate(expected, x)
        );
      }

      const derivations = flatten(result.steps)
        .flatMap(step =>
          step.derivation ? [step.derivation] : []
        );

      expect(derivations.length).toBeGreaterThan(0);

      for (const derivation of derivations) {
        expect(derivation.verification).toBe('not_proven');

        const before = ASTUtils.serialize(
          derivation.input
        );

        const after = ASTUtils.serialize(
          derivation.output
        );

        for (const x of points) {
          const h = 0.00001;

          const numerical =
            (evaluate(before, x + h) -
             evaluate(before, x - h)) / (2 * h);

          expectClose(
            evaluate(after, x),
            numerical
          );
        }
      }
    }
  );
});
