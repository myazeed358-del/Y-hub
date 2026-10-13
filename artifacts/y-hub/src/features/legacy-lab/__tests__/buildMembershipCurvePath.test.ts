import { describe, expect, it } from 'vitest';
import { buildMembershipCurvePath } from '../domain/buildMembershipCurvePath';

const params = {
  a: 20,
  b: 45,
  c: 72,
  d: 88,
  center: 55,
  spread: 16,
};

describe('membership SVG path', () => {
  it('contains 101 sample positions', () => {
    const path = buildMembershipCurvePath(
      'triangle',
      params
    );

    expect(path.startsWith('M 10 194')).toBe(true);
    expect(path.split(' L ')).toHaveLength(101);
  });

  it('keeps the original path end', () => {
    expect(
      buildMembershipCurvePath('trapezoid', params)
        .endsWith('L 400 194')
    ).toBe(true);
  });

  it('supports gaussian sampling', () => {
    expect(
      buildMembershipCurvePath('gaussian', params)
    ).toContain(' L ');
  });

  it('does not mutate parameters', () => {
    const original = { ...params };

    buildMembershipCurvePath('triangle', params);

    expect(params).toEqual(original);
  });
});
