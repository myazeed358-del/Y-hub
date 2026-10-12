import type { LucideIcon } from 'lucide-react';
import {
  Box,
  BrainCircuit,
  Calculator,
  FlaskConical,
  Home as HomeIcon,
  LineChart,
} from 'lucide-react';

import {
  getSidebarEngineRoutes,
  type EngineAccessRole,
} from '@/config/majorEngineAccess';
import type { UiKey } from '@/i18n/uiCopy';

export interface NavigationItem {
  href: string;
  key: UiKey;
  icon: LucideIcon;
}

export interface NavigationGroup {
  section: UiKey;
  items: NavigationItem[];
}

export function buildNavigationGroups(
  role: EngineAccessRole | null | undefined,
  major?: string | null
): NavigationGroup[] {
  const sidebarEngineRoutes = new Set(
    getSidebarEngineRoutes(
      role,
      major
    )
  );

  const engineItems = [
    { href: '/calculus', key: 'calculusPlotter' as UiKey, icon: LineChart },
    { href: '/math-solver', key: 'calculus3Solver' as UiKey, icon: Box },
    { href: '/solver', key: 'solver' as UiKey, icon: Calculator },
    { href: '/lab', key: 'lab' as UiKey, icon: FlaskConical },
  ].filter((item) => sidebarEngineRoutes.has(item.href));

  return [
    {
      section: 'learningSpace' as UiKey,
      items: [
        { href: '/', key: 'overview' as UiKey, icon: HomeIcon },
        ...(
          role === 'student' ||
          role === 'admin' ||
          role === 'super_admin'
            ? [
                {
                  href: '/quiz',
                  key: 'quickPractice' as UiKey,
                  icon: BrainCircuit,
                },
              ]
            : []
        ),
      ],
    },
    ...(engineItems.length > 0
      ? [
          {
            section: 'understandingTools' as UiKey,
            items: engineItems,
          },
        ]
      : []),
  ];
}
