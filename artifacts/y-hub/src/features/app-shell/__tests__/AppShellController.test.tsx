import * as React from 'react';

import {
  renderToStaticMarkup,
} from 'react-dom/server';

import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  AppShell as LegacyAppShell,
} from '@/components/layout/AppShell';

import {
  AppShell as FeatureAppShell,
} from '../components/AppShellController';

import {
  AppShellView,
} from '../components/AppShellView';

vi.mock('wouter', () => ({
  useLocation: () => [
    '/dashboard',
    () => undefined,
  ],
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    profile: {
      full_name: 'Example Student',
      role: 'student',
      major: 'mathematics',
      study_year: 2,
    },
    user: {
      email: 'student@example.edu',
    },
    signOut: async () => undefined,
  }),
}));

vi.mock('@/i18n/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'en',
    t: (key: string) => `translated:${key}`,
  }),
}));

vi.mock(
  '@/features/app-shell/hooks/useActiveCourseName',
  () => ({
    useActiveCourseName: () => 'Biology',
  })
);

vi.mock(
  '@/features/app-shell/hooks/useAppNavigation',
  () => ({
    useAppNavigation: () => ({
      mobileNav: false,
      openMobileNav: () => undefined,
      closeMobileNav: () => undefined,
      dynamicNavItems: [],
    }),
  })
);

vi.mock(
  '@/features/app-shell/hooks/useInstructorEngineSearch',
  () => ({
    useInstructorEngineSearch: () => ({
      engineSearch: '',
      setEngineSearch: () => undefined,
      instructorSearchResults: [],
      quickPracticeSearchMatch: false,
    }),
  })
);

vi.mock(
  '@/features/app-shell/hooks/useAppSignOut',
  () => ({
    useAppSignOut: () => async () => undefined,
  })
);

vi.mock(
  '@/features/app-shell/hooks/useEngineInfoTooltip',
  () => ({
    useEngineInfoTooltip: () => ({
      engineInfoTooltip: null,
      setEngineInfoTooltip: () => undefined,
    }),
  })
);

vi.mock(
  '@/features/app-shell/components/AppShellView',
  () => ({
    AppShellView: vi.fn(
      ({
        children,
      }: {
        children: React.ReactNode;
      }) => (
        <div data-testid="controller-view">
          {children}
        </div>
      )
    ),
  })
);

beforeEach(() => {
  vi.mocked(AppShellView).mockClear();
});

function renderController() {
  return renderToStaticMarkup(
    <LegacyAppShell>
      <span>Academic content</span>
    </LegacyAppShell>
  );
}

function capturedProps() {
  renderController();

  const props =
    vi.mocked(AppShellView).mock.calls[0]?.[0];

  expect(props).toBeDefined();

  return props!;
}

describe('AppShellController', () => {
  it('preserves legacy exports', () => {
    expect(LegacyAppShell).toBe(FeatureAppShell);
  });

  it('preserves the public component name', () => {
    expect(FeatureAppShell.name).toBe('AppShell');
  });

  it('renders content through the View', () => {
    const html = renderController();

    expect(html).toContain('Academic content');

    expect(AppShellView)
      .toHaveBeenCalledOnce();
  });

  it('provides academic account and header data', () => {
    const props = capturedProps();

    expect(props.headerProps.currentTitle)
      .toBe('translated:overview');

    expect(props.headerProps.accountName)
      .toBe('Example Student');

    expect(props.headerProps.userEmail)
      .toBe('student@example.edu');

    expect(props.headerProps.roleLabel)
      .toBe('Student');
  });

  it('provides sidebar and course context', () => {
    const props = capturedProps();

    expect(props.sidebarProps.activeCourseName)
      .toBe('Biology');

    expect(props.sidebarProps.isInstructor)
      .toBe(false);

    expect(props.sidebarProps.location)
      .toBe('/dashboard');

    expect(
      props.sidebarProps.majorLabels.mathematics.en
    ).toBe('Mathematics');

    expect(props.sidebarProps.dynamicNavItems)
      .toEqual([]);
  });

  it('preserves navigation and tooltip contracts', () => {
    const props = capturedProps();

    expect(props.language).toBe('en');
    expect(props.mobileNav).toBe(false);
    expect(props.tooltip).toBeNull();

    expect(props.sidebarProps.onCloseMobileNav)
      .toBe(props.closeMobileNav);

    expect(typeof props.headerProps.onOpenMobileNav)
      .toBe('function');

    expect(typeof props.headerProps.onSignOut)
      .toBe('function');

    expect(
      typeof props.sidebarProps.onEngineInfoTooltipChange
    ).toBe('function');
  });
});
