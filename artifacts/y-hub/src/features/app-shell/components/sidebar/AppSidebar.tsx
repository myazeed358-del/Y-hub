import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  X,
} from 'lucide-react';

import YHubLogo from '@/components/YHubLogo';
import { SidebarNavigation } from '@/features/app-shell/components/sidebar/SidebarNavigation';
import { SidebarEngineSearch } from '@/features/app-shell/components/sidebar/SidebarEngineSearch';
import { SidebarAccountCard } from '@/features/app-shell/components/sidebar/SidebarAccountCard';
import { searchEngines } from '@/config/majorEngineAccess';
import { useLanguage } from '@/i18n/LanguageContext';
import type { UiKey } from '@/i18n/uiCopy';


interface AppSidebarProps {
  mobileNav: boolean;
  onCloseMobileNav: () => void;
  activeCourseName: string | null;
  isInstructor: boolean;
  location: string;
  accountName: string;
  academicMeta: string;
  avatarInitial: string;
  engineSearch: string;
  onEngineSearchChange: (value: string) => void;
  instructorSearchResults: ReturnType<typeof searchEngines>;
  quickPracticeSearchMatch: boolean;
  dynamicNavItems: {
    section: UiKey;
    items: {
      href: string;
      key: UiKey;
      icon: LucideIcon;
    }[];
  }[];
  majorLabels: Record<string, { ar: string; en: string }>;
  onEngineInfoTooltipChange: (
    value: {
      engineId: string;
      top: number;
      anchorX: number;
    } | null
  ) => void;
}

function LogoMark() {
  return (
    <div className="relative flex h-11 w-11 items-center justify-center">
      <YHubLogo size="sm" showText={false} />
    </div>
  );
}

export function AppSidebar({
  mobileNav,
  onCloseMobileNav,
  activeCourseName,
  isInstructor,
  location,
  accountName,
  academicMeta,
  avatarInitial,
  engineSearch,
  onEngineSearchChange,
  instructorSearchResults,
  quickPracticeSearchMatch,
  dynamicNavItems,
  majorLabels,
  onEngineInfoTooltipChange,
}: AppSidebarProps) {
  const { language, t } = useLanguage();

  return (
    <aside
      className={`fixed inset-y-0 z-40 flex w-[288px] flex-col border-sidebar-border bg-sidebar/95 px-4 py-5 text-sidebar-foreground shadow-2xl shadow-black/20 backdrop-blur-2xl transition-transform duration-300 md:translate-x-0 ${
        language === 'ar'
          ? 'right-0 border-l'
          : 'left-0 border-r'
      } ${
        mobileNav
          ? 'translate-x-0'
          : language === 'ar'
            ? 'translate-x-full'
            : '-translate-x-full'
      }`}
    >
      <div className="mb-7 flex items-center gap-3 px-2">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-400/15 bg-cyan-400/[0.06] shadow-[0_0_28px_rgba(34,211,238,0.08)]">
          <LogoMark />
        </div>

        <div className="min-w-0 flex-1">
          <div className="yhub-display text-sm font-black tracking-[0.18em] text-white">
            Y HUB
          </div>

          <div className="mt-1 truncate text-[11px] font-medium text-slate-500">
            {activeCourseName ||
              (language === 'ar'
                ? 'المنصة الأكاديمية الذكية'
                : 'Academic Intelligence Platform')}
          </div>
        </div>

        <button
          onClick={() => onCloseMobileNav()}
          aria-label={t('closeMenu')}
          data-testid="button-close-mobile-nav"
          className="rounded-xl border border-white/[0.06] p-2 text-slate-400 transition-colors hover:bg-white/[0.05] hover:text-white md:hidden"
        >
          <X size={18} />
        </button>
      </div>

      <div className="mb-6 h-px bg-gradient-to-r from-transparent via-slate-800 to-transparent" />

      <SidebarEngineSearch
        isInstructor={isInstructor}
        engineSearch={engineSearch}
        onEngineSearchChange={onEngineSearchChange}
        instructorSearchResults={instructorSearchResults}
        quickPracticeSearchMatch={quickPracticeSearchMatch}
        majorLabels={majorLabels}
        onCloseMobileNav={onCloseMobileNav}
      />
      <SidebarNavigation
        isInstructor={isInstructor}
        location={location}
        onCloseMobileNav={onCloseMobileNav}
        dynamicNavItems={dynamicNavItems}
        onEngineInfoTooltipChange={onEngineInfoTooltipChange}
      />
      <SidebarAccountCard
        accountName={accountName}
        academicMeta={academicMeta}
        avatarInitial={avatarInitial}
        onCloseMobileNav={onCloseMobileNav}
      />
    </aside>
  );
}
