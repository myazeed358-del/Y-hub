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

import { Calculator } from 'lucide-react';

import {
  ENGINE_CATALOG,
} from '@/config/majorEngineAccess';

import {
  SidebarNavigation as LegacyNavigation,
} from '@/components/layout/SidebarNavigation';

import {
  SidebarNavigation,
} from '../components/sidebar/SidebarNavigation';

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

vi.mock('@/features/app-shell/components/sidebar/SidebarLessonPath', () => ({
  SidebarLessonPath: ({
    location,
  }: {
    location: string;
  }) => (
    <div
      data-testid="lesson-path"
      data-location={location}
    />
  ),
}));

/**
 * Resolve the fixture inside a function.
 *
 * The returned value cannot be undefined,
 * including when used inside nested callbacks.
 */
const engine = (() => {
  const found = ENGINE_CATALOG.find((entry) =>
    [
      '/calculus',
      '/math-solver',
      '/solver',
      '/lab',
    ].includes(entry.route)
  );

  if (!found) {
    throw new Error(
      'Expected a catalog engine used by sidebar navigation'
    );
  }

  return found;
})();

type Props = ComponentProps<typeof SidebarNavigation>;

function makeProps(
  overrides: Partial<Props> = {}
): Props {
  return {
    isInstructor: false,
    location: '/',
    onCloseMobileNav: vi.fn(),
    dynamicNavItems: [
      {
        section: 'learningSpace',
        items: [
          {
            href: '/',
            key: 'overview',
            icon: Calculator,
          },
          {
            href: '/quiz',
            key: 'quickPractice',
            icon: Calculator,
          },
          {
            href: engine.route,
            key: 'solver',
            icon: Calculator,
          },
        ],
      },
    ],
    onEngineInfoTooltipChange: vi.fn(),
    ...overrides,
  };
}

function infoButton() {
  return screen.getByRole('button', {
    name: languageState.current === 'ar'
      ? `نبذة عن ${engine.title.ar}`
      : `About ${engine.title.en}`,
  });
}

/**
 * Only the geometry consumed by the component
 * is required for this test.
 */
function mockRect(button: HTMLElement) {
  vi.spyOn(
    button,
    'getBoundingClientRect'
  ).mockReturnValue({
    top: 80,
    left: 12,
    right: 42,
    height: 20,
  } as DOMRect);
}

afterEach(() => {
  cleanup();
  languageState.current = 'en';
  vi.restoreAllMocks();
});

describe('SidebarNavigation', () => {
  it('preserves the legacy component export', () => {
    expect(LegacyNavigation)
      .toBe(SidebarNavigation);
  });

  it('renders navigation groups and lesson path', () => {
    render(
      <SidebarNavigation {...makeProps()} />
    );

    expect(
      screen.getByText('learningSpace')
    ).toBeTruthy();

    expect(
      screen.getByTestId('link-nav-overview')
    ).toBeTruthy();

    expect(
      screen.getByTestId('lesson-path')
    ).toBeTruthy();
  });

  it('shows quick practice for students', () => {
    render(
      <SidebarNavigation {...makeProps()} />
    );

    expect(
      screen.getByTestId('link-nav-quickPractice')
    ).toBeTruthy();
  });

  it('hides quick practice for instructors', () => {
    render(
      <SidebarNavigation
        {...makeProps({
          isInstructor: true,
        })}
      />
    );

    expect(
      screen.queryByTestId('link-nav-quickPractice')
    ).toBeNull();
  });

  it('recognizes dashboard as overview route', () => {
    render(
      <SidebarNavigation
        {...makeProps({
          location: '/dashboard',
        })}
      />
    );

    expect(
      screen.getByTestId('link-nav-overview').className
    ).toContain('border-cyan-400/20');
  });

  it('highlights the exact active engine route', () => {
    render(
      <SidebarNavigation
        {...makeProps({
          location: engine.route,
        })}
      />
    );

    expect(
      screen.getByTestId('link-nav-solver').className
    ).toContain('border-cyan-400/20');
  });

  it('does not highlight unrelated routes', () => {
    render(
      <SidebarNavigation
        {...makeProps({
          location: '/unrelated-page',
        })}
      />
    );

    expect(
      screen.getByTestId('link-nav-overview').className
    ).toContain('border-transparent');
  });

  it('closes mobile menu when a link is selected', () => {
    const props = makeProps();

    render(
      <SidebarNavigation {...props} />
    );

    fireEvent.click(
      screen.getByTestId('link-nav-overview')
    );

    expect(
      props.onCloseMobileNav
    ).toHaveBeenCalledOnce();
  });

  it('passes the current route to lesson path', () => {
    render(
      <SidebarNavigation
        {...makeProps({
          location: '/courses/example',
        })}
      />
    );

    expect(
      screen.getByTestId('lesson-path')
        .getAttribute('data-location')
    ).toBe('/courses/example');
  });

  it('does not show engine info for unknown routes', () => {
    render(
      <SidebarNavigation
        {...makeProps({
          dynamicNavItems: [
            {
              section: 'learningSpace',
              items: [
                {
                  href: '/unmapped-route',
                  key: 'overview',
                  icon: Calculator,
                },
              ],
            },
          ],
        })}
      />
    );

    expect(
      screen.queryByRole('button')
    ).toBeNull();
  });

  it('opens English engine info on hover', () => {
    const props = makeProps();

    render(
      <SidebarNavigation {...props} />
    );

    const button = infoButton();
    mockRect(button);

    fireEvent.mouseEnter(button);

    expect(
      props.onEngineInfoTooltipChange
    ).toHaveBeenCalledWith({
      engineId: engine.id,
      top: 90,
      anchorX: 42,
    });
  });

  it('closes engine info on mouse leave', () => {
    const props = makeProps();

    render(
      <SidebarNavigation {...props} />
    );

    fireEvent.mouseLeave(infoButton());

    expect(
      props.onEngineInfoTooltipChange
    ).toHaveBeenCalledWith(null);
  });

  it('handles keyboard focus and blur', () => {
    const props = makeProps();

    render(
      <SidebarNavigation {...props} />
    );

    const button = infoButton();
    mockRect(button);

    fireEvent.focus(button);

    expect(
      props.onEngineInfoTooltipChange
    ).toHaveBeenCalledWith({
      engineId: engine.id,
      top: 90,
      anchorX: 42,
    });

    fireEvent.blur(button);

    expect(
      props.onEngineInfoTooltipChange
    ).toHaveBeenLastCalledWith(null);
  });

  it('uses left anchor for Arabic layout', () => {
    languageState.current = 'ar';

    const props = makeProps();

    render(
      <SidebarNavigation {...props} />
    );

    const button = infoButton();
    mockRect(button);

    fireEvent.mouseEnter(button);

    expect(
      props.onEngineInfoTooltipChange
    ).toHaveBeenCalledWith({
      engineId: engine.id,
      top: 90,
      anchorX: 12,
    });
  });
});
