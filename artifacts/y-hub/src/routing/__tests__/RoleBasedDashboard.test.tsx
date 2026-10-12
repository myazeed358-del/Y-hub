import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { RoleBasedDashboard } from '../RoleBasedDashboard';

type Role = 'student' | 'instructor' | 'admin' | 'super_admin';

const state = vi.hoisted(() => ({
  auth: {
    role: null as Role | null,
    loading: false,
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => state.auth,
}));

vi.mock('@/pages/Dashboard', () => ({
  default: () => 'INSTRUCTOR_DASHBOARD',
}));

vi.mock('@/pages/StudentDashboard', () => ({
  default: () => 'STUDENT_DASHBOARD',
}));

function renderDashboard() {
  return renderToStaticMarkup(
    React.createElement(RoleBasedDashboard)
  );
}

beforeEach(() => {
  state.auth.role = null;
  state.auth.loading = false;
});

describe('RoleBasedDashboard', () => {
  it('shows loading state while authentication is loading', () => {
    state.auth.loading = true;

    const html = renderDashboard();

    expect(html).toContain('Loading Auth...');
    expect(html).not.toContain('INSTRUCTOR_DASHBOARD');
    expect(html).not.toContain('STUDENT_DASHBOARD');
  });

  it('shows StudentDashboard for a student', () => {
    state.auth.role = 'student';

    const html = renderDashboard();

    expect(html).toContain('STUDENT_DASHBOARD');
    expect(html).not.toContain('INSTRUCTOR_DASHBOARD');
  });

  it.each(['instructor', 'admin', 'super_admin'] as const)(
    'shows Dashboard for %s',
    (role) => {
      state.auth.role = role;

      const html = renderDashboard();

      expect(html).toContain('INSTRUCTOR_DASHBOARD');
      expect(html).not.toContain('STUDENT_DASHBOARD');
    }
  );

  it('preserves current fallback behavior for a missing role', () => {
    state.auth.role = null;

    const html = renderDashboard();

    expect(html).toContain('STUDENT_DASHBOARD');
    expect(html).not.toContain('INSTRUCTOR_DASHBOARD');
  });
});
