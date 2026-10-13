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

import {
  HeaderWelcomeMessage,
} from '../components/header/HeaderWelcomeMessage';

const languageState = vi.hoisted(() => ({
  current: 'en' as 'ar' | 'en',
}));

vi.mock('@/i18n/LanguageContext', () => ({
  useLanguage: () => ({
    language: languageState.current,
  }),
}));

function makeProps() {
  return {
    firstName: 'Noor',
    academicMeta: 'Mathematics - Year 2',
  };
}

afterEach(() => {
  cleanup();
  languageState.current = 'en';
});

describe('HeaderWelcomeMessage', () => {
  it('renders the English welcome message', () => {
    render(
      <HeaderWelcomeMessage {...makeProps()} />
    );

    expect(
      screen.getByText('Welcome, Noor')
    ).toBeTruthy();
  });

  it('renders the Arabic welcome message', () => {
    languageState.current = 'ar';

    render(
      <HeaderWelcomeMessage {...makeProps()} />
    );

    expect(
      screen.getByText('مرحباً، Noor')
    ).toBeTruthy();
  });

  it('renders the academic metadata', () => {
    render(
      <HeaderWelcomeMessage {...makeProps()} />
    );

    expect(
      screen.getByText('Mathematics - Year 2')
    ).toBeTruthy();
  });

  it('preserves desktop-only visibility styling', () => {
    const { container } = render(
      <HeaderWelcomeMessage {...makeProps()} />
    );

    const wrapper = container.firstElementChild;

    expect(
      wrapper?.classList.contains('hidden')
    ).toBe(true);

    expect(
      wrapper?.classList.contains('lg:block')
    ).toBe(true);
  });

  it('preserves left-aligned text styling', () => {
    const { container } = render(
      <HeaderWelcomeMessage {...makeProps()} />
    );

    expect(
      container.firstElementChild
        ?.classList.contains('text-left')
    ).toBe(true);
  });

  it('updates the first name when props change', () => {
    const props = makeProps();

    const { rerender } = render(
      <HeaderWelcomeMessage {...props} />
    );

    rerender(
      <HeaderWelcomeMessage
        {...props}
        firstName="Omar"
      />
    );

    expect(
      screen.getByText('Welcome, Omar')
    ).toBeTruthy();

    expect(
      screen.queryByText('Welcome, Noor')
    ).toBeNull();
  });

  it('updates academic metadata when props change', () => {
    const props = makeProps();

    const { rerender } = render(
      <HeaderWelcomeMessage {...props} />
    );

    rerender(
      <HeaderWelcomeMessage
        {...props}
        academicMeta="Physics - Year 3"
      />
    );

    expect(
      screen.getByText('Physics - Year 3')
    ).toBeTruthy();
  });

  it('updates the greeting when the language changes', () => {
    const props = makeProps();

    const { rerender } = render(
      <HeaderWelcomeMessage {...props} />
    );

    expect(
      screen.getByText('Welcome, Noor')
    ).toBeTruthy();

    languageState.current = 'ar';

    rerender(
      <HeaderWelcomeMessage {...props} />
    );

    expect(
      screen.getByText('مرحباً، Noor')
    ).toBeTruthy();
  });

  it('handles empty academic metadata safely', () => {
    const { container } = render(
      <HeaderWelcomeMessage
        firstName="Noor"
        academicMeta=""
      />
    );

    expect(
      screen.getByText('Welcome, Noor')
    ).toBeTruthy();

    expect(
      container.querySelector('.truncate')
    ).toBeTruthy();
  });
});
