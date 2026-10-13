import { describe, expect, it } from 'vitest';
import { countCompletedLessons } from '../domain/countCompletedLessons';

describe('countCompletedLessons', () => {
  it('returns zero for no lessons', () => {
    expect(countCompletedLessons([])).toBe(0);
  });

  it('counts fully completed lessons', () => {
    expect(countCompletedLessons([
      { progress: 100 },
      { progress: 55 },
      { progress: 100 },
    ])).toBe(2);
  });

  it('does not count incomplete lessons', () => {
    expect(countCompletedLessons([
      { progress: 99 },
      { progress: 0 },
    ])).toBe(0);
  });

  it('does not mutate the input', () => {
    const lessons = [{ progress: 100 }, { progress: 20 }];

    countCompletedLessons(lessons);

    expect(lessons).toEqual([
      { progress: 100 },
      { progress: 20 },
    ]);
  });
});
