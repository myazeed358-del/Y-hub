import { moduleRegistry, canAccessModule } from '@/modules';
import type { ModuleIcon, ModuleRole } from '@/modules';
import type { UiKey } from '@/i18n/uiCopy';

export type EngineAccessRole = ModuleRole;

/**
 * Serializable sidebar metadata for engines.
 * Kept in the engine catalog so navigation never maintains a second
 * hard-coded engine inventory.
 */
export type EngineSidebarIconId = ModuleIcon;

export type EngineSidebarLabelKey =
  | 'calculus1Solver'
  | 'calculusPlotter'
  | 'calculus3Solver'
  | 'solver'
  | 'lab'
  | 'linearAlgebra'
  | 'odeSolver';

export interface EngineSidebarMetadata {
  labelKey?: UiKey;
  iconId: EngineSidebarIconId;
  order: number;
}

export interface EngineDefinition {
  id: string;
  route: string;
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

/** Compatibility projection: manifests own metadata, routes and access policy. */
export const ENGINE_CATALOG: readonly EngineDefinition[] = moduleRegistry.routes.map(route => ({
  id: route.module.routes.length === 1 ? route.module.id : route.module.id + ':' + route.path,
  route: route.path,
  majors: route.module.access.majors ?? [],
  title: route.navigation?.title ?? route.module.title,
  description: route.module.description ?? route.module.title,
  keywords: route.module.keywords ?? [],
  sidebar: route.navigation,
}));

export const ALL_ENGINE_ROUTES = ENGINE_CATALOG.map(
  (engine) => engine.route
);

/**
 * Returns engines academically associated with a major.
 * Used for the normal Student/Instructor sidebar.
 */
export function getEnginesForMajor(
  major?: string | null
): readonly EngineDefinition[] {
  if (!major) return [];

  return ENGINE_CATALOG.filter((engine) =>
    engine.majors.includes(major)
  );
}

/**
 * Backwards-compatible helper used by the current UI.
 */
export function getAllowedEngineRoutes(
  major?: string | null
): readonly string[] {
  return getEnginesForMajor(major).map((engine) => engine.route);
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
  major?: string | null
): readonly string[] {
  return moduleRegistry.routes.filter(route =>
    canAccessModule(route.module.access, { role, major }) &&
    (role === 'admin' || role === 'super_admin' ||
      !route.module.access.majors?.length || Boolean(major && route.module.access.majors.includes(major)))
  ).map(route => route.path);
}

/**
 * Real route authorization.
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
  route: string
): boolean {
  const registered = moduleRegistry.routes.find(item => item.path === route);
  return Boolean(registered && canAccessModule(registered.module.access, { role, major }));
}

/**
 * Legacy helper retained temporarily while the remaining callers
 * are migrated to role-aware authorization.
 */
export function canAccessEngineRoute(
  major: string | null | undefined,
  route: string
): boolean {
  return getAllowedEngineRoutes(major).includes(route);
}

/**
 * Search the complete engine catalog.
 * Intended for Instructor/Admin engine discovery.
 */
export function searchEngines(
  query: string,
  language: 'ar' | 'en' = 'en'
): readonly EngineDefinition[] {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) return [];

  return ENGINE_CATALOG.filter((engine) => {
    const searchableText = [
      engine.title[language],
      engine.title.ar,
      engine.title.en,
      engine.description[language],
      ...engine.keywords,
      ...engine.majors,
    ]
      .join(' ')
      .toLowerCase();

    return searchableText.includes(normalizedQuery);
  });
}
