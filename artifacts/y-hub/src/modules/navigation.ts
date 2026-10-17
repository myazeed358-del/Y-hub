import { canAccessModule } from './access';
import type { ModuleAccessContext } from './contracts';
import type { ModuleRegistry } from './registry';

/** Sidebar selection; instructor search can still expose other academic majors. */
export function getModuleNavigation(registry: ModuleRegistry, context: ModuleAccessContext, surface: 'navigation' | 'dashboard' = 'navigation') {
  return registry.routes.flatMap(route => {
    const contribution = route[surface];
    if (!contribution || !canAccessModule(route.module.access, context)) return [];
    const visible = context.role === 'admin' || context.role === 'super_admin' ||
      !route.module.access.majors?.length ||
      Boolean(context.major && route.module.access.majors.includes(context.major));
    return visible ? [{
      href: route.path,
      title: contribution.title ?? route.module.title,
      labelKey: surface === 'navigation' ? route.navigation?.labelKey : undefined,
      iconId: contribution.iconId,
      order: contribution.order,
    }] : [];
  }).sort((a, b) => a.order - b.order || a.href.localeCompare(b.href));
}
