import { useParams } from 'wouter';
import { courseLessons } from '@/content/course';
import { localizeLesson } from '@/content/localizeLesson';
import { useLanguage } from '@/i18n/LanguageContext';
import { resolveLessonBySlug } from '../domain/resolveLessonBySlug';

export function useLegacyLesson() {
  const { slug } = useParams<{ slug: string }>();
  const { language, t } = useLanguage();

  const lessons = courseLessons;
  const resolved = resolveLessonBySlug(lessons, slug);

  const lesson = resolved
    ? localizeLesson(resolved.baseLesson, language)
    : null;

  const lessonItems = lessons.map((item) => ({
    item,
    localizedItem: localizeLesson(item, language),
  }));

  return {
    slug,
    language,
    t,
    lessons,
    lesson,
    index: resolved?.index ?? -1,
    previous: resolved?.previous ?? null,
    next: resolved?.next ?? null,
    lessonItems,
  };
}

export type LegacyLessonController =
  ReturnType<typeof useLegacyLesson>;
