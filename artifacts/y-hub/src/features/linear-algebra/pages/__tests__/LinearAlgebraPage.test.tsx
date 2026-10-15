import * as React from 'react';
import {
  afterEach,
  beforeEach,
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
  waitFor,
} from '@testing-library/react';

import LinearAlgebraPage from '../LinearAlgebraPage';
import { LinearAlgebraAdapter } from '@/services/math/python/LinearAlgebraAdapter';

vi.mock('@/i18n/LanguageContext', () => ({
  useLanguage: () => ({ language: 'ar' }),
}));

describe('Linear Algebra Page Integration', () => {
  beforeEach(() => {
    vi.spyOn(
      LinearAlgebraAdapter.prototype,
      'executePython'
    ).mockResolvedValue(null);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders the workspace and matrix editor', () => {
    render(<LinearAlgebraPage />);

    expect(
      screen.getByText('محرك الجبر الخطي')
    ).toBeDefined();

    expect(
      screen.getAllByRole('textbox')
    ).toHaveLength(4);

    expect(
      screen.getByRole('combobox')
    ).toBeDefined();
  });

  it('calculates determinant using the real engine', async () => {
    render(<LinearAlgebraPage />);

    fireEvent.click(
      screen.getByRole('button', {
        name: 'احسب النتيجة',
      })
    );

    await waitFor(() => {
      expect(screen.getByText('-2')).toBeDefined();
    });
  });

  it('calculates inverse and displays fractions', async () => {
    render(<LinearAlgebraPage />);

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'inverse' },
    });

    const values = [
      ['4', '7'],
      ['2', '6'],
    ];

    values.forEach((row, i) => {
      row.forEach((value, j) => {
        fireEvent.change(
          screen.getByRole('textbox', {
            name: `صف ${i + 1}, عمود ${j + 1}`,
          }),
          { target: { value } }
        );
      });
    });

    fireEvent.click(
      screen.getByRole('button', {
        name: 'احسب النتيجة',
      })
    );

    await waitFor(() => {
      expect(screen.getByText('3/5')).toBeDefined();
      expect(screen.getByText('-7/10')).toBeDefined();
    });
  });

  it('handles invalid matrix input safely', async () => {
    render(<LinearAlgebraPage />);

    fireEvent.change(
      screen.getByRole('textbox', {
        name: 'صف 1, عمود 1',
      }),
      { target: { value: 'abc' } }
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: 'احسب النتيجة',
      })
    );

    await waitFor(() => {
      expect(
        screen.getByRole('alert').textContent
      ).toContain('Invalid matrix entry');
    });
  });
});
