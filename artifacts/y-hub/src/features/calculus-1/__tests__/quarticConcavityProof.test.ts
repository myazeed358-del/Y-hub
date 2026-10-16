import { describe, expect, it } from 'vitest';
import {
  proveQuarticConcavity as prove
} from '../services/quarticConcavityProof';

describe('Exact quartic concavity proof', () => {
  it('proves irrational inflection points of x^4-x^2', () => {
    const result = prove('x^4-x^2');

    expect(result.status).toBe('verified');
    if (result.status !== 'verified') return;

    expect(result.inflectionPoints).toEqual([
      {
        x: '-(1/24)*sqrt(96)',
        y: '-5/36'
      },
      {
        x: '(1/24)*sqrt(96)',
        y: '-5/36'
      }
    ]);

    expect(result.concaveUpIntervals).toEqual([
      '(-infinity, -(1/24)*sqrt(96))',
      '((1/24)*sqrt(96), +infinity)'
    ]);

    expect(result.concaveDownIntervals).toEqual([
      '(-(1/24)*sqrt(96), (1/24)*sqrt(96))'
    ]);
  });

  it('calculates exact quartic inflection values', () => {
    const result = prove('x^4-2*x^2');

    expect(result.status).toBe('verified');
    if (result.status !== 'verified') return;

    expect(result.inflectionPoints).toEqual([
      { x: '-(1/24)*sqrt(192)', y: '-5/9' },
      { x: '(1/24)*sqrt(192)', y: '-5/9' }
    ]);
  });

  it('handles rational inflection roots', () => {
    const result = prove('x^4+x^3');

    expect(result.status).toBe('verified');
    if (result.status !== 'verified') return;

    expect(result.inflectionPoints).toEqual([
      { x: '-1/2', y: '-1/16' },
      { x: '0', y: '0' }
    ]);
  });

  it('proves positive concavity without inflections', () => {
    const result = prove('x^4+x^2');

    expect(result.status).toBe('verified');
    if (result.status !== 'verified') return;

    expect(result.concaveUpIntervals).toEqual([
      '(-infinity, +infinity)'
    ]);

    expect(result.concaveDownIntervals).toEqual([]);
    expect(result.inflectionPoints).toEqual([]);
  });

  it('proves negative concavity without inflections', () => {
    const result = prove('-x^4-x^2');

    expect(result.status).toBe('verified');
    if (result.status !== 'verified') return;

    expect(result.concaveDownIntervals).toEqual([
      '(-infinity, +infinity)'
    ]);

    expect(result.inflectionPoints).toEqual([]);
  });

  it('does not treat repeated f-second root as inflection', () => {
    const result = prove('x^4');

    expect(result.status).toBe('verified');
    if (result.status !== 'verified') return;

    expect(result.concaveUpIntervals).toEqual([
      '(-infinity, +infinity)'
    ]);

    expect(result.inflectionPoints).toEqual([]);
  });

  it('handles repeated second derivative root with linear term', () => {
    const result = prove('x^4+x');

    expect(result.status).toBe('verified');
    if (result.status !== 'verified') return;

    expect(result.inflectionPoints).toEqual([]);
  });

  it('handles a quartic with two shifted irrational roots', () => {
    const result = prove('x^4+2*x^3+x^2');

    expect(result.status).toBe('verified');
    if (result.status !== 'verified') return;

    expect(result.inflectionPoints).toHaveLength(2);
    expect(result.inflectionPoints[0].x).toBe(
      '-1/2-(1/24)*sqrt(48)'
    );
    expect(result.inflectionPoints[1].x).toBe(
      '-1/2+(1/24)*sqrt(48)'
    );
  });

  it.each([
    'x^3',
    'x^5',
    'sin(x)',
    '1/x',
    'x^4+y',
    'x^4=1',
    'x^4-x^4+2*x'
  ])('rejects functions outside its exact quartic scope: %s', expression => {
    expect(prove(expression).status).toBe('unsupported');
  });
});
