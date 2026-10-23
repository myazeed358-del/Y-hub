import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  Activity,
  Box,
  BrainCircuit,
  Calculator,
  FlaskConical,
  Grid2X2,
  Home,
  LineChart,
} from 'lucide-react';

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  buildNavigationGroups as presentationNavigation,
} from '../components/navigation/buildNavigationGroups';

import {
  buildNavigationGroups as domainCompatibilityNavigation,
} from '../domain/navigation';

import type {
  NavigationGroup,
  NavigationItem,
} from '../domain/navigation';

import {
  buildNavigationGroups as legacyNavigation,
} from '@/components/layout/navigation';

import {
  buildNavigationRouteGroups,
} from '../domain/navigationRoutes';

const SOURCE = resolve(process.cwd(), 'src');

function read(relativePath: string): string {
  return readFileSync(
    resolve(SOURCE, relativePath),
    'utf8'
  ).trim();
}

describe('NavigationPresentationBoundary', () => {
  it('preserves compatibility through both older import paths', () => {
    expect(domainCompatibilityNavigation)
      .toBe(presentationNavigation);

    expect(legacyNavigation)
      .toBe(presentationNavigation);
  });

  it('preserves the existing navigation type exports', () => {
    const group: NavigationGroup | undefined =
      domainCompatibilityNavigation(null)[0];

    const item: NavigationItem | undefined =
      group?.items[0];

    expect(group?.section).toBe('learningSpace');
    expect(item?.href).toBe('/');
  });

  it('preserves role, major and route selection', () => {
    for (const role of [
      null,
      'student',
      'instructor',
      'admin',
      'super_admin',
    ] as const) {
      for (const major of [
        null,
        'mathematics',
        'medicine',
      ]) {
        const routeGroups = buildNavigationRouteGroups(
          role,
          major
        );

        const viewGroups = presentationNavigation(
          role,
          major
        );

        expect(
          viewGroups.map((group) => ({
            section: group.section,
            items: group.items.map((item) => ({
              href: item.href,
              key: item.key,
            })),
          }))
        ).toEqual(
          routeGroups.map((group) => ({
            section: group.section,
            items: group.items.map((item) => ({
              href: item.href,
              key: item.key,
            })),
          }))
        );
      }
    }
  });

  it('retains all original Lucide icon identities', () => {
    const icons = presentationNavigation(
      'student',
      'mathematics'
    ).flatMap((group) =>
      group.items.map((item) => item.icon)
    );

    expect(icons).toEqual([
      Home,
      BrainCircuit,
      Activity,
      Box,
      LineChart,
      LineChart,
      Box,
      Calculator,
      FlaskConical,
      Grid2X2,
      LineChart,
      Grid2X2,
    ]);
  });

  it('makes the navigation hook use the presentation adapter', () => {
    const source = read(
      'features/app-shell/hooks/useAppNavigation.ts'
    );

    expect(source).toContain(
      '@/features/app-shell/components/navigation/buildNavigationGroups'
    );

    expect(source).not.toContain(
      '@/features/app-shell/domain/navigation'
    );
  });

  it('keeps the old domain entry as a compatibility facade', () => {
    const source = read(
      'features/app-shell/domain/navigation.ts'
    );

    expect(source).toBe(
      "export { buildNavigationGroups } from '../components/navigation/buildNavigationGroups';\n" +
      "export type { NavigationGroup, NavigationItem } from '../components/navigation/buildNavigationGroups';"
    );

    expect(source).not.toContain('lucide-react');
  });

  it('points the legacy layout facade to presentation', () => {
    const source = read(
      'components/layout/navigation.ts'
    );

    expect(source).toBe(
      "export * from '@/features/app-shell/components/navigation/buildNavigationGroups';"
    );
  });

  it('isolates route rules from UI libraries', () => {
    const model = read(
      'features/app-shell/domain/navigationRoutes.ts'
    );

    const presentation = read(
      'features/app-shell/components/navigation/buildNavigationGroups.ts'
    );

    expect(model).not.toContain('lucide-react');
    expect(model).not.toContain('LucideIcon');

    expect(presentation).toContain(
      "from '../../domain/navigationRoutes'"
    );

    expect(presentation).toContain('lucide-react');
  });
});
