import type { ComponentType } from 'react';
import type { UiKey } from '@/i18n/uiCopy';

export const MODULE_ROLES = ['student', 'instructor', 'admin', 'super_admin'] as const;
export type ModuleRole = typeof MODULE_ROLES[number];
export const MODULE_PERMISSIONS = ['course:read', 'course:manage'] as const;
export type ModulePermission = typeof MODULE_PERMISSIONS[number];
export const MODULE_ICONS = ['lineChart', 'box', 'calculator', 'flaskConical', 'grid2x2'] as const;
export type ModuleIcon = typeof MODULE_ICONS[number];
export interface LocalizedText { ar: string; en: string }

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
  navigation?: {
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
  apiVersion: 1;
  title: LocalizedText;
  description?: LocalizedText;
  category?: string;
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
