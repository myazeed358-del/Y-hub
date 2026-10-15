import * as React from 'react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import type { EngineAccessRole } from '@/config/majorEngineAccess';
import { ProtectedRoute } from '../ProtectedRoute';

const state = vi.hoisted(() => ({
  auth: {
    user: null as null | { id: string },
    role: null as null |
      'student' | 'instructor' | 'admin' | 'super_admin',
    profile: null as null | { major: string | null },
    loading: false,
  },
  language: 'ar' as 'ar' | 'en',
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => state.auth,
}));

vi.mock('@/i18n/LanguageContext', () => ({
  useLanguage: () => ({
    language: state.language,
    setLanguage: vi.fn(),
  }),
}));

vi.mock('@/pages/Login', () => ({
  default: () => <div>MOCK_LOGIN_SCREEN</div>,
}));

vi.mock('wouter', () => ({
  Link: ({
    href,
    children,
  }: {
    href: string;
    children: ReactNode;
  }) => <a href={href}>{children}</a>,
}));

function Target({ label = 'TARGET_PAGE' }: { label?: string }) {
  return <div>{label}</div>;
}

function renderGuard(
  options: {
    roleRequired?: EngineAccessRole;
    enginePath?: string;
    label?: string;
  } = {}
) {
  return renderToStaticMarkup(
    <ProtectedRoute component={Target} {...options} />
  );
}

function loginAs(
  role: 'student' | 'instructor' | 'admin' | 'super_admin',
  major: string | null = 'mathematics'
) {
  state.auth.user = { id: 'test-user' };
  state.auth.role = role;
  state.auth.profile = { major };
  state.auth.loading = false;
}

beforeEach(() => {
  state.auth.user = null;
  state.auth.role = null;
  state.auth.profile = null;
  state.auth.loading = false;
  state.language = 'ar';
});

describe('ProtectedRoute', () => {
  it('shows loading state before checking permissions', () => {
    state.auth.loading = true;

    const html = renderGuard();

    expect(html).toContain('جاري التحقق من الصلاحيات');
    expect(html).not.toContain('TARGET_PAGE');
  });

  it('shows login for unauthenticated users', () => {
    const html = renderGuard();

    expect(html).toContain('MOCK_LOGIN_SCREEN');
    expect(html).not.toContain('TARGET_PAGE');
  });

  it('allows a mathematics student into their engine', () => {
    loginAs('student', 'mathematics');

    const html = renderGuard({
      enginePath: '/calculus',
    });

    expect(html).toContain('TARGET_PAGE');
  });

  it('allows mathematics students into Calculus 1', () => {
    loginAs('student', 'mathematics');
    expect(
      renderGuard({ enginePath: '/calculus-1' })
    ).toContain('TARGET_PAGE');
  });

  it('denies unrelated students access to Calculus 1', () => {
    loginAs('student', 'medicine');
    expect(
      renderGuard({ enginePath: '/calculus-1' })
    ).not.toContain('TARGET_PAGE');
  });

  it('allows administrators into Calculus 1', () => {
    loginAs('admin', null);
    expect(
      renderGuard({ enginePath: '/calculus-1' })
    ).toContain('TARGET_PAGE');
  });

  it('denies a student without the required major', () => {
    loginAs('student', 'medicine');

    const html = renderGuard({
      enginePath: '/calculus',
    });

    expect(html).toContain('هذه الأداة غير متاحة لحسابك');
    expect(html).not.toContain('TARGET_PAGE');
  });

  it('denies a student without a major', () => {
    loginAs('student', null);

    const html = renderGuard({
      enginePath: '/solver',
    });

    expect(html).not.toContain('TARGET_PAGE');
    expect(html).toContain('هذه الأداة غير متاحة');
  });

  it('denies a student access to instructor routes', () => {
    loginAs('student');

    const html = renderGuard({
      roleRequired: 'instructor',
    });

    expect(html).toContain('Access Denied');
    expect(html).not.toContain('TARGET_PAGE');
  });

  it('allows an instructor into instructor routes', () => {
    loginAs('instructor');

    const html = renderGuard({
      roleRequired: 'instructor',
    });

    expect(html).toContain('TARGET_PAGE');
  });

  it.each(['admin', 'super_admin'] as const)(
    'allows %s to bypass instructor role restrictions',
    (role) => {
      loginAs(role, null);

      const html = renderGuard({
        roleRequired: 'instructor',
      });

      expect(html).toContain('TARGET_PAGE');
    }
  );

  it.each(['admin', 'super_admin'] as const)(
    'allows %s access to mathematics engines',
    (role) => {
      loginAs(role, null);

      const html = renderGuard({
        enginePath: '/calculus',
      });

      expect(html).toContain('TARGET_PAGE');
    }
  );

  it('forwards page props to the target component', () => {
    loginAs('student');

    const html = renderGuard({
      label: 'COURSE_123',
    });

    expect(html).toContain('COURSE_123');
  });

  it('shows English engine denial when English is selected', () => {
    loginAs('student', 'medicine');
    state.language = 'en';

    const html = renderGuard({
      enginePath: '/calculus',
    });

    expect(html).toContain(
      'This tool is not available for your account'
    );
    expect(html).not.toContain('TARGET_PAGE');
  });
});
