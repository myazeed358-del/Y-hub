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
  fireEvent,
  render,
  screen,
} from '@testing-library/react';

import type { ComponentProps } from 'react';

import type { AppHeader } from '@/features/app-shell/components/header/AppHeader';
import type { AppSidebar } from '@/components/layout/AppSidebar';

import {
  AppShellView,
  type AppShellViewProps,
} from '../components/AppShellView';

vi.mock('@/features/app-shell/components/header/AppHeader', () => ({
  AppHeader: ({
    currentTitle,
    onOpenMobileNav,
  }: {
    currentTitle: string;
    onOpenMobileNav: () => void;
  }) => (
    <header data-testid="test-header">
      <span>{currentTitle}</span>
      <button
        type="button"
        data-testid="test-open-menu"
        onClick={onOpenMobileNav}
      >
        Open
      </button>
    </header>
  ),
}));

vi.mock('@/features/app-shell/components/sidebar/AppSidebar', () => ({
  AppSidebar: ({
    mobileNav,
    activeCourseName,
    onCloseMobileNav,
  }: {
    mobileNav: boolean;
    activeCourseName: string | null;
    onCloseMobileNav: () => void;
  }) => (
    <aside
      data-testid="test-sidebar"
      data-mobile-nav={String(mobileNav)}
    >
      <span>{activeCourseName}</span>
      <button
        type="button"
        data-testid="test-close-menu"
        onClick={onCloseMobileNav}
      >
        Close
      </button>
    </aside>
  ),
}));

vi.mock(
  '@/features/app-shell/components/EngineInfoTooltip',
  () => ({
    EngineInfoTooltip: ({
      tooltip,
      language,
    }: {
      tooltip: { engineId: string } | null;
      language: string;
    }) => tooltip ? (
      <div
        data-testid="test-tooltip"
        data-language={language}
      >
        {tooltip.engineId}
      </div>
    ) : null,
  })
);

afterEach(() => {
  cleanup();
});

function makeProps(
  overrides: Partial<AppShellViewProps> = {}
): AppShellViewProps {

  // Complete props: no unsafe type assertions.
  const sidebarProps = {
    mobileNav: false,
    onCloseMobileNav: vi.fn(),
    activeCourseName: 'Biology',
    isInstructor: false,
    location: '/course/c1',
    accountName: 'Student',
    academicMeta: 'Mathematics',
    avatarInitial: 'S',
    engineSearch: '',
    onEngineSearchChange: vi.fn(),
    instructorSearchResults: [],
    quickPracticeSearchMatch: false,
    dynamicNavItems: [],
    majorLabels: {},
    onEngineInfoTooltipChange: vi.fn(),
  } satisfies ComponentProps<typeof AppSidebar>;

  const headerProps = {
    currentTitle: 'Course Title',
    firstName: 'Student',
    academicMeta: 'Mathematics',
    accountName: 'Student',
    avatarInitial: 'S',
    roleLabel: 'Student',
    userEmail: 'student@example.edu',
    onOpenMobileNav: vi.fn(),
    onSignOut: vi.fn(),
  } satisfies ComponentProps<typeof AppHeader>;

  return {
    children: <p>Academic content</p>,
    language: 'ar',
    t: (key) => key,
    mobileNav: false,
    closeMobileNav: vi.fn(),
    tooltip: null,
    sidebarProps,
    headerProps,
    ...overrides,
  };
}

describe('AppShellView', () => {
  it('renders header, sidebar and content', () => {
    render(<AppShellView {...makeProps()} />);

    expect(screen.getByTestId('test-header'))
      .toBeTruthy();

    expect(screen.getByTestId('test-sidebar'))
      .toBeTruthy();

    expect(screen.getByText('Academic content'))
      .toBeTruthy();
  });

  it('preserves RTL layout', () => {
    const { container } = render(
      <AppShellView {...makeProps()} />
    );

    expect(
      container.firstElementChild?.getAttribute('dir')
    ).toBe('rtl');

    const contentWrapper =
      container.querySelector('main')?.parentElement;

    expect(contentWrapper?.className)
      .toContain('md:mr-[288px]');
  });

  it('preserves LTR layout', () => {
    const { container } = render(
      <AppShellView
        {...makeProps({ language: 'en' })}
      />
    );

    expect(
      container.firstElementChild?.getAttribute('dir')
    ).toBe('ltr');

    const contentWrapper =
      container.querySelector('main')?.parentElement;

    expect(contentWrapper?.className)
      .toContain('md:ml-[288px]');
  });

  it('hides backdrop when menu is closed', () => {
    render(<AppShellView {...makeProps()} />);

    expect(
      screen.queryByTestId('button-mobile-nav-backdrop')
    ).toBeNull();
  });

  it('shows backdrop when menu is open', () => {
    render(
      <AppShellView
        {...makeProps({ mobileNav: true })}
      />
    );

    expect(
      screen.getByTestId('button-mobile-nav-backdrop')
    ).toBeTruthy();
  });

  it('closes menu through backdrop', () => {
    const closeMobileNav = vi.fn();

    render(
      <AppShellView
        {...makeProps({
          mobileNav: true,
          closeMobileNav,
        })}
      />
    );

    fireEvent.click(
      screen.getByTestId('button-mobile-nav-backdrop')
    );

    expect(closeMobileNav).toHaveBeenCalledOnce();
  });

  it('preserves header and sidebar values', () => {
    render(<AppShellView {...makeProps()} />);

    expect(screen.getByText('Course Title'))
      .toBeTruthy();

    expect(screen.getByText('Biology'))
      .toBeTruthy();
  });

  it('passes tooltip selection and language', () => {
    render(
      <AppShellView
        {...makeProps({
          tooltip: {
            engineId: 'calculus-plotter',
            top: 100,
            anchorX: 200,
          },
          language: 'en',
        })}
      />
    );

    const tooltip = screen.getByTestId('test-tooltip');

    expect(tooltip.textContent)
      .toContain('calculus-plotter');

    expect(tooltip.getAttribute('data-language'))
      .toBe('en');
  });

  it('preserves main content layout', () => {
    const { container } = render(
      <AppShellView {...makeProps()} />
    );

    const main = container.querySelector('main');

    expect(main).toBeTruthy();

    expect(main?.className)
      .toContain('max-w-[1480px]');
  });
});
