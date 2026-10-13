import * as React from 'react';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { courseLessons } from '@/content/course';

const state = vi.hoisted(() => ({
  slug: 'introduction',
  language: 'ar' as 'ar' | 'en',
}));

vi.mock('wouter', () => ({
  useParams: () => ({ slug: state.slug }),
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

vi.mock('@/i18n/LanguageContext', () => ({
  useLanguage: () => ({
    language: state.language,
    t: (key: string) => key,
  }),
}));

import LessonPage from '../pages/LessonPage';

beforeEach(() => {
  state.slug = courseLessons[0].slug;
  state.language = 'ar';
});

describe('LessonPage', () => {
  it('renders the selected lesson', () => {
    const html = renderToStaticMarkup(<LessonPage />);

    expect(html).toContain(courseLessons[0].title);
    expect(html).toContain(
      'data-testid="link-back-dashboard"'
    );
  });

  it('keeps the next lesson link', () => {
    const html = renderToStaticMarkup(<LessonPage />);

    expect(html).toContain(
      'data-testid="link-next-lesson"'
    );
  });

  it('renders the complete sidebar', () => {
    const html = renderToStaticMarkup(<LessonPage />);

    const links = html.match(
      /data-testid="link-lesson-index-/g
    ) ?? [];

    expect(links).toHaveLength(courseLessons.length);
  });

  it('keeps previous lesson navigation', () => {
    state.slug = courseLessons[1].slug;

    const html = renderToStaticMarkup(<LessonPage />);

    expect(html).toContain(
      'data-testid="link-previous-lesson"'
    );
  });

  it('links to Quiz after the last lesson', () => {
    state.slug = courseLessons.at(-1)!.slug;

    const html = renderToStaticMarkup(<LessonPage />);

    expect(html).toContain(
      'data-testid="link-finish-to-quiz"'
    );
    expect(html).toContain('href="/quiz"');
  });

  it('keeps the NotFound fallback', () => {
    state.slug = 'nonexistent-lesson';

    const html = renderToStaticMarkup(<LessonPage />);

    expect(html).toContain('404');
  });

  it('supports the English interface', () => {
    state.language = 'en';

    const html = renderToStaticMarkup(<LessonPage />);

    expect(html).toContain('In this path');
  });
});
