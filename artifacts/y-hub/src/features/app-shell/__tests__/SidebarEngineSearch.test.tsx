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

import type { ComponentProps } from 'react';

import {
  ENGINE_CATALOG,
} from '@/config/majorEngineAccess';

import {
  SidebarEngineSearch as LegacySearch,
} from '@/components/layout/SidebarEngineSearch';

import {
  SidebarEngineSearch,
} from '../components/sidebar/SidebarEngineSearch';

const languageState = vi.hoisted(() => ({
  current: 'en' as 'ar' | 'en',
}));

vi.mock('@/i18n/LanguageContext', () => ({
  useLanguage: () => ({
    language: languageState.current,
  }),
}));

vi.mock('wouter', () => ({
  Link: ({
    href,
    children,
    className,
    onClick,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
    onClick?: React.MouseEventHandler<HTMLAnchorElement>;
  }) => (
    <a
      href={href}
      className={className}
      onClick={(event) => {
        event.preventDefault();
        onClick?.(event);
      }}
    >
      {children}
    </a>
  ),
}));

const firstEngine = ENGINE_CATALOG[0]!;

type Props = ComponentProps<typeof SidebarEngineSearch>;

function makeProps(
  overrides: Partial<Props> = {}
): Props {
  return {
    isInstructor: true,
    engineSearch: '',
    onEngineSearchChange: vi.fn(),
    instructorSearchResults: [],
    quickPracticeSearchMatch: false,
    majorLabels: {
      mathematics: {
        ar: 'الرياضيات',
        en: 'Mathematics',
      },
    },
    onCloseMobileNav: vi.fn(),
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  languageState.current = 'en';
});

describe('SidebarEngineSearch', () => {
  it('preserves the legacy export', () => {
    expect(LegacySearch).toBe(SidebarEngineSearch);
  });

  it('hides search for students', () => {
    render(
      <SidebarEngineSearch
        {...makeProps({
          isInstructor: false,
          engineSearch: 'calculus',
          instructorSearchResults: [firstEngine],
        })}
      />
    );

    expect(
      screen.queryByRole('searchbox')
    ).toBeNull();

    expect(
      screen.queryByRole('link')
    ).toBeNull();
  });

  it('renders an empty instructor search field', () => {
    render(
      <SidebarEngineSearch {...makeProps()} />
    );

    expect(
      screen.getByRole('searchbox')
    ).toBeTruthy();

    expect(
      screen.queryByRole('link')
    ).toBeNull();
  });

  it('shows the English placeholder', () => {
    languageState.current = 'en';

    render(
      <SidebarEngineSearch {...makeProps()} />
    );

    expect(
      screen.getByPlaceholderText(
        'Search academic tools...'
      )
    ).toBeTruthy();
  });

  it('shows the Arabic placeholder', () => {
    languageState.current = 'ar';

    render(
      <SidebarEngineSearch {...makeProps()} />
    );

    expect(
      screen.getByPlaceholderText(
        'ابحث في الأدوات الأكاديمية...'
      )
    ).toBeTruthy();
  });

  it('passes input changes to the controller', () => {
    const props = makeProps();

    render(
      <SidebarEngineSearch {...props} />
    );

    fireEvent.change(
      screen.getByRole('searchbox'),
      {
        target: {
          value: 'calculus',
        },
      }
    );

    expect(
      props.onEngineSearchChange
    ).toHaveBeenCalledWith('calculus');
  });

  it('does not display results for whitespace only', () => {
    render(
      <SidebarEngineSearch
        {...makeProps({
          engineSearch: '   ',
          instructorSearchResults: [firstEngine],
        })}
      />
    );

    expect(
      screen.queryByRole('link')
    ).toBeNull();
  });

  it('shows the English no-results message', () => {
    languageState.current = 'en';

    render(
      <SidebarEngineSearch
        {...makeProps({
          engineSearch: 'unknown-query',
        })}
      />
    );

    expect(
      screen.getByText(
        'No tools match your search.'
      )
    ).toBeTruthy();
  });

  it('shows the Arabic no-results message', () => {
    languageState.current = 'ar';

    render(
      <SidebarEngineSearch
        {...makeProps({
          engineSearch: 'unknown-query',
        })}
      />
    );

    expect(
      screen.getByText(
        'لا توجد أدوات مطابقة للبحث.'
      )
    ).toBeTruthy();
  });

  it('displays the quick practice destination', () => {
    render(
      <SidebarEngineSearch
        {...makeProps({
          engineSearch: 'quiz',
          quickPracticeSearchMatch: true,
        })}
      />
    );

    const link = screen.getByRole('link');

    expect(link.getAttribute('href'))
      .toBe('/quiz');

    expect(link.textContent)
      .toContain('Quick Practice');
  });

  it('clears the search and closes the menu on quiz click', () => {
    const props = makeProps({
      engineSearch: 'quiz',
      quickPracticeSearchMatch: true,
    });

    render(
      <SidebarEngineSearch {...props} />
    );

    fireEvent.click(
      screen.getByRole('link')
    );

    expect(
      props.onEngineSearchChange
    ).toHaveBeenCalledWith('');

    expect(
      props.onCloseMobileNav
    ).toHaveBeenCalledOnce();
  });

  it('displays engine results and their major labels', () => {
    render(
      <SidebarEngineSearch
        {...makeProps({
          engineSearch: 'calculus',
          instructorSearchResults: [firstEngine],
        })}
      />
    );

    expect(
      screen.getByText(firstEngine.title.en)
    ).toBeTruthy();

    expect(
      screen.getByText('Mathematics')
    ).toBeTruthy();

    expect(
      screen.getByRole('link').getAttribute('href')
    ).toBe(firstEngine.route);
  });

  it('clears the search when an engine is selected', () => {
    const props = makeProps({
      engineSearch: 'calculus',
      instructorSearchResults: [firstEngine],
    });

    render(
      <SidebarEngineSearch {...props} />
    );

    fireEvent.click(
      screen.getByRole('link')
    );

    expect(
      props.onEngineSearchChange
    ).toHaveBeenCalledWith('');

    expect(
      props.onCloseMobileNav
    ).toHaveBeenCalledOnce();
  });

  it('falls back to the engine major identifier', () => {
    render(
      <SidebarEngineSearch
        {...makeProps({
          engineSearch: 'calculus',
          instructorSearchResults: [firstEngine],
          majorLabels: {},
        })}
      />
    );

    expect(
      screen.getByText(
        firstEngine.majors[0]!
      )
    ).toBeTruthy();
  });

  it('updates its language-dependent results', () => {
    languageState.current = 'en';

    const props = makeProps({
      engineSearch: 'calculus',
      instructorSearchResults: [firstEngine],
    });

    const { rerender } = render(
      <SidebarEngineSearch {...props} />
    );

    expect(
      screen.getByText(firstEngine.title.en)
    ).toBeTruthy();

    languageState.current = 'ar';

    rerender(
      <SidebarEngineSearch {...props} />
    );

    expect(
      screen.getByText(firstEngine.title.ar)
    ).toBeTruthy();
  });
});
