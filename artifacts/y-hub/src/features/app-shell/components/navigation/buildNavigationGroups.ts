import type { LucideIcon } from 'lucide-react';

import {
  Box,
  BrainCircuit,
  Calculator,
  FlaskConical,
  Grid2X2,
  Home as HomeIcon,
  LineChart,
} from 'lucide-react';

import type { EngineAccessRole } from '@/config/majorEngineAccess';
import type { UiKey } from '@/i18n/uiCopy';

import {
  buildNavigationRouteGroups,
  type NavigationIconId,
} from '../../domain/navigationRoutes';

export interface NavigationItem {
  href: string;
  key: UiKey;
  icon: LucideIcon;
}

export interface NavigationGroup {
  section: UiKey;
  items: NavigationItem[];
}

const NAVIGATION_ICONS: Record<NavigationIconId, LucideIcon> = {
  home: HomeIcon,
  brainCircuit: BrainCircuit,
  lineChart: LineChart,
  box: Box,
  calculator: Calculator,
  flaskConical: FlaskConical,
  grid2x2: Grid2X2,
};

export function buildNavigationGroups(
  role: EngineAccessRole | null | undefined,
  major?: string | null
): NavigationGroup[] {
  return buildNavigationRouteGroups(role, major).map((group) => ({
    section: group.section,
    items: group.items.map((item) => ({
      href: item.href,
      key: item.key,
      icon: NAVIGATION_ICONS[item.iconId],
    })),
  }));
}
