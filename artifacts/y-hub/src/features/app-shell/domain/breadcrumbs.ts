import { canAccessModule, moduleRegistry } from '@/modules';
import type { ModuleAccessContext, RegisteredModuleRoute } from '@/modules';
import type { Language } from '@/i18n/uiCopy';
import type { PageTitleTranslator } from './resolvePageTitle';

export interface PageBreadcrumb { label: string; href?: string }

/** Presentation only: routes and backend services retain their existing guards.
 * Never infer labels or parent links from an arbitrary URL/record identifier.
 */
export function resolveBreadcrumbs(
  location: string,
  currentTitle: string,
  language: Language,
  t: PageTitleTranslator,
  access: ModuleAccessContext,
  routes: readonly RegisteredModuleRoute[] = moduleRegistry.routes,
): PageBreadcrumb[] {
  const path = location.split(/[?#]/, 1)[0].replace(/\/$/, '') || '/';
  if (!access.role || !/^\/(?:[a-zA-Z0-9_-]+\/)+[a-zA-Z0-9_-]+$/.test(path)) return [];
  const home: PageBreadcrumb = { label: t('overview'), href: '/dashboard' };
  const current: PageBreadcrumb = { label: currentTitle };
  const course = path.match(/^\/course\/([a-zA-Z0-9_-]+)(?:\/(view|ai-tutor))?$/);
  if (course) {
    if (course[2] === 'ai-tutor') {
      return [home, {
        label: t('coursePlan'),
        href: `/course/${course[1]}${access.role === 'student' ? '/view' : ''}`,
      }, current];
    }
    return [home, current];
  }
  if (/^\/(exam|lesson)\/[^/]+$/.test(path)) return [home, current];

  const visible = routes.filter(route => canAccessModule(
    route.module.access, access, route.module.kind === 'engine' ? route.module.id : undefined,
  ));
  if (!visible.some(route => route.path === path)) return [];
  // API v2 has validated static routes; missing ancestors are simply omitted.
  const ancestors = visible.filter(route => path.startsWith(`${route.path}/`))
    .sort((a, b) => a.path.length - b.path.length)
    .map(route => ({
      href: route.path,
      label: route.navigation?.labelKey ? t(route.navigation.labelKey)
        : (route.navigation?.title ?? route.module.title)[language],
    }));
  return [home, ...ancestors, current];
}
