import { describe, expect, it } from 'vitest';
import {
  proveExactIntercepts
} from '../services/exactInterceptProof';

describe('Calculus 1 exact intercept proof V1', () => {
  it.each([
    ['x^2-4', '-4', ['-2', '2']],
    ['x^2+1', '1', []],
    ['x^2-2*x+1', '1', ['1']],
    ['(x-2)*(x+3)', '-6', ['-3', '2']],
    ['2*x+4', '4', ['-2']],
    ['-3*x+1', '1', ['1/3']],
    ['x', '0', ['0']],
    ['x^2', '0', ['0']],
    ['-2*x^2+8', '8', ['-2', '2']],
    ['7', '7', []],
    ['0*x+4', '4', []],
    ['x^2-1/4', '-1/4', ['-1/2', '1/2']],
    ['0.5*x^2-2', '-2', ['-2', '2']],
    ['(x^2+1)/2', '1/2', []],
    ['x^2+x', '0', ['-1', '0']],
    ['x^2-4*x+4', '4', ['2']]
  ])(
    'certifies both-axis intercepts for %s',
    (expression, y, roots) => {
      const result = proveExactIntercepts(expression);

      expect(result.status).toBe('verified');
      if (result.status !== 'verified') return;

      expect(result.yIntercept).toEqual({
        x: '0',
        y
      });

      expect(result.xIntercepts).toEqual({
        kind: 'finite',
        roots
      });

      expect(result.steps.length).toBeGreaterThan(0);
    }
  );

  it('recognizes every x as a root of f(x)=0', () => {
    const result = proveExactIntercepts('0');

    expect(result.status).toBe('verified');
    if (result.status !== 'verified') return;

    expect(result.xIntercepts).toEqual({
      kind: 'all_real'
    });

    expect(result.yIntercept.y).toBe('0');
  });

  it.each([
    'sqrt(x)',
    'sin(x)',
    '1/x',
    '1/(x-1)',
    '(x^2-1)/(x-1)',
    'x^3-1',
    'x^4-1',
    'x^2+y',
    'x^2=1',
    'x^x',
    ''
  ])('refuses incomplete root certification for %s', expression => {
    expect(proveExactIntercepts(expression).status)
      .toBe('unsupported');
  });

  it('includes a discriminant proof for quadratics', () => {
    const result = proveExactIntercepts('x^2-4');

    expect(result.status).toBe('verified');
    if (result.status !== 'verified') return;

    expect(result.steps.some(
      item => item.id === 'intercept_quadratic_discriminant'
    )).toBe(true);

    expect(result.steps.some(
      item => item.id === 'intercept_two_rational_roots'
    )).toBe(true);
  });
});
