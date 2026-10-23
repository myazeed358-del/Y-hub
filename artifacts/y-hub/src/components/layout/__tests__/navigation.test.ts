import { describe, expect, it } from 'vitest';
import { buildNavigationGroups } from '../navigation';
import {
  canRoleAccessEngineRoute,
  type EngineAccessRole,
} from '@/config/majorEngineAccess';

const mathEngines = [
  '/calculus-1',
  '/calculus',
  '/math-solver',
  '/solver',
  '/lab',
  '/linear-algebra',
  '/ode',
];

function visibleRoutes(
  role: EngineAccessRole | null | undefined,
  major?: string | null
): string[] {
  return buildNavigationGroups(role, major)
    .flatMap((group) => group.items.map((item) => item.href));
}

describe('Y-Hub navigation', () => {
  it('shows mathematics engines to mathematics students', () => {
    expect(visibleRoutes('student', 'mathematics')).toEqual([
      '/',
      '/quiz',
      ...mathEngines,
      '/y-sheets',
    ]);
  });

  it('hides unrelated engines from students', () => {
    expect(visibleRoutes('student', 'medicine')).toEqual([
      '/',
      '/quiz',
      '/y-sheets',
    ]);
  });

  it('shows no engines for a student without a major', () => {
    expect(visibleRoutes('student', null)).toEqual([
      '/',
      '/quiz',
      '/y-sheets',
    ]);
  });

  it('shows instructor engines without student quiz navigation', () => {
    expect(visibleRoutes('instructor', 'mathematics')).toEqual([
      '/',
      '/engine-access',
      ...mathEngines,
      '/y-sheets',
    ]);
  });

  it('limits instructor sidebar to their teaching major', () => {
    expect(visibleRoutes('instructor', 'medicine')).toEqual([
      '/',
      '/engine-access',
      '/y-sheets',
    ]);
  });

  it.each(['admin', 'super_admin'] as const)(
    'shows all engines and the audit application to %s',
    (role) => {
      expect(visibleRoutes(role, null)).toEqual([
        '/',
        '/quiz',
        '/engine-access',
        ...mathEngines,
      '/audit-log',
        '/y-sheets',
      ]);
    }
  );

  it('shows only overview without role or major', () => {
    expect(visibleRoutes(null, null)).toEqual(['/']);
  });

  it('does not generate duplicate navigation routes', () => {
    for (const role of [
      'student',
      'instructor',
      'admin',
      'super_admin',
    ] as const) {
      const routes = visibleRoutes(role, 'mathematics');
      expect(new Set(routes).size).toBe(routes.length);
    }
  });

  it('never shows an unauthorized engine route', () => {
    for (const role of [
      'student',
      'instructor',
      'admin',
      'super_admin',
    ] as const) {
      for (const major of ['mathematics', 'medicine', null]) {
        const routes = visibleRoutes(role, major);

        for (const route of routes.filter((r) =>
          mathEngines.includes(r)
        )) {
          expect(
            canRoleAccessEngineRoute(role, major, route)
          ).toBe(true);
        }
      }
    }
  });
});
