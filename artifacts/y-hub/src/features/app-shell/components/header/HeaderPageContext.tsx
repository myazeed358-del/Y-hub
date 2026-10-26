import * as React from 'react';
import { ChevronLeft, Menu } from 'lucide-react';
import { Link } from 'wouter';
import type { PageBreadcrumb } from '../../domain/breadcrumbs';
import { useLanguage } from '@/i18n/LanguageContext';

interface HeaderPageContextProps {
  currentTitle: string;
  breadcrumbs?: readonly PageBreadcrumb[];
  onOpenMobileNav: () => void;
}

export function HeaderPageContext({
  currentTitle,
  breadcrumbs = [],
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
          {breadcrumbs.length > 1 && (
            <nav aria-label={language === 'ar' ? 'مسار التنقل' : 'Breadcrumb'} dir={language === 'ar' ? 'rtl' : 'ltr'}>
              <ol className="flex min-w-0 items-center gap-1 text-[11px] font-semibold text-muted-foreground sm:gap-2">
                {breadcrumbs.map((item, index) => (
                  <li key={item.href ?? 'current'} className={`min-w-0 items-center gap-1 sm:gap-2 ${index < breadcrumbs.length - 2 ? 'hidden sm:flex' : 'flex'}`}>
                    {index > 0 && <ChevronLeft aria-hidden="true" size={13} className={`shrink-0 ${language === 'en' ? 'rotate-180' : ''} ${index === breadcrumbs.length - 2 ? 'hidden sm:block' : ''}`} />}
                    {item.href ? (
                      <Link href={item.href} title={item.label} className="truncate rounded hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">{item.label}</Link>
                    ) : <span aria-current="page" title={item.label} className="truncate">{item.label}</span>}
                  </li>
                ))}
              </ol>
            </nav>
          )}

          <div data-testid="header-page-title" title={currentTitle} className="truncate text-sm font-black text-foreground sm:mt-1 sm:text-base">
            {currentTitle}
          </div>
        </div>
      </div>
  );
}
