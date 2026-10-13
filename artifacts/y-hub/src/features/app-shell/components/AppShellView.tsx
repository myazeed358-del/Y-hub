import * as React from 'react';

import type {
  ComponentProps,
  ReactNode,
} from 'react';

import type {
  Language,
  UiKey,
} from '@/i18n/uiCopy';

import { AppHeader } from '@/features/app-shell/components/header/AppHeader';
import { AppSidebar } from '@/features/app-shell/components/sidebar/AppSidebar';

import {
  EngineInfoTooltip,
  type EngineInfoTooltipState,
} from './EngineInfoTooltip';

export interface AppShellViewProps {
  children: ReactNode;
  language: Language;
  t: (key: UiKey) => string;
  mobileNav: boolean;
  closeMobileNav: () => void;
  tooltip: EngineInfoTooltipState | null;
  sidebarProps: ComponentProps<typeof AppSidebar>;
  headerProps: ComponentProps<typeof AppHeader>;
}

export function AppShellView({
  children,
  language,
  t,
  mobileNav,
  closeMobileNav,
  tooltip,
  sidebarProps,
  headerProps,
}: AppShellViewProps) {
  return (
    <div
      dir={language === 'ar' ? 'rtl' : 'ltr'}
      className="min-h-[100dvh] bg-background text-foreground"
      style={{
        backgroundImage:
          'radial-gradient(circle at 85% 0%, rgba(34,211,238,0.07), transparent 30%), radial-gradient(circle at 15% 100%, rgba(139,92,246,0.07), transparent 32%)',
      }}
    >
      <EngineInfoTooltip
        tooltip={tooltip}
        language={language}
      />

      <AppSidebar {...sidebarProps} />

      {mobileNav && (
        <button
          aria-label={t('closeMenu')}
          data-testid="button-mobile-nav-backdrop"
          onClick={closeMobileNav}
          className="fixed inset-0 z-30 bg-black/70 backdrop-blur-sm md:hidden"
        />
      )}

      <div
        className={`relative min-h-[100dvh] ${
          language === 'ar'
            ? 'md:mr-[288px]'
            : 'md:ml-[288px]'
        }`}
      >
        <AppHeader {...headerProps} />

        <main className="mx-auto max-w-[1480px] px-4 py-6 sm:px-6 md:py-8 lg:px-10 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
