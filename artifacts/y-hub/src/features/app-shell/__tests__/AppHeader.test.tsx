import * as React from 'react';

import type { ComponentProps } from 'react';

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

import {
  AppHeader as LegacyAppHeader,
} from '@/components/layout/AppHeader';

import {
  AppHeader,
} from '../components/header/AppHeader';

const languageState = vi.hoisted(() => ({
  current: 'en' as 'ar' | 'en',
  setLanguage: vi.fn(),
}));

vi.mock('@/i18n/LanguageContext', () => ({
  useLanguage: () => ({
    language: languageState.current,
    setLanguage: languageState.setLanguage,
    t: (key: string) => key,
  }),
}));

vi.mock('@/components/ThemeToggle', () => ({
  ThemeToggle: () => (
    <span data-testid="theme-toggle">
      Theme
    </span>
  ),
}));

vi.mock('wouter', () => ({
  Link: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a
      href={href}
      className={className}
      onClick={(event) => event.preventDefault()}
    >
      {children}
    </a>
  ),
}));

vi.mock(
  '@workspace/y-hub-ds/components/ui/avatar',
  () => ({
    Avatar: ({
      children,
    }: {
      children: React.ReactNode;
    }) => <div>{children}</div>,

    AvatarImage: ({
      alt,
    }: {
      alt: string;
    }) => (
      <span
        data-testid="header-avatar-image"
        data-alt={alt}
      />
    ),

    AvatarFallback: ({
      children,
    }: {
      children: React.ReactNode;
    }) => (
      <span data-testid="header-avatar-fallback">
        {children}
      </span>
    ),
  })
);

vi.mock(
  '@workspace/y-hub-ds/components/ui/dropdown-menu',
  () => ({
    DropdownMenu: ({
      children,
    }: {
      children: React.ReactNode;
    }) => <div>{children}</div>,

    DropdownMenuTrigger: ({
      children,
    }: {
      children: React.ReactNode;
    }) => <>{children}</>,

    DropdownMenuContent: ({
      children,
    }: {
      children: React.ReactNode;
    }) => <div>{children}</div>,

    DropdownMenuLabel: ({
      children,
    }: {
      children: React.ReactNode;
    }) => <div>{children}</div>,

    DropdownMenuSeparator: () => <hr />,

    DropdownMenuItem: ({
      children,
      onClick,
    }: {
      children: React.ReactNode;
      onClick?: () => void | Promise<void>;
    }) => (
      <div onClick={onClick}>
        {children}
      </div>
    ),
  })
);

type Props = ComponentProps<typeof AppHeader>;

function makeProps(
  overrides: Partial<Props> = {}
): Props {
  return {
    currentTitle: 'Overview',
    firstName: 'Noor',
    academicMeta: 'Mathematics - Year 2',
    accountName: 'Noor Student',
    avatarInitial: 'N',
    roleLabel: 'Student',
    userEmail: 'student@example.edu',
    onOpenMobileNav: vi.fn(),
    onSignOut: vi.fn(),
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  languageState.current = 'en';
  vi.clearAllMocks();
});

describe('AppHeader', () => {
  it('preserves the legacy export', () => {
    expect(LegacyAppHeader).toBe(AppHeader);
  });

  it('renders the current title', () => {
    render(<AppHeader {...makeProps()} />);

    expect(screen.getByText('Overview'))
      .toBeTruthy();
  });

  it('preserves the academy breadcrumb', () => {
    render(<AppHeader {...makeProps()} />);

    expect(screen.getByText('academy'))
      .toBeTruthy();

    expect(screen.getByText('Y HUB'))
      .toBeTruthy();
  });

  it('shows the English welcome message', () => {
    render(<AppHeader {...makeProps()} />);

    expect(screen.getByText('Welcome, Noor'))
      .toBeTruthy();
  });

  it('shows the Arabic welcome message', () => {
    languageState.current = 'ar';

    render(<AppHeader {...makeProps()} />);

    expect(screen.getByText('مرحباً، Noor'))
      .toBeTruthy();
  });

  it('opens the mobile menu', () => {
    const props = makeProps();

    render(<AppHeader {...props} />);

    fireEvent.click(
      screen.getByTestId('button-open-mobile-nav')
    );

    expect(props.onOpenMobileNav)
      .toHaveBeenCalledOnce();
  });

  it('switches from English to Arabic', () => {
    render(<AppHeader {...makeProps()} />);

    const button = screen.getByTestId(
      'button-language-toggle'
    );

    expect(button.textContent).toBe('AR');

    fireEvent.click(button);

    expect(languageState.setLanguage)
      .toHaveBeenCalledWith('ar');
  });

  it('switches from Arabic to English', () => {
    languageState.current = 'ar';

    render(<AppHeader {...makeProps()} />);

    const button = screen.getByTestId(
      'button-language-toggle'
    );

    expect(button.textContent).toBe('EN');

    fireEvent.click(button);

    expect(languageState.setLanguage)
      .toHaveBeenCalledWith('en');
  });

  it('preserves the theme toggle', () => {
    render(<AppHeader {...makeProps()} />);

    expect(screen.getByTestId('theme-toggle'))
      .toBeTruthy();
  });

  it('renders avatar initial and alt text', () => {
    render(<AppHeader {...makeProps()} />);

    expect(
      screen.getByTestId(
        'header-avatar-fallback'
      ).textContent
    ).toBe('N');

    expect(
      screen.getByTestId(
        'header-avatar-image'
      ).getAttribute('data-alt')
    ).toBe('Noor Student');
  });

  it('renders account identity and email', () => {
    render(<AppHeader {...makeProps()} />);

    expect(screen.getByText('Noor Student'))
      .toBeTruthy();

    expect(screen.getByText('Student'))
      .toBeTruthy();

    expect(screen.getByText('student@example.edu'))
      .toBeTruthy();
  });

  it('uses academic details when email is missing', () => {
    render(
      <AppHeader
        {...makeProps({
          userEmail: undefined,
        })}
      />
    );

    expect(
      screen.getAllByText(
        'Mathematics - Year 2'
      ).length
    ).toBeGreaterThanOrEqual(2);
  });

  it('preserves the profile route', () => {
    render(<AppHeader {...makeProps()} />);

    expect(
      screen.getByRole('link').getAttribute('href')
    ).toBe('/profile');
  });

  it('forwards the sign-out callback', () => {
    const props = makeProps();

    render(<AppHeader {...props} />);

    fireEvent.click(
      screen.getByText('Log out')
    );

    expect(props.onSignOut)
      .toHaveBeenCalledOnce();
  });

  it('updates title and account when props change', () => {
    const props = makeProps();

    const { rerender } = render(
      <AppHeader {...props} />
    );

    rerender(
      <AppHeader
        {...props}
        currentTitle="Physics"
        accountName="Another Student"
        avatarInitial="A"
      />
    );

    expect(screen.getByText('Physics'))
      .toBeTruthy();

    expect(screen.getByText('Another Student'))
      .toBeTruthy();

    expect(
      screen.getByTestId(
        'header-avatar-fallback'
      ).textContent
    ).toBe('A');
  });
});
