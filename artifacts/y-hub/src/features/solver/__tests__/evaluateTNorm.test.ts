import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  evaluateTNorm,
  normalizeMembershipInput,
} from '../domain/evaluateTNorm';

describe('normalizeMembershipInput', () => {
  it('keeps inputs inside the unit interval', () => {
    expect(normalizeMembershipInput('0.5')).toBe(0.5);
    expect(normalizeMembershipInput('-2')).toBe(0);
    expect(normalizeMembershipInput('5')).toBe(1);
  });

  it('preserves empty and invalid input behavior', () => {
    expect(normalizeMembershipInput('')).toBe(0);
    expect(normalizeMembershipInput('abc')).toBe(0);
  });
});

describe('evaluateTNorm', () => {
  it('calculates standard intersection', () => {
    const value = evaluateTNorm(
      0.4,
      0.8,
      'standard',
      false
    );

    expect(value.result).toBe(0.4);
    expect(value.proof).toContain('0.4');
  });

  it('calculates algebraic intersection', () => {
    const value = evaluateTNorm(
      0.4,
      0.8,
      'algebraic',
      false
    );

    expect(value.result).toBeCloseTo(0.32);
  });

  it('calculates bounded intersection', () => {
    const value = evaluateTNorm(
      0.4,
      0.8,
      'bounded',
      false
    );

    expect(value.result).toBeCloseTo(0.2);
  });

  it('calculates drastic intersection', () => {
    expect(
      evaluateTNorm(0.4, 0.8, 'drastic', false).result
    ).toBe(0);

    expect(
      evaluateTNorm(1, 0.6, 'drastic', false).result
    ).toBe(0.6);
  });

  it('preserves Arabic and English explanations', () => {
    const ar = evaluateTNorm(
      0.5, 0.5, 'drastic', true
    );

    const en = evaluateTNorm(
      0.5, 0.5, 'drastic', false
    );

    expect(ar.proof).not.toBe(en.proof);
  });
});
