import { useLanguage } from '@/i18n/LanguageContext';
import { courseLessons } from '@/content/course';
import { localizeLesson } from '@/content/localizeLesson';
import { countCompletedLessons } from '../domain/countCompletedLessons';

export function useCoursePlan() {
  const { language, t } = useLanguage();

  const lessons = courseLessons;
  const completed = countCompletedLessons(lessons);

  const localizedLessons = lessons.map((lesson) => ({
    lesson,
    localizedLesson: localizeLesson(lesson, language),
  }));

  return {
    language,
    t,
    lessons,
    completed,
    localizedLessons,
  };
}

export type CoursePlanController =
  ReturnType<typeof useCoursePlan>;
