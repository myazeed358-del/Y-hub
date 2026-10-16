import {
  getSidebarEngineRoutes,
  type EngineAccessRole,
} from '@/config/majorEngineAccess';

import type { UiKey } from '@/i18n/uiCopy';

export type NavigationIconId =
  | 'home'
  | 'brainCircuit'
  | 'lineChart'
  | 'box'
  | 'calculator'
  | 'flaskConical'
  | 'grid2x2';

export interface NavigationRouteItem {
  href: string;
  key: UiKey;
  iconId: NavigationIconId;
}

export interface NavigationRouteGroup {
  section: UiKey;
  items: NavigationRouteItem[];
}

export function buildNavigationRouteGroups(
  role: EngineAccessRole | null | undefined,
  major?: string | null
): NavigationRouteGroup[] {
  const sidebarEngineRoutes = new Set(
    getSidebarEngineRoutes(
      role,
      major
    )
  );

  const engineItems = [
    { href: '/calculus-1', key: 'calculus1Solver' as UiKey, iconId: 'lineChart' as const },
    { href: '/calculus', key: 'calculusPlotter' as UiKey, iconId: 'lineChart' as const },
    { href: '/math-solver', key: 'calculus3Solver' as UiKey, iconId: 'box' as const },
    { href: '/solver', key: 'solver' as UiKey, iconId: 'calculator' as const },
    { href: '/lab', key: 'lab' as UiKey, iconId: 'flaskConical' as const },
    { href: '/linear-algebra', key: 'linearAlgebra' as UiKey, iconId: 'grid2x2' as const },
    { href: '/ode', key: 'odeSolver' as UiKey, iconId: 'lineChart' as const },
  ].filter((item) => sidebarEngineRoutes.has(item.href));

  return [
    {
      section: 'learningSpace' as UiKey,
      items: [
        { href: '/', key: 'overview' as UiKey, iconId: 'home' as const },
        ...(
          role === 'student' ||
          role === 'admin' ||
          role === 'super_admin'
            ? [
                {
                  href: '/quiz',
                  key: 'quickPractice' as UiKey,
                  iconId: 'brainCircuit' as const,
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
