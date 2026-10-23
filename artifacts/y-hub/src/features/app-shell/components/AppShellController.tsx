import * as React from 'react';
import type { ReactNode } from 'react';
import { useLocation } from 'wouter';

import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/i18n/LanguageContext';
import {
  buildAcademicIdentity,
  majorLabels,
} from '@/features/app-shell/domain/academicIdentity';
import { resolvePageTitle } from '@/features/app-shell/domain/resolvePageTitle';
import { useAppNavigation } from '@/features/app-shell/hooks/useAppNavigation';
import { useInstructorEngineSearch } from '@/features/app-shell/hooks/useInstructorEngineSearch';
import { useAppSignOut } from '@/features/app-shell/hooks/useAppSignOut';
import { useEngineInfoTooltip } from '@/features/app-shell/hooks/useEngineInfoTooltip';
import { AppShellView } from '@/features/app-shell/components/AppShellView';
import { useActiveCourseName } from '@/features/app-shell/hooks/useActiveCourseName';


export function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { language, t } = useLanguage();
  const {
    profile: authProfile,
    user,
    signOut,
    engineGrants,
  } = useAuth();
  const activeCourseName = useActiveCourseName(location, language);
  const {
    engineSearch,
    setEngineSearch,
    instructorSearchResults,
    quickPracticeSearchMatch,
  } = useInstructorEngineSearch(
    authProfile?.role,
    language
  );
  const {
    engineInfoTooltip,
    setEngineInfoTooltip,
  } = useEngineInfoTooltip();

  const {
    mobileNav,
    openMobileNav,
    closeMobileNav,
    dynamicNavItems,
  } = useAppNavigation(
    authProfile?.role,
    authProfile?.major,
    engineGrants
  );


  const currentTitle = resolvePageTitle(location, language, t);

  const {
    accountName,
    firstName,
    avatarInitial,
    roleLabel,
    academicMeta,
  } = buildAcademicIdentity({
    profile: authProfile,
    email: user?.email,
    language,
  });

  const handleSignOut = useAppSignOut(signOut);



  return (
    <AppShellView
      language={language}
      t={t}
      mobileNav={mobileNav}
      closeMobileNav={closeMobileNav}
      tooltip={engineInfoTooltip}
      sidebarProps={{
        mobileNav: mobileNav,
        onCloseMobileNav: closeMobileNav,
        activeCourseName: activeCourseName,
        isInstructor: authProfile?.role === 'instructor',
        location: location,
        accountName: accountName,
        academicMeta: academicMeta,
        avatarInitial: avatarInitial,
        engineSearch: engineSearch,
        onEngineSearchChange: setEngineSearch,
        instructorSearchResults: instructorSearchResults,
        quickPracticeSearchMatch: quickPracticeSearchMatch,
        dynamicNavItems: dynamicNavItems,
        majorLabels: majorLabels,
        onEngineInfoTooltipChange: setEngineInfoTooltip,
      }}
      headerProps={{
        currentTitle: currentTitle,
        firstName: firstName,
        academicMeta: academicMeta,
        accountName: accountName,
        avatarInitial: avatarInitial,
        roleLabel: roleLabel,
        userEmail: user?.email,
        onOpenMobileNav: openMobileNav,
        onSignOut: handleSignOut,
      }}
    >
      {children}
    </AppShellView>
  );
}
