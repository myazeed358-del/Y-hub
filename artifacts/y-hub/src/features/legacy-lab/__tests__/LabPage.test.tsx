import * as React from 'react';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { renderToStaticMarkup } from 'react-dom/server';

const state = vi.hoisted(() => ({
  language: 'ar' as 'ar' | 'en',
}));

vi.mock('@/i18n/LanguageContext', () => ({
  useLanguage: () => ({
    language: state.language,
  }),
}));

import LabPage from '../pages/LabPage';

beforeEach(() => {
  state.language = 'ar';
});

describe('LabPage', () => {
  it('renders Arabic content', () => {
    const html = renderToStaticMarkup(<LabPage />);

    expect(html).toContain('مختبر تفاعلي');
    expect(html).toContain('شكّل دالتك بيدك');
    expect(html).toContain('dir="rtl"');
  });

  it('renders membership choices', () => {
    const html = renderToStaticMarkup(<LabPage />);

    for (const type of [
      'triangle',
      'trapezoid',
      'gaussian',
    ]) {
      expect(html).toContain(
        `data-testid="button-function-${type}"`
      );
    }
  });

  it('renders reset and sliders', () => {
    const html = renderToStaticMarkup(<LabPage />);

    expect(html).toContain(
      'data-testid="button-reset-lab"'
    );
    expect(html).toContain('type="range"');
  });

  it('renders the original SVG chart', () => {
    const html = renderToStaticMarkup(<LabPage />);

    expect(html).toContain(
      'viewBox="0 0 410 220"'
    );
    expect(html).toContain('<circle');
  });

  it('renders English content', () => {
    state.language = 'en';

    const html = renderToStaticMarkup(<LabPage />);

    expect(html).toContain('Interactive lab');
    expect(html).toContain('Shape your function');
    expect(html).toContain('dir="ltr"');
  });
});
