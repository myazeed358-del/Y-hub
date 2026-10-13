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

import {
  AppSidebar as LegacyAppSidebar,
} from '@/components/layout/AppSidebar';

import {
  AppSidebar,
} from '../components/sidebar/AppSidebar';

const languageState = vi.hoisted(() => ({
  current: 'ar' as 'ar' | 'en',
}));

vi.mock('@/i18n/LanguageContext', () => ({
  useLanguage: () => ({
    language: languageState.current,
    t: (key: string) => key,
  }),
}));

vi.mock('@/components/YHubLogo', () => ({
  default: () => (
    <span data-testid="sidebar-logo">
      Y-Hub Logo
    </span>
  ),
}));

vi.mock(
  '@/features/app-shell/components/sidebar/SidebarEngineSearch',
  () => ({
    SidebarEngineSearch: ({
      isInstructor,
      engineSearch,
      onEngineSearchChange,
      onCloseMobileNav,
    }: {
      isInstructor: boolean;
      engineSearch: string;
      onEngineSearchChange: (value: string) => void;
      onCloseMobileNav: () => void;
    }) => (
      <section
        data-testid="sidebar-engine-search"
        data-instructor={String(isInstructor)}
        data-query={engineSearch}
      >
        <button
          type="button"
          data-testid="change-engine-search"
          onClick={() => onEngineSearchChange('algebra')}
        >
          Search
        </button>
        <button
          type="button"
          data-testid="close-from-search"
          onClick={onCloseMobileNav}
        >
          Close
        </button>
      </section>
    ),
  })
);

vi.mock(
  '@/features/app-shell/components/sidebar/SidebarNavigation',
  () => ({
    SidebarNavigation: ({
      isInstructor,
      location,
      onCloseMobileNav,
      onEngineInfoTooltipChange,
    }: {
      isInstructor: boolean;
      location: string;
      onCloseMobileNav: () => void;
      onEngineInfoTooltipChange: (
        value: {
          engineId: string;
          top: number;
          anchorX: number;
        } | null
      ) => void;
    }) => (
      <nav
        data-testid="sidebar-navigation"
        data-location={location}
        data-instructor={String(isInstructor)}
      >
        <button
          type="button"
          data-testid="close-from-navigation"
          onClick={onCloseMobileNav}
        >
          Close
        </button>
        <button
          type="button"
          data-testid="show-engine-info"
          onClick={() => onEngineInfoTooltipChange({
            engineId: 'example-engine',
            top: 80,
            anchorX: 120,
          })}
        >
          Engine info
        </button>
      </nav>
    ),
  })
);

vi.mock(
  '@/features/app-shell/components/sidebar/SidebarAccountCard',
  () => ({
    SidebarAccountCard: ({
      accountName,
      academicMeta,
      avatarInitial,
      onCloseMobileNav,
    }: {
      accountName: string;
      academicMeta: string;
      avatarInitial: string;
      onCloseMobileNav: () => void;
    }) => (
      <section
        data-testid="sidebar-account"
        data-account={accountName}
        data-academic={academicMeta}
        data-initial={avatarInitial}
      >
        <button
          type="button"
          data-testid="close-from-account"
          onClick={onCloseMobileNav}
        >
          Close
        </button>
      </section>
    ),
  })
);

type Props = ComponentProps<typeof AppSidebar>;

function makeProps(
  overrides: Partial<Props> = {}
): Props {
  return {
    mobileNav: false,
    onCloseMobileNav: vi.fn(),
    activeCourseName: 'Calculus',
    isInstructor: true,
    location: '/dashboard',
    accountName: 'Example Student',
    academicMeta: 'Mathematics',
    avatarInitial: 'E',
    engineSearch: 'equations',
    onEngineSearchChange: vi.fn(),
    instructorSearchResults: [],
    quickPracticeSearchMatch: false,
    dynamicNavItems: [],
    majorLabels: {},
    onEngineInfoTooltipChange: vi.fn(),
    ...overrides,
  };
}

function sidebarElement() {
  return screen.getByRole('complementary');
}

afterEach(() => {
  cleanup();
  languageState.current = 'ar';
});

describe('AppSidebar', () => {
  it('preserves the legacy component export', () => {
    expect(LegacyAppSidebar).toBe(AppSidebar);
  });

  it('renders the Y-Hub logo', () => {
    render(<AppSidebar {...makeProps()} />);

    expect(
      screen.getByTestId('sidebar-logo')
    ).toBeTruthy();
  });

  it('positions the sidebar on the right in Arabic', () => {
    languageState.current = 'ar';

    render(<AppSidebar {...makeProps()} />);

    expect(
      sidebarElement().classList.contains('right-0')
    ).toBe(true);

    expect(
      sidebarElement().classList.contains('border-l')
    ).toBe(true);
  });

  it('positions the sidebar on the left in English', () => {
    languageState.current = 'en';

    render(<AppSidebar {...makeProps()} />);

    expect(
      sidebarElement().classList.contains('left-0')
    ).toBe(true);

    expect(
      sidebarElement().classList.contains('border-r')
    ).toBe(true);
  });

  it('preserves the closed Arabic mobile state', () => {
    languageState.current = 'ar';

    render(<AppSidebar {...makeProps()} />);

    expect(
      sidebarElement().classList.contains(
        'translate-x-full'
      )
    ).toBe(true);
  });

  it('preserves the closed English mobile state', () => {
    languageState.current = 'en';

    render(<AppSidebar {...makeProps()} />);

    expect(
      sidebarElement().classList.contains(
        '-translate-x-full'
      )
    ).toBe(true);
  });

  it('preserves the open mobile navigation state', () => {
    render(
      <AppSidebar
        {...makeProps({ mobileNav: true })}
      />
    );

    expect(
      sidebarElement().classList.contains(
        'translate-x-0'
      )
    ).toBe(true);
  });

  it('renders the current course name', () => {
    render(<AppSidebar {...makeProps()} />);

    expect(
      screen.getByText('Calculus')
    ).toBeTruthy();
  });

  it('preserves localized fallback titles', () => {
    languageState.current = 'ar';

    const props = makeProps({
      activeCourseName: null,
    });

    const { rerender } = render(
      <AppSidebar {...props} />
    );

    expect(
      screen.getByText('المنصة الأكاديمية الذكية')
    ).toBeTruthy();

    languageState.current = 'en';
    rerender(<AppSidebar {...props} />);

    expect(
      screen.getByText('Academic Intelligence Platform')
    ).toBeTruthy();
  });

  it('closes the mobile menu from its header', () => {
    const props = makeProps();

    render(<AppSidebar {...props} />);

    fireEvent.click(
      screen.getByTestId('button-close-mobile-nav')
    );

    expect(
      props.onCloseMobileNav
    ).toHaveBeenCalledOnce();
  });

  it('passes instructor search state and changes', () => {
    const props = makeProps();

    render(<AppSidebar {...props} />);

    const search = screen.getByTestId(
      'sidebar-engine-search'
    );

    expect(
      search.getAttribute('data-instructor')
    ).toBe('true');

    expect(
      search.getAttribute('data-query')
    ).toBe('equations');

    fireEvent.click(
      screen.getByTestId('change-engine-search')
    );

    expect(
      props.onEngineSearchChange
    ).toHaveBeenCalledWith('algebra');
  });

  it('passes route and engine tooltip callbacks', () => {
    const props = makeProps();

    render(<AppSidebar {...props} />);

    const navigation = screen.getByTestId(
      'sidebar-navigation'
    );

    expect(
      navigation.getAttribute('data-location')
    ).toBe('/dashboard');

    expect(
      navigation.getAttribute('data-instructor')
    ).toBe('true');

    fireEvent.click(
      screen.getByTestId('show-engine-info')
    );

    expect(
      props.onEngineInfoTooltipChange
    ).toHaveBeenCalledWith({
      engineId: 'example-engine',
      top: 80,
      anchorX: 120,
    });
  });

  it('passes account details to the account card', () => {
    render(<AppSidebar {...makeProps()} />);

    const account = screen.getByTestId(
      'sidebar-account'
    );

    expect(
      account.getAttribute('data-account')
    ).toBe('Example Student');

    expect(
      account.getAttribute('data-academic')
    ).toBe('Mathematics');

    expect(
      account.getAttribute('data-initial')
    ).toBe('E');
  });

  it('shares the close callback with child components', () => {
    const props = makeProps();

    render(<AppSidebar {...props} />);

    fireEvent.click(
      screen.getByTestId('close-from-search')
    );

    fireEvent.click(
      screen.getByTestId('close-from-navigation')
    );

    fireEvent.click(
      screen.getByTestId('close-from-account')
    );

    expect(
      props.onCloseMobileNav
    ).toHaveBeenCalledTimes(3);
  });

  it('updates content when props change', () => {
    const props = makeProps();

    const { rerender } = render(
      <AppSidebar {...props} />
    );

    rerender(
      <AppSidebar
        {...props}
        activeCourseName="Physics"
        accountName="Another Student"
        location="/course/physics"
      />
    );

    expect(
      screen.getByText('Physics')
    ).toBeTruthy();

    expect(
      screen.getByTestId('sidebar-account')
        .getAttribute('data-account')
    ).toBe('Another Student');

    expect(
      screen.getByTestId('sidebar-navigation')
        .getAttribute('data-location')
    ).toBe('/course/physics');
  });
});
