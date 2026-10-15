import type {
  Language,
  UiKey,
} from '@/i18n/uiCopy';

export type PageTitleTranslator =
  (key: UiKey) => string;

export function resolvePageTitle(
  location: string,
  language: Language,
  t: PageTitleTranslator
): string {
  if (location === '/calculus-1') {
    return t('calculus1Solver');
  }

  return (
location === '/' || location === '/dashboard'
      ? t('overview')
      : location === '/profile'
        ? language === 'ar'
          ? 'الملف الشخصي'
          : 'Profile'
        : location === '/lab'
          ? t('lab')
          : location === '/solver'
            ? t('solver')
            : location.startsWith('/course')
              ? t('coursePlan')
              : location === '/quiz'
                ? t('quickPractice')
                : location === '/calculus'
                  ? t('calculusPlotter')
                  : location === '/math-solver'
                    ? t('calculus3Solver')
                    : t('lessonPath')
  );
}
