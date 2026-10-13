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
  HeaderPageContext,
} from '../components/header/HeaderPageContext';

const languageState = vi.hoisted(() => ({
  current: 'en' as 'ar' | 'en',
}));

vi.mock('@/i18n/LanguageContext', () => ({
  useLanguage: () => ({
    language: languageState.current,
    t: (key: string) => `translation:${key}`,
  }),
}));

function makeProps() {
  return {
    currentTitle: 'Calculus',
    onOpenMobileNav: vi.fn(),
  };
}

afterEach(() => {
  cleanup();
  languageState.current = 'en';
  vi.clearAllMocks();
});

describe('HeaderPageContext', () => {
  it('renders the current title', () => {
    render(<HeaderPageContext {...makeProps()} />);

    expect(screen.getByText('Calculus'))
      .toBeTruthy();
  });

  it('preserves the Y-Hub brand', () => {
    render(<HeaderPageContext {...makeProps()} />);

    expect(screen.getByText('Y HUB'))
      .toBeTruthy();
  });

  it('renders the academy breadcrumb', () => {
    render(<HeaderPageContext {...makeProps()} />);

    expect(
      screen.getByText('translation:academy')
    ).toBeTruthy();
  });

  it('opens the mobile navigation', () => {
    const props = makeProps();

    render(<HeaderPageContext {...props} />);

    fireEvent.click(
      screen.getByTestId('button-open-mobile-nav')
    );

    expect(props.onOpenMobileNav)
      .toHaveBeenCalledOnce();
  });

  it('preserves the accessible mobile button', () => {
    render(<HeaderPageContext {...makeProps()} />);

    expect(
      screen.getByRole('button', {
        name: 'translation:openMenu',
      })
    ).toBeTruthy();
  });

  it('rotates the breadcrumb icon in English', () => {
    const { container } = render(
      <HeaderPageContext {...makeProps()} />
    );

    expect(
      container.querySelector('svg.rotate-180')
    ).toBeTruthy();
  });

  it('does not rotate the breadcrumb icon in Arabic', () => {
    languageState.current = 'ar';

    const { container } = render(
      <HeaderPageContext {...makeProps()} />
    );

    expect(
      container.querySelector('svg.rotate-180')
    ).toBeNull();
  });

  it('updates its title when props change', () => {
    const props = makeProps();

    const { rerender } = render(
      <HeaderPageContext {...props} />
    );

    rerender(
      <HeaderPageContext
        {...props}
        currentTitle="Physics"
      />
    );

    expect(screen.getByText('Physics'))
      .toBeTruthy();

    expect(screen.queryByText('Calculus'))
      .toBeNull();
  });

  it('preserves the mobile button styling', () => {
    render(<HeaderPageContext {...makeProps()} />);

    const button = screen.getByTestId(
      'button-open-mobile-nav'
    );

    expect(button.classList.contains('md:hidden'))
      .toBe(true);

    expect(button.classList.contains('rounded-xl'))
      .toBe(true);
  });

  it('does not open navigation during rendering', () => {
    const props = makeProps();

    render(<HeaderPageContext {...props} />);

    expect(props.onOpenMobileNav)
      .not.toHaveBeenCalled();
  });
});
