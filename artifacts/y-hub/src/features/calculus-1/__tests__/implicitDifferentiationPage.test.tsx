// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen
} from '@testing-library/react';
import Calculus1Page from '../pages/Calculus1Page';

vi.mock('@/i18n/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'en'
  })
}));

afterEach(cleanup);

describe('Calculus 1 implicit differentiation UI', () => {
  it('solves an implicit equation from the tab', () => {
    render(<Calculus1Page />);

    fireEvent.click(
      screen.getByRole('tab', {
        name: 'Implicit differentiation'
      })
    );

    const input = screen.getByLabelText(
      'Mathematical equation'
    ) as HTMLInputElement;

    expect(input.value).toBe('x^2+y^2=25');

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Calculate'
      })
    );

    expect(
      screen.getByText(/Method:\s*implicit_partial_derivatives/)
    ).toBeTruthy();

    expect(
      screen.getByText(/Apply the implicit chain rule/)
    ).toBeTruthy();
  });

  it('preserves separate inputs when switching tabs', () => {
    render(<Calculus1Page />);

    const limits = screen.getByLabelText(
      'Mathematical expression'
    );

    fireEvent.change(limits, {
      target: { value: 'x^2/x' }
    });

    fireEvent.click(
      screen.getByRole('tab', {
        name: 'Implicit differentiation'
      })
    );

    fireEvent.change(
      screen.getByLabelText('Mathematical equation'),
      {
        target: { value: 'x*y=1' }
      }
    );

    fireEvent.click(
      screen.getByRole('tab', {
        name: 'Limits'
      })
    );

    expect(
      (screen.getByLabelText(
        'Mathematical expression'
      ) as HTMLInputElement).value
    ).toBe('x^2/x');

    fireEvent.click(
      screen.getByRole('tab', {
        name: 'Implicit differentiation'
      })
    );

    expect(
      (screen.getByLabelText(
        'Mathematical equation'
      ) as HTMLInputElement).value
    ).toBe('x*y=1');
  });
});
