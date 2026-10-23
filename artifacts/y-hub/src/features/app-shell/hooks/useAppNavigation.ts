import {
  useCallback,
  useMemo,
  useState,
} from 'react';

import {
  buildNavigationGroups,
} from '@/features/app-shell/components/navigation/buildNavigationGroups';

type NavigationRole =
  Parameters<typeof buildNavigationGroups>[0];

type NavigationMajor =
  Parameters<typeof buildNavigationGroups>[1];

export function useAppNavigation(
  role: NavigationRole,
  major: NavigationMajor,
  engineGrants?: readonly string[]
) {
  const [mobileNav, setMobileNav] = useState(false);

  const openMobileNav = useCallback(() => {
    setMobileNav(true);
  }, []);

  const closeMobileNav = useCallback(() => {
    setMobileNav(false);
  }, []);

  const dynamicNavItems = useMemo(
    () => buildNavigationGroups(role, major, engineGrants),
    [role, major, engineGrants]
  );

  return {
    mobileNav,
    openMobileNav,
    closeMobileNav,
    dynamicNavItems,
  };
}

export type AppNavigationController =
  ReturnType<typeof useAppNavigation>;
