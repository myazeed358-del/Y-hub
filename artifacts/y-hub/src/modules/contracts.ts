import type { ComponentType } from 'react';
import type { UiKey } from '@/i18n/uiCopy';

export const MODULE_ROLES = ['student', 'instructor', 'admin', 'super_admin'] as const;
export type ModuleRole = typeof MODULE_ROLES[number];
export const MODULE_PERMISSIONS = ['course:read', 'course:manage'] as const;
export type ModulePermission = typeof MODULE_PERMISSIONS[number];
export const MODULE_ICONS = ['lineChart', 'box', 'calculator', 'flaskConical', 'grid2x2', 'functionSquare', 'activity'] as const;
export type ModuleIcon = typeof MODULE_ICONS[number];
export interface LocalizedText { ar: string; en: string }

/** Product identity is independent of subject, grants and presentation. */
export const MODULE_KINDS = ['engine', 'application', 'laboratory'] as const;
export type ModuleKind = typeof MODULE_KINDS[number];
export const MODULE_CATEGORIES = ['mathematics', 'physics', 'chemistry', 'biology', 'medicine', 'engineering', 'productivity', 'education'] as const;
/** Custom subjects need no host registration; use a lowercase custom:<slug>. */
export type ModuleCategory = typeof MODULE_CATEGORIES[number] | `custom:${string}`;
export const MODULE_NAVIGATION_GROUPS = ['learning', 'tools', 'applications', 'laboratories'] as const;
export type ModuleNavigationGroup = typeof MODULE_NAVIGATION_GROUPS[number];

export interface ModuleAccessPolicy {
  roles: readonly ModuleRole[];
  majors?: readonly string[];
  /** Roles for which majors are mandatory. Omitted means all declared roles. */
  majorRestrictedRoles?: readonly ModuleRole[];
  /** Fail closed unless the host supplies trusted, resource-scoped grants. */
  permissions?: readonly ModulePermission[];
}

export interface ModuleRouteDefinition {
  /** Static, lowercase, absolute path. Parameterized core routes remain host-owned. */
  path: string;
  load: () => Promise<{ default: ComponentType }>;
  order?: number;
  dashboard?: { title: LocalizedText; iconId: ModuleIcon; order: number };
  navigation?: {
    group: ModuleNavigationGroup;
    title?: LocalizedText;
    labelKey?: UiKey;
    iconId: ModuleIcon;
    order: number;
  };
}

/** Build-time discovery contract; never grants backend privileges. */
export interface ModuleManifest {
  id: string;
  version: string;
  apiVersion: 2;
  kind: ModuleKind;
  title: LocalizedText;
  description?: LocalizedText;
  category: ModuleCategory;
  keywords?: readonly string[];
  capabilities?: readonly string[];
  dependencies?: readonly string[];
  defaultEnabled?: boolean;
  access: ModuleAccessPolicy;
  routes: readonly ModuleRouteDefinition[];
}

export interface ModuleAccessContext {
  role: ModuleRole | null | undefined;
  major?: string | null;
  permissions?: readonly ModulePermission[];
}
