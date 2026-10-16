import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  getSidebarEngineRoutes,
} from '@/config/majorEngineAccess';

import {
  buildNavigationGroups as legacyBuilder,
} from '@/components/layout/navigation';

import {
  buildNavigationGroups,
  type NavigationGroup,
  type NavigationItem,
} from '../domain/navigation';

function paths(groups: NavigationGroup[]): string[] {
  return groups.flatMap(
    (group) => group.items.map((item) => item.href)
  );
}

const enginePaths = [
  '/calculus-1',
  '/calculus',
  '/math-solver',
  '/solver',
  '/lab',
  '/linear-algebra',
  '/ode',
];

function visibleEnginePaths(
  groups: NavigationGroup[]
): string[] {
  return paths(groups).filter(
    (route) => enginePaths.includes(route)
  );
}

describe('AppShell navigation domain', () => {
  it('preserves the legacy function export', () => {
    expect(legacyBuilder).toBe(buildNavigationGroups);
  });

  it('provides the overview route for guests', () => {
    const result = paths(
      buildNavigationGroups(null, null)
    );

    expect(result).toContain('/');
    expect(result).not.toContain('/quiz');
  });

  it('preserves student mathematics routes', () => {
    const groups = buildNavigationGroups(
      'student',
      'mathematics'
    );

    expect(paths(groups)).toContain('/quiz');

    const expected = enginePaths.filter((route) =>
      getSidebarEngineRoutes(
        'student',
        'mathematics'
      ).includes(route)
    );

    expect(visibleEnginePaths(groups))
      .toEqual(expected);

    expect(visibleEnginePaths(groups).length)
      .toBeGreaterThan(0);
  });

  it('does not expose mathematics tools to law students', () => {
    const groups = buildNavigationGroups(
      'student',
      'law'
    );

    expect(paths(groups)).toContain('/quiz');

    expect(visibleEnginePaths(groups))
      .toEqual([]);
  });

  it('preserves instructor sidebar policy', () => {
    const groups = buildNavigationGroups(
      'instructor',
      'mathematics'
    );

    expect(paths(groups)).not.toContain('/quiz');

    const expected = enginePaths.filter((route) =>
      getSidebarEngineRoutes(
        'instructor',
        'mathematics'
      ).includes(route)
    );

    expect(visibleEnginePaths(groups))
      .toEqual(expected);
  });

  it('preserves administrator navigation', () => {
    const groups = buildNavigationGroups(
      'admin',
      null
    );

    expect(paths(groups)).toContain('/quiz');

    for (const route of enginePaths) {
      expect(paths(groups)).toContain(route);
    }
  });

  it('preserves super administrator navigation', () => {
    const groups = buildNavigationGroups(
      'super_admin',
      null
    );

    expect(paths(groups)).toContain('/quiz');

    for (const route of enginePaths) {
      expect(paths(groups)).toContain(route);
    }
  });

  it('preserves student navigation without a major', () => {
    const groups = buildNavigationGroups(
      'student',
      null
    );

    expect(paths(groups)).toContain('/');
    expect(paths(groups)).toContain('/quiz');
  });

  it('preserves group and item contracts', () => {
    const groups: NavigationGroup[] =
      buildNavigationGroups(
        'student',
        'mathematics'
      );

    expect(groups[0]?.section)
      .toBe('learningSpace');

    for (const group of groups) {
      for (const item of group.items) {
        const typedItem: NavigationItem = item;

        expect(typeof typedItem.href)
          .toBe('string');

        expect(typeof typedItem.key)
          .toBe('string');

        expect(typedItem.icon)
          .toBeDefined();
      }
    }
  });

  it('preserves engine group ordering', () => {
    const groups = buildNavigationGroups(
      'admin',
      'mathematics'
    );

    const sections = groups.map(
      (group) => group.section
    );

    expect(sections[0]).toBe('learningSpace');
    expect(sections[1]).toBe('understandingTools');

    expect(visibleEnginePaths(groups))
      .toEqual(enginePaths);
  });

  it('produces stable navigation for same inputs', () => {
    const first = buildNavigationGroups(
      'student',
      'mathematics'
    );

    const second = buildNavigationGroups(
      'student',
      'mathematics'
    );

    expect(second).toEqual(first);
  });
});
