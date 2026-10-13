import * as React from 'react';

import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  cleanup,
  render,
  screen,
} from '@testing-library/react';

const frameState = vi.hoisted(() => ({
  location: '/dashboard',
  user: { id: 'test-user' } as { id: string } | null,
  loading: false,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: frameState.user,
    loading: frameState.loading,
  }),
}));

vi.mock('wouter', () => ({
  useLocation: () => [
    frameState.location,
    vi.fn(),
  ],
}));

vi.mock('@/features/app-shell', () => ({
  AppShell: ({
    children,
  }: {
    children: React.ReactNode;
  }) => (
    <section data-testid="application-shell">
      {children}
    </section>
  ),
}));

vi.mock('@/components/error-boundary', () => ({
  ErrorBoundary: ({
    children,
    resetKey,
  }: {
    children: React.ReactNode;
    resetKey: string;
  }) => (
    <section
      data-testid="frame-error-boundary"
      data-reset-key={resetKey}
    >
      {children}
    </section>
  ),
}));

vi.mock('@/routing/AppRoutes', () => ({
  AppRoutes: () => (
    <div data-testid="application-routes">
      Application routes
    </div>
  ),
}));

vi.mock('@/pages/legacy/Home', () => ({
  default: () => null,
}));

vi.mock('@/pages/legacy/CoursePlan', () => ({
  default: () => null,
}));

vi.mock('@/pages/legacy/LessonPage', () => ({
  default: () => null,
}));

vi.mock('@/pages/legacy/NotFound', () => ({
  default: () => null,
}));

vi.mock('@/pages/legacy/Lab', () => ({
  default: () => null,
}));

vi.mock('@/pages/legacy/Quiz', () => ({
  default: () => null,
}));

import {
  ApplicationFrame,
} from '../ApplicationFrame';

import {
  ApplicationFrame as LegacyApplicationFrame,
} from '@/components/layout/ApplicationFrame';

afterEach(() => {
  cleanup();
  frameState.location = '/dashboard';
  frameState.user = { id: 'test-user' };
  frameState.loading = false;
  vi.clearAllMocks();
});

describe('ApplicationFrame', () => {
  it('preserves the old component export identity', () => {
    expect(LegacyApplicationFrame)
      .toBe(ApplicationFrame);
  });

  it('shows a loading screen while auth is loading', () => {
    frameState.loading = true;

    render(<ApplicationFrame />);

    expect(
      screen.getByText('جاري تحميل Y HUB...')
    ).toBeTruthy();

    expect(
      screen.queryByTestId('application-shell')
    ).toBeNull();

    expect(
      screen.queryByTestId('application-routes')
    ).toBeNull();
  });

  it('renders routes without a shell for signed-out users', () => {
    frameState.user = null;

    render(<ApplicationFrame />);

    expect(
      screen.getByTestId('application-routes')
    ).toBeTruthy();

    expect(
      screen.queryByTestId('application-shell')
    ).toBeNull();
  });

  it('wraps authenticated routes in AppShell', () => {
    render(<ApplicationFrame />);

    expect(
      screen.getByTestId('application-shell')
    ).toBeTruthy();

    expect(
      screen.getByTestId('application-routes')
    ).toBeTruthy();
  });

  it('keeps login routes outside AppShell', () => {
    frameState.location = '/login';

    render(<ApplicationFrame />);

    expect(
      screen.queryByTestId('application-shell')
    ).toBeNull();

    expect(
      screen.getByTestId('application-routes')
    ).toBeTruthy();
  });

  it('keeps password recovery outside AppShell', () => {
    frameState.location = '/reset-password';

    render(<ApplicationFrame />);

    expect(
      screen.queryByTestId('application-shell')
    ).toBeNull();

    expect(
      screen.getByTestId('application-routes')
    ).toBeTruthy();
  });

  it('passes the current route to the error boundary', () => {
    frameState.location = '/course/example';

    render(<ApplicationFrame />);

    expect(
      screen.getByTestId('frame-error-boundary')
        .getAttribute('data-reset-key')
    ).toBe('/course/example');
  });

  it('updates the shell when authentication changes', () => {
    frameState.user = null;

    const { rerender } = render(
      <ApplicationFrame />
    );

    expect(
      screen.queryByTestId('application-shell')
    ).toBeNull();

    frameState.user = { id: 'signed-in-user' };

    rerender(<ApplicationFrame />);

    expect(
      screen.getByTestId('application-shell')
    ).toBeTruthy();
  });
});
