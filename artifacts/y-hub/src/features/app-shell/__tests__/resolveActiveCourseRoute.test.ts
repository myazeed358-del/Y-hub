import { describe, expect, it } from 'vitest';
import {
  resolveActiveCourseRoute,
} from '../domain/resolveActiveCourseRoute';

describe('resolveActiveCourseRoute', () => {
  it('extracts a course identifier', () => {
    expect(resolveActiveCourseRoute('/course/abc')).toEqual({
      kind: 'course',
      courseId: 'abc',
    });
  });

  it('preserves the original nested route matching', () => {
    expect(
      resolveActiveCourseRoute('/preview/course/abc')
    ).toEqual({
      kind: 'course',
      courseId: 'abc',
    });
  });

  it('identifies lesson routes', () => {
    expect(
      resolveActiveCourseRoute('/lesson/introduction')
    ).toEqual({ kind: 'lesson' });
  });

  it('preserves context in related tools', () => {
    for (const location of [
      '/lab',
      '/matrix-calc',
      '/simplex',
      '/calculus-1',
      '/calculus',
      '/solver',
      '/sandbox',
      '/med-sim',
    ]) {
      expect(resolveActiveCourseRoute(location))
        .toEqual({ kind: 'preserve' });
    }
  });

  it('clears context on dashboard navigation', () => {
    expect(resolveActiveCourseRoute('/dashboard'))
      .toEqual({ kind: 'clear' });
  });

  it('clears context on profile navigation', () => {
    expect(resolveActiveCourseRoute('/profile'))
      .toEqual({ kind: 'clear' });
  });

  it('does not preserve context for unknown routes', () => {
    expect(resolveActiveCourseRoute('/unknown'))
      .toEqual({ kind: 'clear' });
  });

  it('does not mistake the course list for a detail', () => {
    expect(resolveActiveCourseRoute('/course'))
      .toEqual({ kind: 'clear' });
  });
});
