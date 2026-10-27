import { moduleRegistry } from '@/modules';
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
  location = location.split(/[?#]/, 1)[0].replace(/\/$/, '') || '/';
  if (/^\/course\/[^/]+\/ai-tutor$/.test(location)) return language === 'ar' ? 'المعلم الذكي' : 'AI Tutor';
  if (/^\/exam\/[^/]+$/.test(location)) return language === 'ar' ? 'الامتحان' : 'Exam';
  const route = moduleRegistry.routes.find(item => item.path === location);
  if (route) {
    return route.navigation?.labelKey
      ? t(route.navigation.labelKey)
      : (route.navigation?.title ?? route.module.title)[language];
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
