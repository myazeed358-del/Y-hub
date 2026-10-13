export function selectFeaturedLessons<T>(
  lessons: readonly T[],
  limit = 4
): T[] {
  return lessons.slice(0, Math.max(0, limit));
}
