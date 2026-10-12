import type { CourseLesson } from '@/content/course';
import { englishLessonCopy } from '@/content/course-en';
import type { Language } from '@/i18n/uiCopy';

export function localizeLesson(lesson: CourseLesson, language: Language): CourseLesson {
  if (language === 'ar') return lesson;
  const copy = englishLessonCopy[lesson.slug];
  return copy ? { ...lesson, ...copy } : lesson;
}
