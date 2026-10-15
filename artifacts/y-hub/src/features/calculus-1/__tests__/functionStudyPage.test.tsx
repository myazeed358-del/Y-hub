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

describe('Calculus 1 function study UI', () => {
  it('displays candidate results from the real study service', async () => {
    render(<Calculus1Page />);

    fireEvent.click(
      screen.getByRole('tab', { name: 'Function study' })
    );

    expect(
      (screen.getByLabelText(
        'Mathematical expression'
      ) as HTMLInputElement).value
    ).toBe('x^3-3*x');

    fireEvent.click(
      screen.getByRole('button', { name: 'Calculate' })
    );

    expect(
      await screen.findByText(
        'General analysis remains preliminary; only explicitly marked results below are proven within their stated scope.'
      )
    ).toBeTruthy();

    expect(
      screen.getByText('Critical point candidates')
    ).toBeTruthy();

    expect(
      screen.getByText('First derivative')
    ).toBeTruthy();

    expect(
      screen.getByText('Second derivative')
    ).toBeTruthy();
  });

  it('displays the exact quadratic proof in its own section', async () => {
    render(<Calculus1Page />);

    fireEvent.click(
      screen.getByRole('tab', { name: 'Function study' })
    );

    fireEvent.change(
      screen.getByLabelText('Mathematical expression'),
      { target: { value: 'x^2-4*x+1' } }
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Calculate' })
    );

    const verified = await screen.findByRole('region', {
      name: 'Verified monotonicity proof'
    });

    expect(verified.textContent).toContain(
      'Proven results: monotonicity and extrema'
    );
    expect(verified.textContent).toContain(
      'global_minimum: x = 2, f(x) = -3'
    );
    expect(verified.textContent).toContain(
      'Proof steps'
    );
  });

  it('does not label a cubic analysis as proved', async () => {
    render(<Calculus1Page />);

    fireEvent.click(
      screen.getByRole('tab', { name: 'Function study' })
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Calculate' })
    );

    expect(await screen.findByText(
      'An exact monotonicity proof is not available for this function in the current version.'
    )).toBeTruthy();

    expect(screen.queryByRole('region', {
      name: 'Verified monotonicity proof'
    })).toBeNull();
  });

  it('preserves the study expression between tabs', () => {
    render(<Calculus1Page />);

    fireEvent.click(
      screen.getByRole('tab', { name: 'Function study' })
    );

    fireEvent.change(
      screen.getByLabelText('Mathematical expression'),
      { target: { value: 'x^2+1' } }
    );

    fireEvent.click(
      screen.getByRole('tab', { name: 'Limits' })
    );

    fireEvent.click(
      screen.getByRole('tab', { name: 'Function study' })
    );

    expect(
      (screen.getByLabelText(
        'Mathematical expression'
      ) as HTMLInputElement).value
    ).toBe('x^2+1');
  });
});
