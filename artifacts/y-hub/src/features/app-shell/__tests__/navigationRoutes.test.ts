import { describe, expect, it } from 'vitest';

import {
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
  buildNavigationRouteGroups,
} from '../domain/navigationRoutes';

import {
  buildNavigationGroups,
} from '../domain/navigation';

type Role = Parameters<typeof buildNavigationRouteGroups>[0];

function paths(role: Role, major?: string | null) {
  return buildNavigationRouteGroups(role, major)
    .flatMap((group) => group.items.map((item) => item.href));
}

describe('navigationRoutes', () => {
  it('shows overview without a role', () => {
    expect(paths(null, null)).toEqual(['/']);
  });

  it('shows mathematics engines to students', () => {
    expect(paths('student', 'mathematics')).toEqual([
      '/',
      '/quiz',
      '/calculus-1',
      '/calculus',
      '/math-solver',
      '/solver',
      '/lab',
      '/linear-algebra',
    ]);
  });

  it('hides unrelated engines from students', () => {
    expect(paths('student', 'medicine')).toEqual([
      '/',
      '/quiz',
    ]);
  });

  it('hides quick practice from instructors', () => {
    expect(paths('instructor', 'mathematics')).toEqual([
      '/',
      '/calculus-1',
      '/calculus',
      '/math-solver',
      '/solver',
      '/lab',
      '/linear-algebra',
    ]);
  });

  it('preserves administrator navigation', () => {
    for (const role of ['admin', 'super_admin'] as const) {
      expect(paths(role, null)).toEqual([
        '/',
        '/quiz',
        '/calculus-1',
        '/calculus',
        '/math-solver',
        '/solver',
        '/lab',
        '/linear-algebra',
      ]);
    }
  });

  it('provides serializable icon identifiers', () => {
    const items = buildNavigationRouteGroups(
      'student',
      'mathematics'
    ).flatMap((group) => group.items);

    expect(items.map((item) => item.iconId)).toEqual([
      'home',
      'brainCircuit',
      'lineChart',
      'lineChart',
      'box',
      'calculator',
      'flaskConical',
      'grid2x2',
    ]);

    expect(
      items.every((item) => typeof item.iconId === 'string')
    ).toBe(true);
  });

  it('preserves route and label parity', () => {
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
        const model = buildNavigationRouteGroups(role, major);
        const view = buildNavigationGroups(role, major);

        const simplify = (
          groups: typeof model | typeof view
        ) => groups.map((group) => ({
          section: group.section,
          items: group.items.map((item) => ({
            href: item.href,
            key: item.key,
          })),
        }));

        expect(simplify(view)).toEqual(simplify(model));
      }
    }
  });

  it('preserves the original Lucide component identity', () => {
    const items = buildNavigationGroups(
      'student',
      'mathematics'
    ).flatMap((group) => group.items);

    expect(items.map((item) => item.icon)).toEqual([
      Home,
      BrainCircuit,
      LineChart,
      LineChart,
      Box,
      Calculator,
      FlaskConical,
      Grid2X2,
    ]);
  });

  it('keeps route rules free of UI library imports', () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        'src/features/app-shell/domain/navigationRoutes.ts'
      ),
      'utf8',
    );

    expect(source).not.toMatch(
      /from\s+['"](?:react|react-dom|lucide-react|wouter)['"]/
    );

    expect(source).not.toContain('LucideIcon');
  });
});
