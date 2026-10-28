import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';


const state = vi.hoisted(() => ({
  language: 'ar' as 'ar' | 'en',
}));

vi.mock('@/i18n/LanguageContext', () => ({
  useLanguage: () => ({
    language: state.language,
    t: (key: string) => key,
  }),
}));

vi.mock('wouter', () => ({
  Link: ({
    children,
    href,
    ...props
  }: React.PropsWithChildren<
    React.AnchorHTMLAttributes<HTMLAnchorElement> & {
      href: string;
    }
  >) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

import HomePage from '../pages/HomePage';

beforeEach(() => {
  state.language = 'ar';
});

describe('HomePage', () => {
  it('renders a bilingual academic hero without a fictitious student or session', () => {
    const html = renderToStaticMarkup(<HomePage />);
    expect(html).toContain('تابع دروس شعبتك');
    expect(html).toContain('href="#learning-path"');
    expect(html).not.toContain('سارة');
    expect(html).not.toContain('37%');
  });

  it('renders the supplied real learning path instead of static fuzzy lessons', () => {
    const html = renderToStaticMarkup(<HomePage learningPath={<section id="learning-path">Actual section syllabus</section>} />);
    expect(html).toContain('Actual section syllabus');
    expect(html).not.toContain('card-lesson-');
    expect(html).not.toContain('/lesson/membership-grade');
    expect(html).not.toContain('٣٧٪');
  });

  it('preserves the lab and quiz tools', () => {
    const html = renderToStaticMarkup(<HomePage />);

    expect(html).toContain('data-testid="card-tool-lab"');
    expect(html).toContain('data-testid="card-tool-quiz"');
    expect(html).toContain('href="/quiz"');
  });

  it('preserves English-language content', () => {
    state.language = 'en';

    const html = renderToStaticMarkup(<HomePage />);

    expect(html).toContain(
      'Choose your section and explore the syllabus'
    );
  });
});
