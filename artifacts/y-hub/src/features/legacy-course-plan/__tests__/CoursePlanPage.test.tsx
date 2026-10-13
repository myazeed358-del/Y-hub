import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { courseLessons } from '@/content/course';

vi.mock('@/i18n/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'ar',
    t: (key: string) => key,
  }),
}));

vi.mock('wouter', () => ({
  Link: ({
    href,
    children,
    ...props
  }: React.PropsWithChildren<
    React.AnchorHTMLAttributes<HTMLAnchorElement> & {
      href: string;
    }
  >) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

import CoursePlanPage from '../pages/CoursePlanPage';

describe('CoursePlanPage', () => {
  it('renders the course plan heading', () => {
    const html = renderToStaticMarkup(<CoursePlanPage />);

    expect(html).toContain('من الأساس إلى أنظمة الاستدلال');
    expect(html).toContain('dir="rtl"');
  });

  it('renders all original lessons', () => {
    const html = renderToStaticMarkup(<CoursePlanPage />);

    const links = html.match(/data-testid="course-week-/g) ?? [];

    expect(links).toHaveLength(courseLessons.length);
  });

  it('preserves the first lesson link', () => {
    const html = renderToStaticMarkup(<CoursePlanPage />);

    expect(html).toContain(
      `href="/lesson/${courseLessons[0].slug}"`
    );
    expect(html).toContain('data-testid="course-week-1"');
  });

  it('shows completed lessons correctly', () => {
    const html = renderToStaticMarkup(<CoursePlanPage />);
    const completed = courseLessons.filter(
      (lesson) => lesson.progress === 100
    ).length;

    expect(html).toContain(
      `${completed} / ${courseLessons.length}`
    );
  });
});
