import * as React from 'react';

import {
  afterEach,
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
} from '@testing-library/react';

import { courseLessons } from '@/content/course';
import { localizeLesson } from '@/content/localizeLesson';

import {
  SidebarLessonPath as LegacyLessonPath,
} from '@/components/layout/SidebarLessonPath';

import {
  SidebarLessonPath,
} from '../components/sidebar/SidebarLessonPath';

const languageState = vi.hoisted(() => ({
  current: 'en' as 'ar' | 'en',
}));

vi.mock('@/i18n/LanguageContext', () => ({
  useLanguage: () => ({
    language: languageState.current,
    t: (key: string) => key,
  }),
}));

vi.mock('wouter', () => ({
  Link: ({
    href,
    children,
    className,
    onClick,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
    onClick?: React.MouseEventHandler<HTMLAnchorElement>;
    'data-testid'?: string;
  }) => (
    <a
      href={href}
      className={className}
      onClick={(event) => {
        event.preventDefault();
        onClick?.(event);
      }}
      {...rest}
    >
      {children}
    </a>
  ),
}));

function makeProps(
  location = '/lesson/introduction'
) {
  return {
    location,
    onCloseMobileNav: vi.fn(),
  };
}

afterEach(() => {
  cleanup();
  languageState.current = 'en';
});

describe('SidebarLessonPath', () => {
  it('preserves the legacy component export', () => {
    expect(LegacyLessonPath)
      .toBe(SidebarLessonPath);
  });

  it('stays hidden on the dashboard', () => {
    render(
      <SidebarLessonPath
        {...makeProps('/dashboard')}
      />
    );

    expect(
      screen.queryByText('lessonPath')
    ).toBeNull();

    expect(
      screen.queryByRole('link')
    ).toBeNull();
  });

  it('stays hidden on unrelated routes', () => {
    render(
      <SidebarLessonPath
        {...makeProps('/profile')}
      />
    );

    expect(
      screen.queryByRole('link')
    ).toBeNull();
  });

  it('appears on lesson routes', () => {
    render(
      <SidebarLessonPath {...makeProps()} />
    );

    expect(
      screen.getByText('lessonPath')
    ).toBeTruthy();
  });

  it('appears on course routes', () => {
    render(
      <SidebarLessonPath
        {...makeProps('/course/example')}
      />
    );

    expect(
      screen.getByText('lessonPath')
    ).toBeTruthy();
  });

  it('shows at most the first five lessons', () => {
    render(
      <SidebarLessonPath {...makeProps()} />
    );

    expect(
      screen.getAllByRole('link').length
    ).toBe(Math.min(5, courseLessons.length));
  });

  it('uses English lesson titles', () => {
    languageState.current = 'en';

    render(
      <SidebarLessonPath {...makeProps()} />
    );

    const expected = localizeLesson(
      courseLessons[0]!,
      'en'
    ).title;

    expect(
      screen.getByText(expected)
    ).toBeTruthy();
  });

  it('uses Arabic lesson titles', () => {
    languageState.current = 'ar';

    render(
      <SidebarLessonPath {...makeProps()} />
    );

    const expected = localizeLesson(
      courseLessons[0]!,
      'ar'
    ).title;

    expect(
      screen.getByText(expected)
    ).toBeTruthy();
  });

  it('preserves lesson destinations and ordering', () => {
    render(
      <SidebarLessonPath {...makeProps()} />
    );

    const links = screen.getAllByRole('link');

    const expected = courseLessons
      .slice(0, 5)
      .map((lesson) => `/lesson/${lesson.slug}`);

    expect(
      links.map((link) => link.getAttribute('href'))
    ).toEqual(expected);
  });

  it('closes mobile navigation after lesson selection', () => {
    const props = makeProps();

    render(
      <SidebarLessonPath {...props} />
    );

    fireEvent.click(
      screen.getAllByRole('link')[0]!
    );

    expect(
      props.onCloseMobileNav
    ).toHaveBeenCalledOnce();
  });

  it('preserves the existing progress presentation', () => {
    const { container } = render(
      <SidebarLessonPath {...makeProps()} />
    );

    expect(
      screen.getByText('overallProgress')
    ).toBeTruthy();

    expect(
      screen.getByText('٣٧٪')
    ).toBeTruthy();

    expect(
      container.querySelector('[class*="w-[37%]"]')
    ).toBeTruthy();

    expect(
      screen.getByText('progressMessage')
    ).toBeTruthy();
  });

  it('updates visibility when route changes', () => {
    const props = makeProps('/dashboard');

    const { rerender } = render(
      <SidebarLessonPath {...props} />
    );

    expect(
      screen.queryByRole('link')
    ).toBeNull();

    rerender(
      <SidebarLessonPath
        {...props}
        location="/course/example"
      />
    );

    expect(
      screen.getAllByRole('link').length
    ).toBe(Math.min(5, courseLessons.length));
  });
});
