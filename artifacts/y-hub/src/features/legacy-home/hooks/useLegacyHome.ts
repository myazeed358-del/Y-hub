import { useLanguage } from '@/i18n/LanguageContext';
import { courseLessons } from '@/content/course';
import { localizeLesson } from '@/content/localizeLesson';
import { selectFeaturedLessons } from '../domain/selectFeaturedLessons';

export function useLegacyHome() {
  const { language, t } = useLanguage();

  const featuredLessons = selectFeaturedLessons(
    courseLessons,
    4
  ).map((lesson) => ({
    lesson,
    localizedLesson: localizeLesson(lesson, language),
  }));

  return {
    language,
    t,
    featuredLessons,
  };
}

export type LegacyHomeController =
  ReturnType<typeof useLegacyHome>;
