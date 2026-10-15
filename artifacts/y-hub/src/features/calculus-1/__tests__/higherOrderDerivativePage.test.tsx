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
  useLanguage: () => ({ language: 'en' })
}));

afterEach(cleanup);

describe('Higher-order derivative UI', () => {
  it('computes a selected derivative order', () => {
    render(<Calculus1Page />);

    fireEvent.click(
      screen.getByRole('tab', {
        name: 'Higher-order derivatives'
      })
    );

    const order = screen.getByLabelText(
      'Derivative order'
    ) as HTMLInputElement;

    expect(order.value).toBe('2');

    fireEvent.change(order, {
      target: { value: '3' }
    });

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Calculate'
      })
    );

    expect(
      screen.getByText(
        /Method:\s*higher_order_derivative_engine/
      )
    ).toBeTruthy();

    expect(
      screen.getByText('3. Derivative order 3')
    ).toBeTruthy();
  });

  it('preserves the higher-order expression across tabs', () => {
    render(<Calculus1Page />);

    fireEvent.click(
      screen.getByRole('tab', {
        name: 'Higher-order derivatives'
      })
    );

    fireEvent.change(
      screen.getByLabelText('Mathematical expression'),
      { target: { value: 'x^5' } }
    );

    fireEvent.click(
      screen.getByRole('tab', { name: 'Limits' })
    );

    fireEvent.click(
      screen.getByRole('tab', {
        name: 'Higher-order derivatives'
      })
    );

    expect(
      (screen.getByLabelText(
        'Mathematical expression'
      ) as HTMLInputElement).value
    ).toBe('x^5');
  });
});
