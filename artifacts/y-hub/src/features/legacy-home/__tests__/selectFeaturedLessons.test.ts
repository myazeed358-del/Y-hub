import { describe, expect, it } from 'vitest';
import { selectFeaturedLessons } from '../domain/selectFeaturedLessons';

describe('selectFeaturedLessons', () => {
  const lessons = ['A', 'B', 'C', 'D', 'E', 'F'];

  it('selects four lessons by default', () => {
    expect(selectFeaturedLessons(lessons))
      .toEqual(['A', 'B', 'C', 'D']);
  });

  it('preserves the original order', () => {
    expect(selectFeaturedLessons(lessons, 2))
      .toEqual(['A', 'B']);
  });

  it('handles empty collections', () => {
    expect(selectFeaturedLessons([])).toEqual([]);
  });

  it('does not mutate the input', () => {
    const input = ['A', 'B', 'C'];

    selectFeaturedLessons(input, 2);

    expect(input).toEqual(['A', 'B', 'C']);
  });
});
