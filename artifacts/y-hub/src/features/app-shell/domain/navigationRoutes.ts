import { moduleRegistry, getModuleNavigation, type ModuleRegistry, type LocalizedText, type ModuleIcon, type ModuleRole, type ModuleNavigationGroup } from '@/modules';

import type { UiKey } from '@/i18n/uiCopy';

export type NavigationIconId =
  | 'home'
  | 'brainCircuit'
  | ModuleIcon;

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

/** Host presentation areas, not a module registration list. Kind never selects placement. */
const MODULE_SECTIONS: { group: ModuleNavigationGroup; section: UiKey }[] = [
  { group: 'tools', section: 'understandingTools' },
  { group: 'applications', section: 'moduleApplications' },
  { group: 'laboratories', section: 'moduleLaboratories' },
];

export function buildNavigationRouteGroups(
  role: ModuleRole | null | undefined,
  major?: string | null,
  modules: ModuleRegistry = moduleRegistry,
  engineGrants?: readonly string[],
): NavigationRouteGroup[] {
  // Build the menu from modules visible to this account.
  const contributions = getModuleNavigation(modules, { role, major, engineGrants });
  const itemsFor = (group: ModuleNavigationGroup): NavigationRouteItem[] => contributions
    .filter(item => item.group === group).map(item => ({
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
        ...itemsFor('learning'),
      ],
    },
    ...MODULE_SECTIONS.flatMap(({ group, section }) => {
      const items = itemsFor(group);
      return items.length ? [{ section, items }] : [];
    }),
  ];
}
