import * as React from 'react';
import type { PageBreadcrumb } from '../../domain/breadcrumbs';

import { ThemeToggle } from '@/components/ThemeToggle';
import { HeaderLanguageToggle } from '@/features/app-shell/components/header/HeaderLanguageToggle';
import { HeaderAccountMenu } from '@/features/app-shell/components/header/HeaderAccountMenu';
import { HeaderPageContext } from '@/features/app-shell/components/header/HeaderPageContext';
import { HeaderWelcomeMessage } from '@/features/app-shell/components/header/HeaderWelcomeMessage';

interface AppHeaderProps {
  currentTitle: string;
  breadcrumbs?: readonly PageBreadcrumb[];
  firstName: string;
  academicMeta: string;
  accountName: string;
  avatarInitial: string;
  roleLabel: string;
  userEmail?: string;
  onOpenMobileNav: () => void;
  onSignOut: () => void | Promise<void>;
}

export function AppHeader({
  currentTitle,
  breadcrumbs,
  firstName,
  academicMeta,
  accountName,
  avatarInitial,
  roleLabel,
  userEmail,
  onOpenMobileNav,
  onSignOut,
}: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-2xl sm:px-6 lg:px-10">
      <HeaderPageContext
        currentTitle={currentTitle}
        breadcrumbs={breadcrumbs}
        onOpenMobileNav={onOpenMobileNav}
      />

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <HeaderWelcomeMessage
          firstName={firstName}
          academicMeta={academicMeta}
        />

        <HeaderLanguageToggle />

        <ThemeToggle />

        <HeaderAccountMenu
          accountName={accountName}
          academicMeta={academicMeta}
          avatarInitial={avatarInitial}
          roleLabel={roleLabel}
          userEmail={userEmail}
          onSignOut={onSignOut}
        />
      </div>
    </header>
  );
}
