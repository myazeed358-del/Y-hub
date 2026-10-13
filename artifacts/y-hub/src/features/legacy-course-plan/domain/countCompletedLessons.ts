export interface ProgressItem {
  progress: number;
}

export function countCompletedLessons(
  lessons: readonly ProgressItem[]
): number {
  return lessons.filter(
    (lesson) => lesson.progress === 100
  ).length;
}
