import { MODULE_ICON_COMPONENTS } from '@/shared/ui/moduleIcons';
import type { LocalizedText, ModuleRole } from '@/modules';
import type { LucideIcon } from 'lucide-react';

import {
  BrainCircuit,
  Home as HomeIcon,
} from 'lucide-react';

import type { UiKey } from '@/i18n/uiCopy';

import {
  buildNavigationRouteGroups,
  type NavigationIconId,
} from '../../domain/navigationRoutes';

export interface NavigationItem {
  href: string;
  key: UiKey;
  icon: LucideIcon;
  title?: LocalizedText;
}

export interface NavigationGroup {
  section: UiKey;
  items: NavigationItem[];
}

const NAVIGATION_ICONS: Record<NavigationIconId, LucideIcon> = {
  home: HomeIcon,
  brainCircuit: BrainCircuit,
  ...MODULE_ICON_COMPONENTS,
};

export function buildNavigationGroups(
  role: ModuleRole | null | undefined,
  major?: string | null
): NavigationGroup[] {
  return buildNavigationRouteGroups(role, major).map((group) => ({
    section: group.section,
    items: group.items.map((item) => ({
      href: item.href,
      key: item.key,
      icon: NAVIGATION_ICONS[item.iconId],
      ...(item.title ? { title: item.title } : {}),
    })),
  }));
}
