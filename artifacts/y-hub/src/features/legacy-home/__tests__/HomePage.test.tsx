import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { courseLessons } from '@/content/course';

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
  it('renders the original hero and navigation', () => {
    const html = renderToStaticMarkup(<HomePage />);

    expect(html).toContain('اجعل الغموض');
    expect(html).toContain(
      'data-testid="link-continue-learning"'
    );
    expect(html).toContain(
      'data-testid="link-open-lab"'
    );
  });

  it('renders exactly four featured lessons', () => {
    const html = renderToStaticMarkup(<HomePage />);

    const cards = html.match(
      /data-testid="card-lesson-/g
    ) ?? [];

    expect(cards).toHaveLength(4);

    expect(html).toContain(
      `href="/lesson/${courseLessons[0].slug}"`
    );
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
      'Today we will turn membership grade'
    );
  });
});
