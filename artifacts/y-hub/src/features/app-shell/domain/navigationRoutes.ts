import {
  ENGINE_CATALOG,
  getSidebarEngineRoutes,
  type EngineAccessRole,
  type EngineSidebarIconId,
} from '@/config/majorEngineAccess';

import type { UiKey } from '@/i18n/uiCopy';

export type NavigationIconId =
  | 'home'
  | 'brainCircuit'
  | EngineSidebarIconId;

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

  // Source engine links from catalog metadata, not a second route inventory.
  const engineItems: NavigationRouteItem[] = ENGINE_CATALOG
    .filter((engine) => sidebarEngineRoutes.has(engine.route))
    .flatMap((engine) =>
      engine.sidebar
        ? [{
            href: engine.route,
            key: engine.sidebar.labelKey as UiKey,
            iconId: engine.sidebar.iconId,
            order: engine.sidebar.order,
          }]
        : []
    )
    .sort((left, right) => left.order - right.order)
    .map(({ href, key, iconId }) => ({ href, key, iconId }));

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
