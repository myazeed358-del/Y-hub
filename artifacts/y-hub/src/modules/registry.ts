import { z } from 'zod';
import type { ModuleManifest, ModuleRouteDefinition } from './contracts';
import { MODULE_LAYOUTS, MODULE_CATEGORIES, MODULE_ICONS, MODULE_KINDS, MODULE_NAVIGATION_GROUPS, MODULE_PERMISSIONS, MODULE_ROLES, type ModuleCategory } from './contracts';
import { uiCopy } from '@/i18n/uiCopy';

const text = z.string().trim().min(1);
const identifier = z.string().regex(/^[a-z][a-z0-9-]*$/);
const localized = z.object({ ar: text, en: text }).strict();
const roles = z.array(z.enum(MODULE_ROLES)).min(1);
const schema = z.object({
  id: identifier,
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  apiVersion: z.literal(2),
  kind: z.enum(MODULE_KINDS),
  title: localized,
  description: localized.optional(),
  category: z.union([z.enum(MODULE_CATEGORIES), z.custom<ModuleCategory>(
    value => typeof value === 'string' && /^custom:[a-z][a-z0-9-]*$/.test(value),
  )]),
  keywords: z.array(text).optional(),
  capabilities: z.array(identifier).optional(),
  dependencies: z.array(identifier).optional(),
  defaultEnabled: z.boolean().optional(),
  access: z.object({
    roles,
    majors: z.array(text).min(1).optional(),
    majorRestrictedRoles: z.array(z.enum(MODULE_ROLES)).optional(),
    permissions: z.array(z.enum(MODULE_PERMISSIONS)).optional(),
  }).strict(),
  routes: z.array(z.object({
    layout: z.enum(MODULE_LAYOUTS).optional(),
    path: z.string().regex(/^\/[a-z0-9-]+(?:\/[a-z0-9-]+)*$/),
    load: z.custom<ModuleRouteDefinition['load']>(value => typeof value === 'function'),
    order: z.number().finite().optional(),
    dashboard: z.object({ title: localized, iconId: z.enum(MODULE_ICONS), order: z.number().finite() }).strict().optional(),
    navigation: z.object({
      group: z.enum(MODULE_NAVIGATION_GROUPS),
      title: localized.optional(),
      labelKey: z.custom<NonNullable<ModuleRouteDefinition['navigation']>['labelKey']>(
        value => typeof value === 'string' && Object.hasOwn(uiCopy.en, value),
      ).optional(),
      iconId: z.enum(MODULE_ICONS),
      order: z.number().finite(),
    }).strict().optional(),
  }).strict()).min(1),
}).strict();

/** These host routes cannot be shadowed by plugins, including dynamic matches. */
export const CORE_ROUTES = [
  '/', '/login', '/reset-password', '/dashboard', '/profile',
  '/course/:id', '/course/:id/view', '/course/:id/ai-tutor', '/exam/:id',
  '/legacy-home', '/legacy-course', '/lesson/:slug', '/quiz',
] as const;

export interface ModuleIssue { source: string; code: string; message: string }
export interface RegisteredModuleRoute extends ModuleRouteDefinition { module: ModuleManifest }
export interface ModuleRegistry {
  modules: readonly ModuleManifest[];
  routes: readonly RegisteredModuleRoute[];
  issues: readonly ModuleIssue[];
}
export interface ModuleSelection {
  enabledIds?: readonly string[];
  disabledIds?: readonly string[];
}

function overlaps(left: string, right: string): boolean {
  const a = left.split('/');
  const b = right.split('/');
  return a.length === b.length && a.every((part, i) =>
    part === b[i] || part.startsWith(':') || b[i].startsWith(':'));
}

/** Deterministic validation/quarantine: no first-wins route or ID ambiguity. */
export function createModuleRegistry(
  discovered: Readonly<Record<string, unknown>>,
  selection: ModuleSelection = {},
): ModuleRegistry {
  const issues: ModuleIssue[] = [];
  const candidates: { source: string; manifest: ModuleManifest }[] = [];
  for (const [source, value] of Object.entries(discovered).sort(([a], [b]) => a.localeCompare(b))) {
    const result = schema.safeParse(value);
    if (!result.success) {
      issues.push({ source, code: 'invalid-manifest', message: result.error.issues.map(issue =>
        issue.path.join('.') + ': ' + issue.message).join('; ') });
      continue;
    }
    candidates.push({ source, manifest: result.data });
  }
  const invalid = new Set<string>();
  const reject = (source: string, code: string, message: string) => {
    invalid.add(source);
    issues.push({ source, code, message });
  };
  for (const candidate of candidates) {
    if (candidates.filter(other => other.manifest.id === candidate.manifest.id).length > 1) {
      reject(candidate.source, 'duplicate-id', 'Duplicate module ID: ' + candidate.manifest.id);
    }
  }
  const enabled = candidates.filter(({ manifest }) =>
    !selection.disabledIds?.includes(manifest.id) &&
    (manifest.defaultEnabled !== false || selection.enabledIds?.includes(manifest.id)));
  const routes = enabled.flatMap(candidate => candidate.manifest.routes.map(route => ({ ...candidate, route })));
  for (let i = 0; i < routes.length; i++) {
    const current = routes[i];
    if (CORE_ROUTES.some(path => overlaps(path, current.route.path))) {
      reject(current.source, 'reserved-route', 'Host route collision: ' + current.route.path);
    }
    for (let j = i + 1; j < routes.length; j++) {
      if (overlaps(current.route.path, routes[j].route.path)) {
        reject(current.source, 'route-collision', 'Conflicting route: ' + current.route.path);
        reject(routes[j].source, 'route-collision', 'Conflicting route: ' + routes[j].route.path);
      }
    }
  }
  const byId = new Map(enabled.map(candidate => [candidate.manifest.id, candidate]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string, stack: string[]) => {
    if (visiting.has(id)) {
      for (const member of stack.slice(stack.indexOf(id))) {
        const candidate = byId.get(member);
        if (candidate) reject(candidate.source, 'dependency-cycle', 'Dependency cycle: ' + [...stack, id].join(' -> '));
      }
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of byId.get(id)?.manifest.dependencies ?? []) {
      if (byId.has(dependency)) visit(dependency, [...stack, id]);
    }
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of byId.keys()) visit(id, []);
  // Missing, disabled, invalid and cyclic dependencies quarantine dependants transitively.
  let changed = true;
  while (changed) {
    changed = false;
    for (const candidate of enabled) {
      if (invalid.has(candidate.source)) continue;
      const missing = candidate.manifest.dependencies?.find(id => {
        const dependency = byId.get(id);
        return !dependency || invalid.has(dependency.source);
      });
      if (missing) {
        reject(candidate.source, 'unavailable-dependency', 'Unavailable dependency: ' + missing);
        changed = true;
      }
    }
  }
  const modules = enabled.filter(candidate => !invalid.has(candidate.source)).map(candidate => candidate.manifest);
  return {
    modules,
    routes: modules.flatMap(module => module.routes.map(route => ({ ...route, module })))
      .sort((a, b) => (a.order ?? 1000) - (b.order ?? 1000) || a.path.localeCompare(b.path)),
    issues,
  };
}
