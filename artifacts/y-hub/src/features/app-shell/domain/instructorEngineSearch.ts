import { searchEngines } from '@/config/majorEngineAccess';
import type { Language } from '@/i18n/uiCopy';

export function resolveInstructorEngineSearch(
  role: string | null | undefined,
  engineSearch: string,
  language: Language
) {
  const instructorSearchResults =
    role === 'instructor'
      ? searchEngines(engineSearch, language).slice(0, 6)
      : [];

  const normalizedEngineSearch = engineSearch.trim().toLowerCase();

  const quickPracticeSearchMatch =
    role === 'instructor' &&
    normalizedEngineSearch.length > 0 &&
    [
      'quick practice',
      'practice',
      'quiz',
      'quick',
      'تدريب سريع',
      'تدريب',
      'تمرين',
      'أسئلة',
      'اختبار',
    ].some((term) =>
      term.includes(normalizedEngineSearch) ||
      normalizedEngineSearch.includes(term)
    );

  return {
    instructorSearchResults,
    quickPracticeSearchMatch,
  };
}
