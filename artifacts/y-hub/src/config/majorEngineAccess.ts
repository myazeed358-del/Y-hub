import { moduleRegistry, canAccessModule } from '@/modules';
import type { ModuleIcon, ModuleRole, ModuleCategory, ModuleRegistry } from '@/modules';
import type { UiKey } from '@/i18n/uiCopy';

export type EngineAccessRole = ModuleRole;

/**
 * Serializable sidebar metadata for engines.
 * Kept in the engine catalog so navigation never maintains a second
 * hard-coded engine inventory.
 */
export type EngineSidebarIconId = ModuleIcon;

/** Legacy alias accepts future localized engine labels too. */
export type EngineSidebarLabelKey = UiKey;

export interface EngineSidebarMetadata {
  labelKey?: UiKey;
  iconId: EngineSidebarIconId;
  order: number;
}

export interface EngineDefinition {
  id: string;
  route: string;
  category: ModuleCategory;
  sidebar?: EngineSidebarMetadata;
  majors: readonly string[];
  title: {
    ar: string;
    en: string;
  };
  description: {
    ar: string;
    en: string;
  };
  keywords: readonly string[];
}

/** Engine-only projection. Subject, capabilities, major and navigation group never imply kind. */
export function getEngineCatalog(registry: ModuleRegistry = moduleRegistry): readonly EngineDefinition[] {
  return registry.routes.filter(route => route.module.kind === 'engine').map(route => ({
    id: route.module.routes.length === 1 ? route.module.id : route.module.id + ':' + route.path,
    route: route.path,
    category: route.module.category,
    majors: route.module.access.majors ?? [],
    title: route.navigation?.title ?? route.module.title,
    description: route.module.description ?? route.module.title,
    keywords: route.module.keywords ?? [],
    sidebar: route.navigation,
  }));
}

export const ENGINE_CATALOG = getEngineCatalog();

export const ALL_ENGINE_ROUTES = ENGINE_CATALOG.map(
  (engine) => engine.route
);

/**
 * Returns engines academically associated with a major.
 * Used for the normal Student/Instructor sidebar.
 */
export function getEnginesForMajor(
  major?: string | null,
  registry: ModuleRegistry = moduleRegistry,
): readonly EngineDefinition[] {
  if (!major) return [];

  return getEngineCatalog(registry).filter((engine) =>
    engine.majors.includes(major)
  );
}

/**
 * Backwards-compatible helper used by the current UI.
 */
export function getAllowedEngineRoutes(
  major?: string | null,
  registry: ModuleRegistry = moduleRegistry,
): readonly string[] {
  return getEnginesForMajor(major, registry).map((engine) => engine.route);
}

/**
 * Sidebar visibility:
 *
 * Student:
 *   only engines belonging to the student's major.
 *
 * Instructor:
 *   only engines belonging to the instructor's teaching major.
 *   Other engines will be discoverable through instructor search.
 *
 * Admin / Super Admin:
 *   all engines.
 */
export function getSidebarEngineRoutes(
  role: EngineAccessRole | null | undefined,
  major?: string | null,
  registry: ModuleRegistry = moduleRegistry,
): readonly string[] {
  return registry.routes.filter(route =>
    route.module.kind === 'engine' && canAccessModule(route.module.access, { role, major }) &&
    (role === 'admin' || role === 'super_admin' ||
      !route.module.access.majors?.length || Boolean(major && route.module.access.majors.includes(major)))
  ).map(route => route.path);
}

/**
 * Engine-specific frontend route eligibility; ProtectedRoute handles generic modules.
 * Backend authorization remains mandatory.
 *
 * Student:
 *   strictly restricted to engines belonging to the student's major.
 *
 * Instructor:
 *   may open any engine. The normal sidebar still shows only engines
 *   belonging to the instructor's teaching major; the rest are intended
 *   to be discovered through Engine Search.
 *
 * Admin / Super Admin:
 *   may open any engine.
 */
export function canRoleAccessEngineRoute(
  role: EngineAccessRole | null | undefined,
  major: string | null | undefined,
  route: string,
  registry: ModuleRegistry = moduleRegistry,
): boolean {
  const registered = registry.routes.find(item => item.module.kind === 'engine' && item.path === route);
  return Boolean(registered && canAccessModule(registered.module.access, { role, major }));
}

/**
 * Legacy helper retained temporarily while the remaining callers
 * are migrated to role-aware authorization.
 */
export function canAccessEngineRoute(
  major: string | null | undefined,
  route: string,
  registry: ModuleRegistry = moduleRegistry,
): boolean {
  return getAllowedEngineRoutes(major, registry).includes(route);
}

/**
 * Search the complete engine catalog.
 * Intended for Instructor/Admin engine discovery.
 */
export function searchEngines(
  query: string,
  language: 'ar' | 'en' = 'en',
  registry: ModuleRegistry = moduleRegistry,
): readonly EngineDefinition[] {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) return [];

  return getEngineCatalog(registry).filter((engine) => {
    const searchableText = [
      engine.title[language],
      engine.title.ar,
      engine.title.en,
      engine.description[language],
      engine.category,
      ...engine.keywords,
      ...engine.majors,
    ]
      .join(' ')
      .toLowerCase();

    return searchableText.includes(normalizedQuery);
  });
}
