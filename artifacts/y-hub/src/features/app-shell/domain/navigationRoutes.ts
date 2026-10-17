import { moduleRegistry, getModuleNavigation, type ModuleRegistry, type LocalizedText } from '@/modules';
import {
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
  title?: LocalizedText;
}

export interface NavigationRouteGroup {
  section: UiKey;
  items: NavigationRouteItem[];
}

export function buildNavigationRouteGroups(
  role: EngineAccessRole | null | undefined,
  major?: string | null,
  modules: ModuleRegistry = moduleRegistry,
): NavigationRouteGroup[] {
  const engineItems: NavigationRouteItem[] = getModuleNavigation(modules, { role, major })
    .map(item => ({
      href: item.href,
      key: item.labelKey ?? 'understandingTools',
      iconId: item.iconId,
      ...(item.labelKey ? {} : { title: item.title }),
    }));

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
