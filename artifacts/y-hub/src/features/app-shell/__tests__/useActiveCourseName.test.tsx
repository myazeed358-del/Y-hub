import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  act,
  cleanup,
  renderHook,
  waitFor,
} from '@testing-library/react';

import { getCourses } from '@/utils/courseStorage';
import { useActiveCourseName } from '../hooks/useActiveCourseName';

vi.mock('@/utils/courseStorage', () => ({
  getCourses: vi.fn(),
}));

type Courses = Awaited<ReturnType<typeof getCourses>>;

const mockCourses = (items: Array<{
  id: string;
  title: string;
}>): Courses => items as Courses;

beforeEach(() => {
  vi.resetAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('useActiveCourseName', () => {
  it('loads the current course title', async () => {
    vi.mocked(getCourses).mockResolvedValue(
      mockCourses([{ id: 'c1', title: 'Biology' }])
    );

    const { result } = renderHook(() =>
      useActiveCourseName('/course/c1', 'en')
    );

    await waitFor(() => {
      expect(result.current).toBe('Biology');
    });

    expect(getCourses).toHaveBeenCalledTimes(1);
  });

  it('clears context for a missing course', async () => {
    vi.mocked(getCourses).mockResolvedValue(
      mockCourses([{ id: 'c2', title: 'Physics' }])
    );

    const { result } = renderHook(() =>
      useActiveCourseName('/course/c1', 'en')
    );

    await waitFor(() => {
      expect(getCourses).toHaveBeenCalledTimes(1);
    });

    expect(result.current).toBeNull();
  });

  it('handles course loading errors', async () => {
    vi.mocked(getCourses).mockRejectedValue(
      new Error('Course loading failed')
    );

    const { result } = renderHook(() =>
      useActiveCourseName('/course/c1', 'ar')
    );

    await waitFor(() => {
      expect(getCourses).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current).toBeNull();
  });

  it('localizes lesson context when language changes', () => {
    const { result, rerender } = renderHook(
      ({ language }: { language: 'ar' | 'en' }) =>
        useActiveCourseName('/lesson/introduction', language),
      { initialProps: { language: 'ar' as 'ar' | 'en' } }
    );

    expect(result.current).toBe('المجموعات الضبابية');

    rerender({ language: 'en' });

    expect(result.current).toBe('Fuzzy Sets');
    expect(getCourses).not.toHaveBeenCalled();
  });

  it('preserves context while entering a related tool', () => {
    const { result, rerender } = renderHook(
      ({ location }: { location: string }) =>
        useActiveCourseName(location, 'en'),
      { initialProps: { location: '/lesson/example' } }
    );

    expect(result.current).toBe('Fuzzy Sets');

    rerender({ location: '/lab' });
    expect(result.current).toBe('Fuzzy Sets');

    rerender({ location: '/dashboard' });
    expect(result.current).toBeNull();
  });

  it('ignores stale asynchronous course results', async () => {
    let finishRequest!: (courses: Courses) => void;

    vi.mocked(getCourses).mockImplementation(
      () => new Promise<Courses>((resolve) => {
        finishRequest = resolve;
      })
    );

    const { result, rerender } = renderHook(
      ({ location }: { location: string }) =>
        useActiveCourseName(location, 'en'),
      { initialProps: { location: '/course/c1' } }
    );

    rerender({ location: '/lesson/introduction' });

    expect(result.current).toBe('Fuzzy Sets');

    await act(async () => {
      finishRequest(
        mockCourses([{ id: 'c1', title: 'Stale Title' }])
      );
      await Promise.resolve();
    });

    expect(result.current).toBe('Fuzzy Sets');
  });
});
