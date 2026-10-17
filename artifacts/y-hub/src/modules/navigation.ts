import { canAccessModule } from './access';
import type { ModuleAccessContext } from './contracts';
import type { ModuleRegistry } from './registry';

/** Sidebar selection; instructor search can still expose other academic majors. */
export function getModuleNavigation(registry: ModuleRegistry, context: ModuleAccessContext) {
  return registry.routes.filter(route => {
    if (!route.navigation || !canAccessModule(route.module.access, context)) return false;
    return context.role === 'admin' || context.role === 'super_admin' ||
      !route.module.access.majors?.length ||
      Boolean(context.major && route.module.access.majors.includes(context.major));
  }).map(route => ({
    href: route.path,
    title: route.navigation!.title ?? route.module.title,
    labelKey: route.navigation!.labelKey,
    iconId: route.navigation!.iconId,
    order: route.navigation!.order,
  })).sort((a, b) => a.order - b.order || a.href.localeCompare(b.href));
}
