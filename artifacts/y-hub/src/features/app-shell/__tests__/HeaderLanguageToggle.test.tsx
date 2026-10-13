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
  HeaderLanguageToggle,
} from '../components/header/HeaderLanguageToggle';

const languageState = vi.hoisted(() => ({
  current: 'en' as 'ar' | 'en',
  setLanguage: vi.fn(),
}));

vi.mock('@/i18n/LanguageContext', () => ({
  useLanguage: () => ({
    language: languageState.current,
    setLanguage: languageState.setLanguage,
    t: (key: string) => `translation:${key}`,
  }),
}));

function button() {
  return screen.getByTestId('button-language-toggle');
}

afterEach(() => {
  cleanup();
  languageState.current = 'en';
  vi.clearAllMocks();
});

describe('HeaderLanguageToggle', () => {
  it('shows AR in English mode', () => {
    render(<HeaderLanguageToggle />);

    expect(button().textContent).toBe('AR');
  });

  it('switches from English to Arabic', () => {
    render(<HeaderLanguageToggle />);

    fireEvent.click(button());

    expect(languageState.setLanguage)
      .toHaveBeenCalledOnce();

    expect(languageState.setLanguage)
      .toHaveBeenCalledWith('ar');
  });

  it('shows EN in Arabic mode', () => {
    languageState.current = 'ar';

    render(<HeaderLanguageToggle />);

    expect(button().textContent).toBe('EN');
  });

  it('switches from Arabic to English', () => {
    languageState.current = 'ar';

    render(<HeaderLanguageToggle />);

    fireEvent.click(button());

    expect(languageState.setLanguage)
      .toHaveBeenCalledWith('en');
  });

  it('preserves the accessible language label', () => {
    render(<HeaderLanguageToggle />);

    expect(
      screen.getByRole('button', {
        name: 'translation:language',
      })
    ).toBeTruthy();
  });

  it('preserves the original button styling', () => {
    render(<HeaderLanguageToggle />);

    const element = button();

    expect(element.classList.contains('h-9'))
      .toBe(true);

    expect(element.classList.contains('rounded-xl'))
      .toBe(true);

    expect(element.classList.contains('font-black'))
      .toBe(true);
  });

  it('updates its visible label after language changes', () => {
    const { rerender } = render(
      <HeaderLanguageToggle />
    );

    expect(button().textContent).toBe('AR');

    languageState.current = 'ar';

    rerender(<HeaderLanguageToggle />);

    expect(button().textContent).toBe('EN');
  });

  it('does not switch language during rendering', () => {
    render(<HeaderLanguageToggle />);

    expect(languageState.setLanguage)
      .not.toHaveBeenCalled();
  });
});
