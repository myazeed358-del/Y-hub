import { describe, expect, it } from 'vitest';
import { courseLessons } from '@/content/course';
import { resolveLessonBySlug } from '../domain/resolveLessonBySlug';

describe('resolveLessonBySlug', () => {
  it('finds the first lesson', () => {
    const result = resolveLessonBySlug(
      courseLessons,
      courseLessons[0].slug
    );

    expect(result?.index).toBe(0);
    expect(result?.previous).toBeNull();
    expect(result?.baseLesson.slug).toBe(courseLessons[0].slug);
  });

  it('resolves previous and next lessons', () => {
    const result = resolveLessonBySlug(
      courseLessons,
      courseLessons[1].slug
    );

    expect(result?.previous?.slug).toBe(courseLessons[0].slug);
    expect(result?.next?.slug).toBe(courseLessons[2].slug);
  });

  it('returns no next lesson at the end', () => {
    const last = courseLessons.at(-1)!;
    const result = resolveLessonBySlug(courseLessons, last.slug);

    expect(result?.next).toBeNull();
  });

  it('returns null for an unknown slug', () => {
    expect(
      resolveLessonBySlug(courseLessons, 'unknown-lesson')
    ).toBeNull();
  });

  it('does not modify the original lessons', () => {
    const original = [...courseLessons];

    resolveLessonBySlug(courseLessons, courseLessons[0].slug);

    expect(courseLessons).toEqual(original);
  });
});
