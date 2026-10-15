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

describe('Tangent and normal UI', () => {
  it('solves tangent and normal lines', () => {
    render(<Calculus1Page />);

    fireEvent.click(screen.getByRole('tab', {
      name: 'Tangent & normal'
    }));

    expect(
      (screen.getByLabelText(
        'Point x ='
      ) as HTMLInputElement).value
    ).toBe('3');

    fireEvent.click(screen.getByRole('button', {
      name: 'Calculate'
    }));

    expect(screen.getByText(
      /Method:\s*exact_polynomial_tangent_normal/
    )).toBeTruthy();

    expect(screen.getByText(
      /3\. Tangent line/
    )).toBeTruthy();
  });
});
