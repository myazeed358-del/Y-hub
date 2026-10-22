import type { ModuleAccessContext, ModuleLayout } from './contracts';
import type { ModuleRegistry } from './registry';
import { canAccessModule } from './access';

export function getModuleLayout(registry: ModuleRegistry, pathname: string, context: ModuleAccessContext): ModuleLayout {
  // Wouter static paths are case insensitive and accept a trailing slash.
  const path = pathname.replace(/\/$/, '').toLowerCase();
  const route = registry.routes.find(candidate => candidate.path === path);
  return route && canAccessModule(route.module.access, context, route.module.kind === 'engine' ? route.module.id : undefined) ? route.layout ?? 'standard' : 'standard';
}
