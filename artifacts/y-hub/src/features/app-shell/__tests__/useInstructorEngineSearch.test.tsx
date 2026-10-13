import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest';

import {
  act,
  cleanup,
  renderHook,
} from '@testing-library/react';

import {
  searchEngines,
} from '@/config/majorEngineAccess';

import {
  useInstructorEngineSearch,
} from '../hooks/useInstructorEngineSearch';

afterEach(() => {
  cleanup();
});

describe('useInstructorEngineSearch', () => {
  it('starts with an empty search', () => {
    const { result } = renderHook(() =>
      useInstructorEngineSearch('instructor', 'ar')
    );

    expect(result.current.engineSearch).toBe('');
    expect(result.current.instructorSearchResults)
      .toEqual([]);
    expect(result.current.quickPracticeSearchMatch)
      .toBe(false);
  });

  it('updates search input and results', () => {
    const { result } = renderHook(() =>
      useInstructorEngineSearch('instructor', 'en')
    );

    act(() => {
      result.current.setEngineSearch('calculus');
    });

    expect(result.current.engineSearch).toBe('calculus');

    expect(result.current.instructorSearchResults).toEqual(
      searchEngines('calculus', 'en').slice(0, 6)
    );

    expect(
      result.current.instructorSearchResults.length
    ).toBeGreaterThan(0);
  });

  it('preserves the six-result limit', () => {
    const { result } = renderHook(() =>
      useInstructorEngineSearch('instructor', 'en')
    );

    act(() => {
      result.current.setEngineSearch('a');
    });

    expect(
      result.current.instructorSearchResults.length
    ).toBeLessThanOrEqual(6);
  });

  it('recognizes quick practice searches', () => {
    const { result } = renderHook(() =>
      useInstructorEngineSearch('instructor', 'en')
    );

    act(() => {
      result.current.setEngineSearch('quiz');
    });

    expect(result.current.quickPracticeSearchMatch)
      .toBe(true);
  });

  it('supports Arabic engine searches', () => {
    const { result } = renderHook(() =>
      useInstructorEngineSearch('instructor', 'ar')
    );

    act(() => {
      result.current.setEngineSearch('تفاضل');
    });

    expect(result.current.instructorSearchResults).toEqual(
      searchEngines('تفاضل', 'ar').slice(0, 6)
    );

    expect(
      result.current.instructorSearchResults.length
    ).toBeGreaterThan(0);
  });

  it('preserves restrictions for other roles', () => {
    for (const role of [
      'student',
      'admin',
      'super_admin',
    ]) {
      const { result, unmount } = renderHook(() =>
        useInstructorEngineSearch(role, 'en')
      );

      act(() => {
        result.current.setEngineSearch('quiz');
      });

      expect(result.current.instructorSearchResults)
        .toEqual([]);

      expect(result.current.quickPracticeSearchMatch)
        .toBe(false);

      unmount();
    }
  });

  it('updates results when the role changes', () => {
    const { result, rerender } = renderHook(
      ({ role }: {
        role: 'instructor' | 'student';
      }) => useInstructorEngineSearch(role, 'en'),
      {
        initialProps: {
          role: 'instructor' as 'instructor' | 'student',
        },
      }
    );

    act(() => {
      result.current.setEngineSearch('quiz');
    });

    expect(result.current.quickPracticeSearchMatch)
      .toBe(true);

    rerender({ role: 'student' });

    expect(result.current.engineSearch).toBe('quiz');
    expect(result.current.quickPracticeSearchMatch)
      .toBe(false);

    rerender({ role: 'instructor' });

    expect(result.current.quickPracticeSearchMatch)
      .toBe(true);
  });

  it('updates results when the language changes', () => {
    const { result, rerender } = renderHook(
      ({ language }: {
        language: 'ar' | 'en';
      }) => useInstructorEngineSearch(
        'instructor',
        language
      ),
      {
        initialProps: {
          language: 'en' as 'ar' | 'en',
        },
      }
    );

    act(() => {
      result.current.setEngineSearch('تفاضل');
    });

    rerender({ language: 'ar' });

    expect(result.current.engineSearch).toBe('تفاضل');

    expect(result.current.instructorSearchResults).toEqual(
      searchEngines('تفاضل', 'ar').slice(0, 6)
    );
  });

  it('clears results when the query is cleared', () => {
    const { result } = renderHook(() =>
      useInstructorEngineSearch('instructor', 'en')
    );

    act(() => {
      result.current.setEngineSearch('calculus');
    });

    act(() => {
      result.current.setEngineSearch('');
    });

    expect(result.current.engineSearch).toBe('');
    expect(result.current.instructorSearchResults)
      .toEqual([]);
  });

  it('preserves whitespace and case normalization', () => {
    const { result } = renderHook(() =>
      useInstructorEngineSearch('instructor', 'en')
    );

    act(() => {
      result.current.setEngineSearch('  QUIZ  ');
    });

    expect(result.current.quickPracticeSearchMatch)
      .toBe(true);
  });

  it('preserves partial quiz keyword matching', () => {
    const { result } = renderHook(() =>
      useInstructorEngineSearch('instructor', 'en')
    );

    act(() => {
      result.current.setEngineSearch('qu');
    });

    expect(result.current.quickPracticeSearchMatch)
      .toBe(true);
  });

  it('keeps each hook instance independent', () => {
    const first = renderHook(() =>
      useInstructorEngineSearch('instructor', 'en')
    );

    const second = renderHook(() =>
      useInstructorEngineSearch('instructor', 'en')
    );

    act(() => {
      first.result.current.setEngineSearch('quiz');
    });

    expect(first.result.current.engineSearch).toBe('quiz');
    expect(second.result.current.engineSearch).toBe('');

    first.unmount();
    second.unmount();
  });
});
