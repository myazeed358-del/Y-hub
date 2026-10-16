// @vitest-environment jsdom
import * as React from 'react';
import {
  afterEach, describe, expect, it, vi
} from 'vitest';
import {
  cleanup, fireEvent, render, screen
} from '@testing-library/react';
import Calculus1Page from '../pages/Calculus1Page';

vi.mock('@/i18n/LanguageContext', () => ({
  useLanguage: () => ({ language: 'en' })
}));

afterEach(cleanup);

function selectIntercepts() {
  fireEvent.click(
    screen.getByRole('tab', { name: 'Intercepts' })
  );
}

function calculate() {
  fireEvent.click(
    screen.getByRole('button', { name: 'Calculate' })
  );
}

function enterExpression(value: string) {
  fireEvent.change(
    screen.getByLabelText('Mathematical expression'),
    { target: { value } }
  );
}

describe('Calculus 1 intercepts UI', () => {
  it('shows exact irrational quadratic roots', () => {
    render(<Calculus1Page />);
    selectIntercepts();

    expect((
      screen.getByLabelText(
        'Mathematical expression'
      ) as HTMLInputElement
    ).value).toBe('x^2-2');

    calculate();

    expect(screen.getByRole('region', {
      name: 'Verified intercepts'
    })).toBeTruthy();

    expect(
      screen.getByTestId('y-intercept').textContent
    ).toContain('(0, -2)');

    const roots = screen.getByTestId(
      'x-intercepts'
    ).textContent ?? '';

    expect(roots).toContain('(-sqrt(2), 0)');
    expect(roots).toContain('(sqrt(2), 0)');
  });

  it('shows no real roots when discriminant is negative', () => {
    render(<Calculus1Page />);
    selectIntercepts();
    enterExpression('x^2+1');
    calculate();

    expect(screen.getByTestId(
      'no-x-intercepts'
    )).toBeTruthy();

    expect(
      screen.getByTestId('y-intercept').textContent
    ).toContain('(0, 1)');
  });

  it('recognizes an identically zero function', () => {
    render(<Calculus1Page />);
    selectIntercepts();
    enterExpression('0');
    calculate();

    expect(screen.getByTestId(
      'all-real-intercepts'
    )).toBeTruthy();
  });

  it('does not falsely verify unsupported input', () => {
    render(<Calculus1Page />);
    selectIntercepts();
    enterExpression('sqrt(x)');
    calculate();

    expect(screen.getByRole('region', {
      name: 'Unverified intercepts'
    })).toBeTruthy();

    expect(screen.queryByRole('region', {
      name: 'Verified intercepts'
    })).toBeNull();

    expect(screen.queryByTestId(
      'x-intercepts'
    )).toBeNull();
  });

  it('preserves the expression between tabs', () => {
    render(<Calculus1Page />);
    selectIntercepts();
    enterExpression('x^2-4');

    fireEvent.click(
      screen.getByRole('tab', { name: 'Range' })
    );

    selectIntercepts();

    expect((
      screen.getByLabelText(
        'Mathematical expression'
      ) as HTMLInputElement
    ).value).toBe('x^2-4');
  });

  it('clears previous results when switching tabs', () => {
    render(<Calculus1Page />);
    selectIntercepts();
    calculate();

    expect(screen.getByRole('region', {
      name: 'Verified intercepts'
    })).toBeTruthy();

    fireEvent.click(
      screen.getByRole('tab', { name: 'Domain' })
    );

    expect(screen.queryByRole('region', {
      name: 'Verified intercepts'
    })).toBeNull();
  });
});
