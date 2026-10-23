import type { ModuleAccessPolicy } from '@/modules';
import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { AppRoutes } from '../AppRoutes';

const state = vi.hoisted(() => ({
  user: null as null | { id: string },
  loading: false,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: state.user,
    loading: state.loading,
  }),
}));

vi.mock('@/i18n/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'ar',
    setLanguage: vi.fn(),
  }),
}));

vi.mock('wouter', () => ({
  Switch: ({ children }: { children: React.ReactNode }) =>
    <main>{children}</main>,

  Route: ({
    path,
    children,
    component,
  }: {
    path?: string;
    children?: React.ReactNode |
      ((params: { id: string; slug: string }) => React.ReactNode);
    component?: React.ComponentType;
  }) => {
    const content = typeof children === 'function'
      ? children({ id: 'course-123', slug: 'lesson-123' })
      : children;

    return (
      <section data-path={path ?? '*'}>
        {content ?? (component
          ? <span data-fallback="true" />
          : null)}
      </section>
    );
  },
}));

vi.mock('@/routing/ProtectedRoute', () => ({
  ProtectedRoute: ({
    roleRequired,
    moduleAccess,
    params,
  }: {
    roleRequired?: string;
    moduleAccess?: ModuleAccessPolicy;
    params?: Record<string, string>;
  }) => (
    <span
      data-protected="true"
      data-required-role={roleRequired}
      data-major-restrictions={moduleAccess?.majors?.join(',')}
      data-module-roles={moduleAccess?.roles.join(',')}
      data-restricted-roles={moduleAccess?.majorRestrictedRoles?.join(',')}
      data-param-id={params?.id}
      data-param-slug={params?.slug}
    />
  ),
}));

vi.mock('@/routing/RoleBasedDashboard', () => ({
  RoleBasedDashboard: () => null,
}));

vi.mock('@/pages/Login', () => ({
  default: () => null,
}));
vi.mock('@/pages/ResetPassword', () => ({
  default: () => null,
}));
vi.mock('@/pages/GuestLanding', () => ({
  default: () => <span data-guest="true" />,
}));
vi.mock('@/pages/Profile', () => ({
  default: () => null,
}));
vi.mock('@/pages/CourseManager', () => ({
  default: () => null,
}));
vi.mock('@/pages/StudentCourseView', () => ({
  default: () => null,
}));
vi.mock('@/pages/AIGenerator', () => ({
  default: () => null,
}));
vi.mock('@/pages/ExamRunner', () => ({
  default: () => null,
}));
vi.mock('@/pages/MathSolver', () => ({
  default: () => null,
}));
vi.mock('@/pages/CalculusSolver', () => ({
  default: () => null,
}));
vi.mock('@/pages/Solver', () => ({
  default: () => null,
}));

const Placeholder = () => null;

function renderRoutes() {
  return renderToStaticMarkup(
    <AppRoutes
      Home={Placeholder}
      CoursePlan={Placeholder}
      LessonPage={Placeholder}
      Lab={Placeholder}
      Quiz={Placeholder}
      NotFound={Placeholder}
    />
  );
}

function getRoutes(html: string) {
  return Array.from(
    html.matchAll(
      /<section data-path="([^"]+)">([\s\S]*?)<\/section>/g
    ),
    (match) => ({
      path: match[1],
      content: match[2],
    })
  );
}

function getRoute(path: string) {
  const route = getRoutes(renderRoutes())
    .find((item) => item.path === path);

  if (!route) throw new Error(`Missing route: ${path}`);

  return route.content;
}

beforeEach(() => {
  state.user = { id: 'test-user' };
  state.loading = false;
});

describe('AppRoutes', () => {
  it('preserves the full ordered route inventory', () => {
    const paths = getRoutes(renderRoutes())
      .map((route) => route.path);

    expect(paths).toEqual([
      '/reset-password',
      '/login',
      '/',
      '/dashboard',
      '/profile',
      '/course/:id',
      '/course/:id/view',
      '/course/:id/ai-tutor',
      '/exam/:id',
      '/ode',
      '/linear-algebra',
      '/math-solver',
      '/solver',
      '/calculus-1',
      '/calculus',
      '/lab',
      '/y-sheets',
      '/audit-log',
      '/engine-access',
      '/legacy-home',
      '/legacy-course',
      '/lesson/:slug',
      '/quiz',
      '*',
    ]);
  });

  it('shows the guest landing at the root without login', () => {
    state.user = null;

    const html = getRoute('/');

    expect(html).toContain('data-guest="true"');
    expect(html).not.toContain('data-protected');
  });

  it('protects the root for authenticated users', () => {
    expect(getRoute('/')).toContain('data-protected="true"');
  });

  it('protects every private route', () => {
    const publicPaths = new Set([
      '/login',
      '/reset-password',
      '*',
    ]);

    for (const route of getRoutes(renderRoutes())) {
      if (publicPaths.has(route.path)) continue;

      expect(route.content).toContain('data-protected="true"');
    }
  });

  it('restricts course management to instructors', () => {
    expect(getRoute('/course/:id')).toContain(
      'data-required-role="instructor"'
    );
  });

  it.each([
    '/calculus-1',
    '/linear-algebra',
    '/ode',
    '/math-solver',
    '/solver',
    '/calculus',
    '/lab',
  ])('applies the engine guard for %s', (path) => {
    expect(getRoute(path)).toContain(
      'data-major-restrictions="mathematics"'
    );
    expect(getRoute(path)).toContain('data-module-roles="student,instructor,admin,super_admin"');
    expect(getRoute(path)).toContain('data-restricted-roles="student"');
  });

  it.each([
    '/course/:id',
    '/course/:id/view',
    '/course/:id/ai-tutor',
    '/exam/:id',
  ])('passes the route id for %s', (path) => {
    expect(getRoute(path)).toContain(
      'data-param-id="course-123"'
    );
  });

  it('passes the lesson slug', () => {
    expect(getRoute('/lesson/:slug')).toContain(
      'data-param-slug="lesson-123"'
    );
  });

  it('preserves the not-found fallback', () => {
    expect(getRoute('*')).toContain('data-fallback="true"');
  });

  it('keeps login and password recovery outside route guards', () => {
    for (const path of ['/login', '/reset-password']) {
      expect(getRoute(path)).not.toContain('data-protected');
    }
  });
});
