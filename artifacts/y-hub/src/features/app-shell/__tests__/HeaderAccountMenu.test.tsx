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
  HeaderAccountMenu,
} from '../components/header/HeaderAccountMenu';

const languageState = vi.hoisted(() => ({
  current: 'en' as 'ar' | 'en',
}));

vi.mock('@/i18n/LanguageContext', () => ({
  useLanguage: () => ({
    language: languageState.current,
  }),
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
        data-testid="account-menu-avatar-image"
        data-alt={alt}
      />
    ),

    AvatarFallback: ({
      children,
    }: {
      children: React.ReactNode;
    }) => (
      <span data-testid="account-menu-avatar-fallback">
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

type Props = ComponentProps<typeof HeaderAccountMenu>;

function makeProps(
  overrides: Partial<Props> = {}
): Props {
  return {
    accountName: 'Mira Student',
    academicMeta: 'Mathematics - Year 2',
    avatarInitial: 'M',
    roleLabel: 'Student',
    userEmail: 'mira@example.edu',
    onSignOut: vi.fn(),
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  languageState.current = 'en';
  vi.clearAllMocks();
});

describe('HeaderAccountMenu', () => {
  it('preserves the English accessible trigger', () => {
    render(<HeaderAccountMenu {...makeProps()} />);

    expect(
      screen.getByRole('button', {
        name: 'Open account menu',
      })
    ).toBeTruthy();
  });

  it('preserves the Arabic accessible trigger', () => {
    languageState.current = 'ar';

    render(<HeaderAccountMenu {...makeProps()} />);

    expect(
      screen.getByRole('button', {
        name: 'فتح قائمة الحساب',
      })
    ).toBeTruthy();
  });

  it('displays the account name', () => {
    render(<HeaderAccountMenu {...makeProps()} />);

    expect(
      screen.getByText('Mira Student')
    ).toBeTruthy();
  });

  it('preserves avatar initial and alternative text', () => {
    render(<HeaderAccountMenu {...makeProps()} />);

    expect(
      screen.getByTestId(
        'account-menu-avatar-fallback'
      ).textContent
    ).toBe('M');

    expect(
      screen.getByTestId(
        'account-menu-avatar-image'
      ).getAttribute('data-alt')
    ).toBe('Mira Student');
  });

  it('displays the account email', () => {
    render(<HeaderAccountMenu {...makeProps()} />);

    expect(
      screen.getByText('mira@example.edu')
    ).toBeTruthy();
  });

  it('falls back to academic metadata without email', () => {
    render(
      <HeaderAccountMenu
        {...makeProps({
          userEmail: undefined,
        })}
      />
    );

    expect(
      screen.getByText('Mathematics - Year 2')
    ).toBeTruthy();
  });

  it('displays the academic role', () => {
    render(<HeaderAccountMenu {...makeProps()} />);

    expect(
      screen.getByText('Student')
    ).toBeTruthy();
  });

  it('preserves the profile destination', () => {
    render(<HeaderAccountMenu {...makeProps()} />);

    expect(
      screen.getByRole('link').getAttribute('href')
    ).toBe('/profile');
  });

  it('shows the Arabic profile label', () => {
    languageState.current = 'ar';

    render(<HeaderAccountMenu {...makeProps()} />);

    expect(
      screen.getByText('الملف الشخصي')
    ).toBeTruthy();
  });

  it('forwards the English sign-out action', () => {
    const props = makeProps();

    render(<HeaderAccountMenu {...props} />);

    fireEvent.click(
      screen.getByText('Log out')
    );

    expect(
      props.onSignOut
    ).toHaveBeenCalledOnce();
  });

  it('forwards the Arabic sign-out action', () => {
    languageState.current = 'ar';

    const props = makeProps();

    render(<HeaderAccountMenu {...props} />);

    fireEvent.click(
      screen.getByText('تسجيل الخروج')
    );

    expect(
      props.onSignOut
    ).toHaveBeenCalledOnce();
  });

  it('updates account information when props change', () => {
    const props = makeProps();

    const { rerender } = render(
      <HeaderAccountMenu {...props} />
    );

    rerender(
      <HeaderAccountMenu
        {...props}
        accountName="Another Student"
        avatarInitial="A"
        roleLabel="Instructor"
        userEmail="teacher@example.edu"
      />
    );

    expect(
      screen.getByText('Another Student')
    ).toBeTruthy();

    expect(
      screen.getByText('Instructor')
    ).toBeTruthy();

    expect(
      screen.getByText('teacher@example.edu')
    ).toBeTruthy();

    expect(
      screen.getByTestId(
        'account-menu-avatar-fallback'
      ).textContent
    ).toBe('A');
  });
});
