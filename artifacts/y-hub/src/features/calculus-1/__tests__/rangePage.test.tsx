// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup, fireEvent, render, screen
} from '@testing-library/react';
import Calculus1Page from '../pages/Calculus1Page';

vi.mock('@/i18n/LanguageContext', () => ({
  useLanguage: () => ({ language: 'en' })
}));

afterEach(cleanup);

function selectRange() {
  fireEvent.click(
    screen.getByRole('tab', { name: 'Range' })
  );
}

function calculate() {
  fireEvent.click(
    screen.getByRole('button', { name: 'Calculate' })
  );
}

describe('Calculus 1 exact range UI', () => {
  it('displays the verified quadratic range', () => {
    render(<Calculus1Page />);
    selectRange();

    expect((
      screen.getByLabelText(
        'Mathematical expression'
      ) as HTMLInputElement
    ).value).toBe('x^2-4*x+1');

    calculate();

    const region = screen.getByRole('region', {
      name: 'Verified real range'
    });

    expect(region.textContent).toContain(
      'Verified range within the supported scope'
    );

    expect(
      screen.getByTestId('exact-range-result').textContent
    ).toBe('[-3, +infinity)');
  });

  it('does not certify unsupported functions', () => {
    render(<Calculus1Page />);
    selectRange();

    fireEvent.change(
      screen.getByLabelText('Mathematical expression'),
      { target: { value: 'sin(x)' } }
    );

    calculate();

    expect(screen.getByRole('region', {
      name: 'Unverified real range'
    })).toBeTruthy();

    expect(screen.queryByTestId(
      'exact-range-result'
    )).toBeNull();
  });

  it('preserves the range expression across tabs', () => {
    render(<Calculus1Page />);
    selectRange();

    fireEvent.change(
      screen.getByLabelText('Mathematical expression'),
      { target: { value: '-x^2+4*x-1' } }
    );

    fireEvent.click(
      screen.getByRole('tab', { name: 'Domain' })
    );

    selectRange();

    expect((
      screen.getByLabelText(
        'Mathematical expression'
      ) as HTMLInputElement
    ).value).toBe('-x^2+4*x-1');
  });

  it('clears previous results when changing operations', () => {
    render(<Calculus1Page />);
    selectRange();
    calculate();

    expect(screen.getByRole('region', {
      name: 'Verified real range'
    })).toBeTruthy();

    fireEvent.click(
      screen.getByRole('tab', { name: 'Limits' })
    );

    expect(screen.queryByRole('region', {
      name: 'Verified real range'
    })).toBeNull();
  });
});
