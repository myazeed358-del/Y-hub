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

import {
  SidebarAccountCard as LegacyCard,
} from '@/components/layout/SidebarAccountCard';

import {
  SidebarAccountCard,
} from '../components/sidebar/SidebarAccountCard';

vi.mock('wouter', () => ({
  Link: ({
    href,
    children,
    className,
    onClick,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
    onClick?: React.MouseEventHandler<HTMLAnchorElement>;
  }) => (
    <a
      href={href}
      className={className}
      onClick={(event) => {
        event.preventDefault();
        onClick?.(event);
      }}
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
      className,
    }: {
      children: React.ReactNode;
      className?: string;
    }) => (
      <div
        data-testid="account-avatar"
        className={className}
      >
        {children}
      </div>
    ),
    AvatarImage: ({
      alt,
    }: {
      alt: string;
    }) => (
      <span
        data-testid="account-avatar-image"
        data-alt={alt}
      />
    ),
    AvatarFallback: ({
      children,
    }: {
      children: React.ReactNode;
    }) => (
      <span data-testid="account-avatar-fallback">
        {children}
      </span>
    ),
  })
);

afterEach(() => {
  cleanup();
});

function makeProps() {
  return {
    accountName: 'Example Student',
    academicMeta: 'Mathematics · Year 2',
    avatarInitial: 'E',
    onCloseMobileNav: vi.fn(),
  };
}

describe('SidebarAccountCard', () => {
  it('preserves the legacy component export', () => {
    expect(LegacyCard).toBe(SidebarAccountCard);
  });

  it('renders the account name', () => {
    render(<SidebarAccountCard {...makeProps()} />);

    expect(screen.getByText('Example Student'))
      .toBeTruthy();
  });

  it('renders the academic information', () => {
    render(<SidebarAccountCard {...makeProps()} />);

    expect(screen.getByText('Mathematics · Year 2'))
      .toBeTruthy();
  });

  it('renders the avatar initial', () => {
    render(<SidebarAccountCard {...makeProps()} />);

    expect(
      screen.getByTestId(
        'account-avatar-fallback'
      ).textContent
    ).toBe('E');
  });

  it('preserves the avatar alternative text', () => {
    render(<SidebarAccountCard {...makeProps()} />);

    expect(
      screen.getByTestId(
        'account-avatar-image'
      ).getAttribute('data-alt')
    ).toBe('Example Student');
  });

  it('preserves the profile destination', () => {
    render(<SidebarAccountCard {...makeProps()} />);

    expect(
      screen.getByRole('link').getAttribute('href')
    ).toBe('/profile');
  });

  it('closes mobile navigation when selected', () => {
    const props = makeProps();

    render(<SidebarAccountCard {...props} />);

    fireEvent.click(screen.getByRole('link'));

    expect(props.onCloseMobileNav)
      .toHaveBeenCalledOnce();
  });

  it('updates when account props change', () => {
    const props = makeProps();

    const { rerender } = render(
      <SidebarAccountCard {...props} />
    );

    rerender(
      <SidebarAccountCard
        {...props}
        accountName="Another Student"
        academicMeta="Law · Year 3"
        avatarInitial="A"
      />
    );

    expect(screen.getByText('Another Student'))
      .toBeTruthy();

    expect(screen.getByText('Law · Year 3'))
      .toBeTruthy();

    expect(
      screen.getByTestId(
        'account-avatar-fallback'
      ).textContent
    ).toBe('A');
  });

  it('preserves the layout styling', () => {
    render(<SidebarAccountCard {...makeProps()} />);

    const link = screen.getByRole('link');

    expect(link.className).toContain('rounded-2xl');
    expect(link.className).toContain('flex');

    expect(screen.getByTestId('account-avatar'))
      .toBeTruthy();
  });
});
