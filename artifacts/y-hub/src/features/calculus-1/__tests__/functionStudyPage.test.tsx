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
      screen.getByText('Concave-up intervals')
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

  it('displays exact cubic extrema in the verified section', async () => {
    render(<Calculus1Page />);

    fireEvent.click(
      screen.getByRole('tab', { name: 'Function study' })
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Calculate' })
    );

    const verified = await screen.findByRole('region', {
      name: 'Verified monotonicity proof'
    });

    expect(verified.textContent).toContain(
      'local_maximum: x = -1, f(x) = 2'
    );

    expect(verified.textContent).toContain(
      'local_minimum: x = 1, f(x) = -2'
    );

    expect(verified.textContent).toContain(
      'degree-3 polynomial'
    );

    expect(verified.textContent).toContain(
      'Inflection points'
    );

    expect(verified.textContent).toContain(
      'x = 0, f(x) = 0'
    );

    expect(screen.queryByText(
      'Critical point candidates'
    )).toBeNull();

    expect(verified.textContent).toContain(
      'Concave-up intervals'
    );

    expect(verified.textContent).toContain(
      '(0, +infinity)'
    );
  });

  it('shows an exact proof for irrational cubic roots', async () => {
    render(<Calculus1Page />);

    fireEvent.click(
      screen.getByRole('tab', { name: 'Function study' })
    );

    fireEvent.change(
      screen.getByLabelText('Mathematical expression'),
      { target: { value: 'x^3-x' } }
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Calculate' })
    );

    const verified = await screen.findByRole('region', {
      name: 'Verified monotonicity proof'
    });

    expect(verified.textContent).toContain('sqrt(12)');
    expect(verified.textContent).toContain('local_maximum');
    expect(verified.textContent).toContain('local_minimum');
  });

  it('renders certified quartic extrema separately from candidates', async () => {
    render(<Calculus1Page />);

    fireEvent.click(
      screen.getByRole('tab', { name: 'Function study' })
    );

    fireEvent.change(
      screen.getByLabelText('Mathematical expression'),
      { target: { value: 'x^4-2*x^2' } }
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Calculate' })
    );

    const verified = await screen.findByRole('region', {
      name: 'Verified monotonicity proof'
    });

    expect(verified.textContent).toContain(
      'degree-4 polynomial'
    );

    expect(verified.textContent).toContain(
      'local_minimum: x = -1, f(x) = -1'
    );

    expect(verified.textContent).toContain(
      'local_maximum: x = 0, f(x) = 0'
    );

    expect(verified.textContent).not.toContain(
      'Concave-up intervals'
    );

    const concavity = screen.getByRole('region', {
      name: 'Verified concavity proof'
    });

    expect(concavity.textContent).toContain(
      'Proven results: concavity and inflection'
    );

    expect(concavity.textContent).toContain(
      'Concave-up intervals'
    );

    expect(concavity.textContent).toContain(
      'Inflection points'
    );

    expect(screen.queryByText(
      'Concave-up candidates'
    )).toBeNull();
  });

  it('does not certify an unsupported quartic', async () => {
    render(<Calculus1Page />);

    fireEvent.click(
      screen.getByRole('tab', { name: 'Function study' })
    );

    fireEvent.change(
      screen.getByLabelText('Mathematical expression'),
      { target: { value: 'x^4-x^2+x' } }
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
  it('shows certified quartic concavity without monotonicity proof', async () => {
    render(<Calculus1Page />);

    fireEvent.click(
      screen.getByRole('tab', { name: 'Function study' })
    );

    fireEvent.change(
      screen.getByLabelText('Mathematical expression'),
      { target: { value: 'x^4-x^2+x' } }
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Calculate' })
    );

    const concavity = await screen.findByRole('region', {
      name: 'Verified concavity proof'
    });

    expect(concavity.textContent).toContain(
      'Proven results: concavity and inflection'
    );

    expect(concavity.textContent).toContain(
      'x = -(1/24)*sqrt(96)'
    );

    expect(screen.queryByRole('region', {
      name: 'Verified monotonicity proof'
    })).toBeNull();

    expect(screen.getByText(
      'Critical point candidates'
    )).toBeTruthy();

    expect(screen.queryByText(
      'Concave-up candidates'
    )).toBeNull();
  });
  it('shows independent quartic monotonicity and concavity proofs', async () => {
    render(<Calculus1Page />);

    fireEvent.click(
      screen.getByRole('tab', { name: 'Function study' })
    );

    fireEvent.change(
      screen.getByLabelText('Mathematical expression'),
      { target: { value: 'x^4-2*x^2' } }
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Calculate' })
    );

    const monotonicity = await screen.findByRole('region', {
      name: 'Verified monotonicity proof'
    });

    const concavity = screen.getByRole('region', {
      name: 'Verified concavity proof'
    });

    expect(monotonicity.textContent).toContain(
      'local_minimum: x = -1, f(x) = -1'
    );

    expect(concavity.textContent).toContain(
      'Concavity proof steps'
    );

    expect(screen.queryByText(
      'Concave-up candidates'
    )).toBeNull();
  });

  it('shows both verified proofs for even quartic irrational roots', async () => {
    render(<Calculus1Page />);

    fireEvent.click(
      screen.getByRole('tab', { name: 'Function study' })
    );

    fireEvent.change(
      screen.getByLabelText('Mathematical expression'),
      { target: { value: 'x^4-x^2' } }
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Calculate' })
    );

    const monotonicity = await screen.findByRole('region', {
      name: 'Verified monotonicity proof'
    });

    const concavity = screen.getByRole('region', {
      name: 'Verified concavity proof'
    });

    expect(monotonicity.textContent).toContain(
      'local_minimum: x = -sqrt(1/2), f(x) = -1/4'
    );

    expect(monotonicity.textContent).toContain(
      'local_maximum: x = 0, f(x) = 0'
    );

    expect(concavity.textContent).toContain(
      'x = -(1/24)*sqrt(96), f(x) = -5/36'
    );

    expect(screen.queryByText(
      'Critical point candidates'
    )).toBeNull();

    expect(screen.queryByText(
      'Concave-up candidates'
    )).toBeNull();
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
