import * as React from 'react';
import { ChevronLeft, Menu } from 'lucide-react';
import { useLanguage } from '@/i18n/LanguageContext';

interface HeaderPageContextProps {
  currentTitle: string;
  onOpenMobileNav: () => void;
}

export function HeaderPageContext({
  currentTitle,
  onOpenMobileNav,
}: HeaderPageContextProps) {
  const { language, t } = useLanguage();

  return (
      <div className="flex min-w-0 items-center gap-3">
        <button
          onClick={onOpenMobileNav}
          aria-label={t('openMenu')}
          data-testid="button-open-mobile-nav"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-background/60 text-foreground transition-colors hover:border-primary/30 hover:bg-primary/10 hover:text-primary md:hidden"
        >
          <Menu size={18} />
        </button>

        <div className="min-w-0">
          <div className="hidden items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground sm:flex">
            <span>Y HUB</span>
            <ChevronLeft
              size={13}
              className={language === 'en' ? 'rotate-180' : ''}
            />
            <span className="truncate text-muted-foreground">
              {t('academy')}
            </span>
          </div>

          <div className="truncate text-sm font-black text-foreground sm:mt-1 sm:text-base">
            {currentTitle}
          </div>
        </div>
      </div>
  );
}
