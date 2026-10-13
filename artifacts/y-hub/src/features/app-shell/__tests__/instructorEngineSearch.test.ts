import {
  describe,
  expect,
  it,
} from 'vitest';

import { searchEngines } from '@/config/majorEngineAccess';
import {
  resolveInstructorEngineSearch,
} from '../domain/instructorEngineSearch';

describe('resolveInstructorEngineSearch', () => {
  it('returns matching engines for an instructor', () => {
    const result = resolveInstructorEngineSearch(
      'instructor',
      'calculus',
      'en'
    );

    expect(result.instructorSearchResults).toEqual(
      searchEngines('calculus', 'en').slice(0, 6)
    );
    expect(result.instructorSearchResults.length)
      .toBeGreaterThan(0);
  });

  it('preserves the six-result limit', () => {
    const result = resolveInstructorEngineSearch(
      'instructor',
      'a',
      'en'
    );

    expect(result.instructorSearchResults.length)
      .toBeLessThanOrEqual(6);
  });

  it('does not expose instructor results to students', () => {
    const result = resolveInstructorEngineSearch(
      'student',
      'calculus',
      'en'
    );

    expect(result.instructorSearchResults).toEqual([]);
    expect(result.quickPracticeSearchMatch).toBe(false);
  });

  it('does not expose instructor results to admins', () => {
    const result = resolveInstructorEngineSearch(
      'admin',
      'calculus',
      'ar'
    );

    expect(result.instructorSearchResults).toEqual([]);
  });

  it('keeps the original super-admin restriction', () => {
    const result = resolveInstructorEngineSearch(
      'super_admin',
      'quiz',
      'en'
    );

    expect(result.instructorSearchResults).toEqual([]);
    expect(result.quickPracticeSearchMatch).toBe(false);
  });

  it('handles an empty query', () => {
    const result = resolveInstructorEngineSearch(
      'instructor',
      '',
      'en'
    );

    expect(result.instructorSearchResults).toEqual([]);
    expect(result.quickPracticeSearchMatch).toBe(false);
  });

  it('recognizes quiz searches', () => {
    expect(
      resolveInstructorEngineSearch(
        'instructor',
        'quiz',
        'en'
      ).quickPracticeSearchMatch
    ).toBe(true);
  });

  it('preserves partial keyword matching', () => {
    expect(
      resolveInstructorEngineSearch(
        'instructor',
        'qu',
        'en'
      ).quickPracticeSearchMatch
    ).toBe(true);
  });

  it('recognizes Arabic quick-practice terms', () => {
    for (const query of [
      'تدريب',
      'اختبار',
      'أسئلة',
    ]) {
      expect(
        resolveInstructorEngineSearch(
          'instructor',
          query,
          'ar'
        ).quickPracticeSearchMatch
      ).toBe(true);
    }
  });

  it('normalizes uppercase and whitespace', () => {
    expect(
      resolveInstructorEngineSearch(
        'instructor',
        '  QUIZ  ',
        'en'
      ).quickPracticeSearchMatch
    ).toBe(true);
  });

  it('does not match unrelated terms', () => {
    expect(
      resolveInstructorEngineSearch(
        'instructor',
        'unrelated-subject-xyz',
        'en'
      ).quickPracticeSearchMatch
    ).toBe(false);
  });

  it('preserves Arabic catalog search in English UI', () => {
    const result = resolveInstructorEngineSearch(
      'instructor',
      'تفاضل',
      'en'
    );

    expect(result.instructorSearchResults).toEqual(
      searchEngines('تفاضل', 'en').slice(0, 6)
    );
  });
});
