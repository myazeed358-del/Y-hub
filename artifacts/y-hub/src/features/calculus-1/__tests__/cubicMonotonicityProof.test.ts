import { describe, expect, it } from 'vitest';
import {
  proveCubicMonotonicity as prove
} from '../services/cubicMonotonicityProof';

describe('Exact cubic monotonicity', () => {
  it('proves both extrema for x^3-3x', () => {
    const result = prove('x^3-3*x');

    expect(result.status).toBe('verified');
    if (result.status !== 'verified') return;

    expect(result.criticalPoints).toEqual(['-1', '1']);

    expect(result.increasingIntervals).toEqual([
      '(-infinity, -1)',
      '(1, +infinity)'
    ]);

    expect(result.decreasingIntervals).toEqual([
      '(-1, 1)'
    ]);

    expect(result.extrema).toEqual([
      { type: 'local_maximum', x: '-1', y: '2' },
      { type: 'local_minimum', x: '1', y: '-2' }
    ]);
  });

  it('reverses signs for a negative-leading cubic', () => {
    const result = prove('-x^3+3*x');

    expect(result.status).toBe('verified');
    if (result.status !== 'verified') return;

    expect(result.extrema).toEqual([
      { type: 'local_minimum', x: '-1', y: '-2' },
      { type: 'local_maximum', x: '1', y: '2' }
    ]);
  });

  it('proves global increase when derivative has no roots', () => {
    const result = prove('x^3+x');

    expect(result.status).toBe('verified');
    if (result.status !== 'verified') return;

    expect(result.criticalPoints).toEqual([]);
    expect(result.extrema).toEqual([]);
    expect(result.increasingIntervals).toEqual([
      '(-infinity, +infinity)'
    ]);
  });

  it('proves global decrease for -x^3-x', () => {
    const result = prove('-x^3-x');

    expect(result.status).toBe('verified');
    if (result.status !== 'verified') return;

    expect(result.decreasingIntervals).toEqual([
      '(-infinity, +infinity)'
    ]);
  });

  it('does not mistake a repeated stationary root for extrema', () => {
    const result = prove('x^3');

    expect(result.status).toBe('verified');
    if (result.status !== 'verified') return;

    expect(result.criticalPoints).toEqual(['0']);
    expect(result.extrema).toEqual([]);
    expect(result.increasingIntervals).toEqual([
      '(-infinity, +infinity)'
    ]);
  });

  it('handles a shifted repeated stationary point', () => {
    const result = prove('(x-1)^3');

    expect(result.status).toBe('verified');
    if (result.status !== 'verified') return;

    expect(result.criticalPoints).toEqual(['1']);
    expect(result.extrema).toEqual([]);
  });

  it('preserves exact fractional roots and values', () => {
    const result = prove('x^3-0.75*x');

    expect(result.status).toBe('verified');
    if (result.status !== 'verified') return;

    expect(result.criticalPoints).toEqual([
      '-1/2', '1/2'
    ]);

    expect(result.extrema).toEqual([
      { type: 'local_maximum', x: '-1/2', y: '1/4' },
      { type: 'local_minimum', x: '1/2', y: '-1/4' }
    ]);
  });

  it('proves irrational roots and values without rounding', () => {
    const result = prove('x^3-x');

    expect(result.status).toBe('verified');
    if (result.status !== 'verified') return;

    expect(result.criticalPoints).toEqual([
      '-(1/6)*sqrt(12)',
      '(1/6)*sqrt(12)'
    ]);

    expect(result.extrema).toEqual([
      {
        type: 'local_maximum',
        x: '-(1/6)*sqrt(12)',
        y: '(1/9)*sqrt(12)'
      },
      {
        type: 'local_minimum',
        x: '(1/6)*sqrt(12)',
        y: '-(1/9)*sqrt(12)'
      }
    ]);

    expect(result.increasingIntervals).toHaveLength(2);
    expect(result.decreasingIntervals).toHaveLength(1);
  });

  it('orders roots correctly for a negative cubic', () => {
    const result = prove('-x^3+x');

    expect(result.status).toBe('verified');
    if (result.status !== 'verified') return;

    expect(result.extrema.map(item => item.type)).toEqual([
      'local_minimum',
      'local_maximum'
    ]);

    expect(result.criticalPoints).toEqual([
      '-(1/6)*sqrt(12)',
      '(1/6)*sqrt(12)'
    ]);
  });

  it('keeps exact irrational roots with nonzero quadratic term', () => {
    const result = prove('x^3+3*x^2+x');

    expect(result.status).toBe('verified');
    if (result.status !== 'verified') return;

    expect(result.criticalPoints).toEqual([
      '-1-(1/6)*sqrt(24)',
      '-1+(1/6)*sqrt(24)'
    ]);

    expect(result.extrema).toHaveLength(2);
  });

  it.each([
    {
      expression: 'x^3-3*x',
      x: '0',
      y: '0',
      up: '(0, +infinity)',
      down: '(-infinity, 0)'
    },
    {
      expression: '-x^3+3*x',
      x: '0',
      y: '0',
      up: '(-infinity, 0)',
      down: '(0, +infinity)'
    },
    {
      expression: 'x^3+3*x^2+x',
      x: '-1',
      y: '1',
      up: '(-1, +infinity)',
      down: '(-infinity, -1)'
    },
    {
      expression: 'x^3',
      x: '0',
      y: '0',
      up: '(0, +infinity)',
      down: '(-infinity, 0)'
    }
  ])(
    'proves exact concavity for $expression',
    ({ expression, x, y, up, down }) => {
      const result = prove(expression);

      expect(result.status).toBe('verified');
      if (result.status !== 'verified') return;

      expect(result.concaveUpIntervals).toEqual([up]);
      expect(result.concaveDownIntervals).toEqual([down]);
      expect(result.inflectionPoints).toEqual([{ x, y }]);
    }
  );

  it.each([
    'x^2',
    'x^4',
    'sin(x)',
    '1/x',
    'x^3+y',
    'x^3=1',
    'x^3-x^3+2*x'
  ])('does not fabricate a cubic proof for %s', expression => {
    expect(prove(expression).status).toBe('unsupported');
  });
});
