import type { CourseLesson } from '@/content/course';

export function resolveLessonBySlug(
  lessons: readonly CourseLesson[],
  slug: string | undefined
) {
  const index = lessons.findIndex(
    (lesson) => lesson.slug === slug
  );

  if (index < 0) return null;

  return {
    baseLesson: lessons[index]!,
    index,
    previous: index > 0 ? lessons[index - 1]! : null,
    next: lessons[index + 1] ?? null,
  };
}
