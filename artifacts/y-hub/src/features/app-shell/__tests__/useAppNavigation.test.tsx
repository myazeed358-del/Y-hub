import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest';

import {
  act,
  cleanup,
  renderHook,
} from '@testing-library/react';

import {
  buildNavigationGroups,
} from '@/components/layout/navigation';

import {
  useAppNavigation,
} from '../hooks/useAppNavigation';

afterEach(() => {
  cleanup();
});

function navigationPaths(
  groups: ReturnType<typeof buildNavigationGroups>
) {
  return groups.flatMap(
    (group) => group.items.map((item) => item.href)
  );
}

describe('useAppNavigation', () => {
  it('starts with mobile navigation closed', () => {
    const { result } = renderHook(() =>
      useAppNavigation('student', 'mathematics')
    );

    expect(result.current.mobileNav).toBe(false);
  });

  it('opens mobile navigation', () => {
    const { result } = renderHook(() =>
      useAppNavigation('student', 'mathematics')
    );

    act(() => {
      result.current.openMobileNav();
    });

    expect(result.current.mobileNav).toBe(true);
  });

  it('closes mobile navigation', () => {
    const { result } = renderHook(() =>
      useAppNavigation('student', 'mathematics')
    );

    act(() => {
      result.current.openMobileNav();
    });

    act(() => {
      result.current.closeMobileNav();
    });

    expect(result.current.mobileNav).toBe(false);
  });

  it('allows closing an already closed menu', () => {
    const { result } = renderHook(() =>
      useAppNavigation('student', null)
    );

    act(() => {
      result.current.closeMobileNav();
    });

    expect(result.current.mobileNav).toBe(false);
  });

  it('preserves student navigation', () => {
    const { result } = renderHook(() =>
      useAppNavigation('student', 'mathematics')
    );

    expect(result.current.dynamicNavItems).toEqual(
      buildNavigationGroups('student', 'mathematics')
    );

    expect(
      navigationPaths(result.current.dynamicNavItems)
    ).toContain('/quiz');
  });

  it('preserves instructor navigation', () => {
    const { result } = renderHook(() =>
      useAppNavigation('instructor', 'mathematics')
    );

    expect(result.current.dynamicNavItems).toEqual(
      buildNavigationGroups('instructor', 'mathematics')
    );

    expect(
      navigationPaths(result.current.dynamicNavItems)
    ).not.toContain('/quiz');
  });

  it('preserves administrator navigation', () => {
    const { result } = renderHook(() =>
      useAppNavigation('admin', null)
    );

    expect(
      navigationPaths(result.current.dynamicNavItems)
    ).toContain('/quiz');
  });

  it('preserves super-administrator navigation', () => {
    const { result } = renderHook(() =>
      useAppNavigation('super_admin', null)
    );

    expect(
      navigationPaths(result.current.dynamicNavItems)
    ).toContain('/quiz');
  });

  it('updates navigation when the major changes', () => {
    const { result, rerender } = renderHook(
      ({ major }: { major: string | null }) =>
        useAppNavigation('student', major),
      {
        initialProps: {
          major: 'mathematics' as string | null,
        },
      }
    );

    rerender({ major: 'law' });

    expect(result.current.dynamicNavItems).toEqual(
      buildNavigationGroups('student', 'law')
    );
  });

  it('updates navigation when the role changes', () => {
    const { result, rerender } = renderHook(
      ({ role }: {
        role: 'student' | 'instructor';
      }) => useAppNavigation(role, 'mathematics'),
      {
        initialProps: {
          role: 'student' as 'student' | 'instructor',
        },
      }
    );

    expect(
      navigationPaths(result.current.dynamicNavItems)
    ).toContain('/quiz');

    rerender({ role: 'instructor' });

    expect(
      navigationPaths(result.current.dynamicNavItems)
    ).not.toContain('/quiz');
  });

  it('keeps the menu state when roles change', () => {
    const { result, rerender } = renderHook(
      ({ role }: {
        role: 'student' | 'instructor';
      }) => useAppNavigation(role, 'mathematics'),
      {
        initialProps: {
          role: 'student' as 'student' | 'instructor',
        },
      }
    );

    act(() => {
      result.current.openMobileNav();
    });

    rerender({ role: 'instructor' });

    expect(result.current.mobileNav).toBe(true);
  });

  it('memoizes groups for unchanged navigation inputs', () => {
    const { result, rerender } = renderHook(
      ({ major }: { major: string }) =>
        useAppNavigation('student', major),
      {
        initialProps: {
          major: 'mathematics',
        },
      }
    );

    const originalGroups = result.current.dynamicNavItems;

    rerender({ major: 'mathematics' });

    expect(result.current.dynamicNavItems)
      .toBe(originalGroups);
  });
});
