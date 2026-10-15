import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Info } from 'lucide-react';
import { Link } from 'wouter';
import { ENGINE_CATALOG } from '@/config/majorEngineAccess';
import { useLanguage } from '@/i18n/LanguageContext';
import type { UiKey } from '@/i18n/uiCopy';
import { SidebarLessonPath } from '@/features/app-shell/components/sidebar/SidebarLessonPath';

interface SidebarNavigationProps {
  isInstructor: boolean;
  location: string;
  onCloseMobileNav: () => void;
  dynamicNavItems: {
    section: UiKey;
    items: {
      href: string;
      key: UiKey;
      icon: LucideIcon;
    }[];
  }[];
  onEngineInfoTooltipChange: (
    value: {
      engineId: string;
      top: number;
      anchorX: number;
    } | null
  ) => void;
}

export function SidebarNavigation({
  isInstructor,
  location,
  onCloseMobileNav,
  dynamicNavItems,
  onEngineInfoTooltipChange,
}: SidebarNavigationProps) {
  const { language, t } = useLanguage();

  return (
      <nav className="min-h-0 flex-1 space-y-7 overflow-y-auto pr-1">
        {dynamicNavItems.map((group, gIndex) => (
          <div key={gIndex}>
            <div className="mb-2.5 px-3 text-[10px] font-black uppercase tracking-[0.22em] text-slate-600 dark:text-slate-600">
              {t(group.section)}
            </div>

            <div className="space-y-1.5">
              {group.items.map((item) => {
                if (
                  isInstructor &&
                  item.key === 'quickPractice'
                ) {
                  return null;
                }

                const active =
                  item.href === location ||
                  (item.href === '/' && location === '/dashboard');

                const Icon = item.icon;
                const engineMeta = ENGINE_CATALOG.find(
                  (engine) => engine.route === item.href
                );

                return (
                  <div key={item.href} className="relative">
                    <Link
                      href={item.href}
                      onClick={() => onCloseMobileNav()}
                      data-testid={`link-nav-${item.key}`}
                      className={`group relative flex items-center gap-3 overflow-hidden rounded-2xl border px-3.5 py-3 pe-12 text-sm font-semibold transition-all duration-200 ${
                        active
                          ? 'border-cyan-300/80 bg-gradient-to-r from-cyan-100 to-violet-100/60 text-[#172B45] shadow-sm dark:border-cyan-400/20 dark:from-cyan-400/[0.12] dark:to-violet-500/[0.08] dark:text-white dark:shadow-[0_10px_30px_rgba(0,0,0,0.18)]'
                          : 'border-transparent text-slate-700 hover:border-slate-200 hover:bg-white/90 hover:text-slate-950 dark:text-slate-400 dark:hover:border-white/[0.05] dark:hover:bg-white/[0.035] dark:hover:text-slate-100'
                      }`}
                    >
                      {active && (
                        <span
                          className={`absolute inset-y-3 w-[2px] rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.8)] ${
                            language === 'ar' ? 'right-0' : 'left-0'
                          }`}
                        />
                      )}

                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors ${
                          active
                            ? 'border-cyan-200 bg-cyan-100 text-cyan-700 dark:border-cyan-400/15 dark:bg-cyan-400/[0.08] dark:text-cyan-300'
                            : 'border-border bg-card text-muted-foreground group-hover:text-foreground dark:border-white/[0.04] dark:bg-white/[0.025] dark:text-slate-500 dark:group-hover:text-slate-200'
                        }`}
                      >
                        <Icon size={18} strokeWidth={active ? 2.35 : 2} />
                      </span>

                      <span className="min-w-0 flex-1 truncate">
                        {t(item.key)}
                      </span>
                    </Link>

                    {engineMeta && (
                      <div
                        className={`absolute top-1/2 z-30 -translate-y-1/2 ${
                          language === 'ar' ? 'left-3' : 'right-3'
                        }`}
                      >
                        <button
                          type="button"
                          aria-label={
                            language === 'ar'
                              ? `نبذة عن ${engineMeta.title.ar}`
                              : `About ${engineMeta.title.en}`
                          }
                          onMouseEnter={(event) => {
                            const rect =
                              event.currentTarget.getBoundingClientRect();

                            onEngineInfoTooltipChange({
                              engineId: engineMeta.id,
                              top: rect.top + rect.height / 2,
                              anchorX:
                                language === 'ar'
                                  ? rect.left
                                  : rect.right,
                            });
                          }}
                          onMouseLeave={() => onEngineInfoTooltipChange(null)}
                          onFocus={(event) => {
                            const rect =
                              event.currentTarget.getBoundingClientRect();

                            onEngineInfoTooltipChange({
                              engineId: engineMeta.id,
                              top: rect.top + rect.height / 2,
                              anchorX:
                                language === 'ar'
                                  ? rect.left
                                  : rect.right,
                            });
                          }}
                          onBlur={() => onEngineInfoTooltipChange(null)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition-all hover:bg-cyan-100 hover:text-cyan-800 focus:bg-cyan-100 focus:text-cyan-800 dark:text-slate-600 dark:hover:bg-cyan-400/[0.08] dark:hover:text-cyan-300 dark:focus:bg-cyan-400/[0.08] dark:focus:text-cyan-300 focus:outline-none focus:ring-1 focus:ring-cyan-400/30"
                        >
                          <Info size={15} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <SidebarLessonPath location={location} onCloseMobileNav={onCloseMobileNav} />
      </nav>
  );
}
