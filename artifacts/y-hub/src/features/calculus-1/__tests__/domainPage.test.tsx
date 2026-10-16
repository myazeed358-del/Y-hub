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

function selectDomain() {
  fireEvent.click(
    screen.getByRole('tab', { name: 'Domain' })
  );
}

function calculate() {
  fireEvent.click(
    screen.getByRole('button', { name: 'Calculate' })
  );
}

describe('Calculus 1 exact domain UI', () => {
  it('shows the verified irrational domain', () => {
    render(<Calculus1Page />);
    selectDomain();
    calculate();

    const region = screen.getByRole('region', {
      name: 'Verified real domain'
    });

    expect(region).toBeTruthy();

    const result = screen.getByTestId(
      'exact-domain-result'
    );

    expect(result.textContent).toContain('sqrt(2)');
    expect(result.textContent).toContain('∪');
    expect(region.textContent).toContain(
      'Verified within the supported scope'
    );
  });

  it('does not mislabel unsupported input', () => {
    render(<Calculus1Page />);
    selectDomain();

    fireEvent.change(
      screen.getByLabelText('Mathematical expression'),
      { target: { value: 'x^x' } }
    );

    calculate();

    expect(screen.getByRole('region', {
      name: 'Unverified real domain'
    })).toBeTruthy();

    expect(screen.queryByRole('region', {
      name: 'Verified real domain'
    })).toBeNull();

    expect(screen.queryByTestId(
      'exact-domain-result'
    )).toBeNull();
  });

  it('keeps the domain expression between tabs', () => {
    render(<Calculus1Page />);
    selectDomain();

    fireEvent.change(
      screen.getByLabelText('Mathematical expression'),
      { target: { value: '1/(x^2-4)' } }
    );

    fireEvent.click(
      screen.getByRole('tab', { name: 'Limits' })
    );

    selectDomain();

    expect((
      screen.getByLabelText(
        'Mathematical expression'
      ) as HTMLInputElement
    ).value).toBe('1/(x^2-4)');
  });

  it('clears verified results when switching tabs', () => {
    render(<Calculus1Page />);
    selectDomain();
    calculate();

    expect(screen.getByRole('region', {
      name: 'Verified real domain'
    })).toBeTruthy();

    fireEvent.click(
      screen.getByRole('tab', { name: 'Derivatives' })
    );

    expect(screen.queryByRole('region', {
      name: 'Verified real domain'
    })).toBeNull();
  });
});
