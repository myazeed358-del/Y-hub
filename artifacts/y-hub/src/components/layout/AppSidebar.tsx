import type { LucideIcon } from 'lucide-react';
import {
  ArrowRight,
  BrainCircuit,
  Calculator,
  CheckCircle2,
  Circle,
  Info,
  Search,
  UserRound,
  X,
} from 'lucide-react';
import { Link } from 'wouter';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@workspace/y-hub-ds/components/ui/avatar';

import YHubLogo from '@/components/YHubLogo';
import { ENGINE_CATALOG, searchEngines } from '@/config/majorEngineAccess';
import { courseLessons } from '@/content/course';
import { localizeLesson } from '@/content/localizeLesson';
import { useLanguage } from '@/i18n/LanguageContext';
import type { UiKey } from '@/i18n/uiCopy';

const lessons = courseLessons;

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

      {isInstructor && (
        <div className="relative mb-6 px-1">
          <div className="relative">
            <Search
              size={16}
              className={`absolute top-1/2 -translate-y-1/2 text-slate-600 ${
                language === 'ar' ? 'right-3.5' : 'left-3.5'
              }`}
            />

            <input
              type="search"
              value={engineSearch}
              onChange={(event) => onEngineSearchChange(event.target.value)}
              placeholder={
                language === 'ar'
                  ? 'ابحث في الأدوات الأكاديمية...'
                  : 'Search academic tools...'
              }
              className={`h-11 w-full rounded-xl border border-slate-800 bg-slate-950/55 text-xs text-slate-200 outline-none transition-all placeholder:text-slate-700 focus:border-cyan-400/25 focus:ring-2 focus:ring-cyan-400/[0.06] ${
                language === 'ar'
                  ? 'pr-10 pl-3'
                  : 'pl-10 pr-3'
              }`}
            />
          </div>

          {engineSearch.trim() && (
            <div className="mt-2 overflow-hidden rounded-2xl border border-slate-800 bg-[#080d18] shadow-2xl shadow-black/30">
              {instructorSearchResults.length > 0 ||
              quickPracticeSearchMatch ? (
                <div className="max-h-[320px] overflow-y-auto p-2">
                  {quickPracticeSearchMatch && (
                    <Link
                      href="/quiz"
                      onClick={() => {
                        onEngineSearchChange('');
                        onCloseMobileNav();
                      }}
                      className="group flex items-start gap-3 rounded-xl p-3 transition-colors hover:bg-cyan-400/[0.05]"
                    >
                      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-violet-400/10 bg-violet-400/[0.05] text-violet-300">
                        <BrainCircuit size={16} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-bold text-slate-200 group-hover:text-cyan-200">
                          {language === 'ar'
                            ? 'تدريب سريع'
                            : 'Quick Practice'}
                        </div>

                        <div className="mt-1 truncate text-[10px] text-slate-600">
                          {language === 'ar'
                            ? 'أداة تدريب حسب المساق'
                            : 'Course-based practice tool'}
                        </div>
                      </div>

                      <ArrowRight
                        size={14}
                        className={`mt-2 shrink-0 text-slate-700 group-hover:text-cyan-400 ${
                          language === 'ar' ? 'rotate-180' : ''
                        }`}
                      />
                    </Link>
                  )}

                  {instructorSearchResults.map((engine) => {
                    const engineMajor =
                      engine.majors[0] &&
                      majorLabels[engine.majors[0]]
                        ? majorLabels[engine.majors[0]][language]
                        : engine.majors[0] || '';

                    return (
                      <Link
                        key={engine.id}
                        href={engine.route}
                        onClick={() => {
                          onEngineSearchChange('');
                          onCloseMobileNav();
                        }}
                        className="group flex items-start gap-3 rounded-xl p-3 transition-colors hover:bg-cyan-400/[0.05]"
                      >
                        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-400/10 bg-cyan-400/[0.05] text-cyan-400">
                          <Calculator size={16} />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-bold text-slate-200 group-hover:text-cyan-200">
                            {engine.title[language]}
                          </div>

                          <div className="mt-1 truncate text-[10px] text-slate-600">
                            {engineMajor}
                          </div>
                        </div>

                        <ArrowRight
                          size={14}
                          className={`mt-2 shrink-0 text-slate-700 group-hover:text-cyan-400 ${
                            language === 'ar' ? 'rotate-180' : ''
                          }`}
                        />
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="px-4 py-5 text-center text-[11px] text-slate-600">
                  {language === 'ar'
                    ? 'لا توجد أدوات مطابقة للبحث.'
                    : 'No tools match your search.'}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <nav className="min-h-0 flex-1 space-y-7 overflow-y-auto pr-1">
        {dynamicNavItems.map((group, gIndex) => (
          <div key={gIndex}>
            <div className="mb-2.5 px-3 text-[10px] font-black uppercase tracking-[0.22em] text-slate-600">
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
                          ? 'border-cyan-400/20 bg-gradient-to-r from-cyan-400/[0.12] to-violet-500/[0.08] text-white shadow-[0_10px_30px_rgba(0,0,0,0.18)]'
                          : 'border-transparent text-slate-400 hover:border-white/[0.05] hover:bg-white/[0.035] hover:text-slate-100'
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
                            ? 'border-cyan-400/15 bg-cyan-400/[0.08] text-cyan-300'
                            : 'border-white/[0.04] bg-white/[0.025] text-slate-500 group-hover:text-slate-200'
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
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-600 transition-all hover:bg-cyan-400/[0.08] hover:text-cyan-300 focus:bg-cyan-400/[0.08] focus:text-cyan-300 focus:outline-none focus:ring-1 focus:ring-cyan-400/30"
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

        {(location.startsWith('/lesson') ||
          location.startsWith('/course')) && (
          <div>
            <div className="my-6 h-px bg-gradient-to-r from-transparent via-slate-800 to-transparent" />

            <div className="mb-3 px-3 text-[10px] font-black uppercase tracking-[0.22em] text-slate-600">
              {t('lessonPath') || 'خريطة المسار'}
            </div>

            <div className="space-y-1">
              {lessons.slice(0, 5).map((lesson, index) => {
                const localizedLesson = localizeLesson(lesson, language);

                return (
                  <Link
                    key={lesson.slug}
                    href={`/lesson/${lesson.slug}`}
                    onClick={() => onCloseMobileNav()}
                    data-testid={`link-sidebar-lesson-${index + 1}`}
                    className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs text-slate-500 transition-colors hover:bg-white/[0.035] hover:text-slate-200"
                  >
                    {lesson.progress === 100 ? (
                      <CheckCircle2
                        size={15}
                        className="text-cyan-400"
                      />
                    ) : (
                      <Circle
                        size={15}
                        className={
                          lesson.progress > 0
                            ? 'text-violet-400'
                            : 'text-slate-700'
                        }
                      />
                    )}

                    <span className="truncate">
                      {localizedLesson.title}
                    </span>

                    <span className="mr-auto font-mono text-[10px] opacity-40">
                      {lesson.number}
                    </span>
                  </Link>
                );
              })}
            </div>

            <div className="mt-5 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="text-slate-500">
                  {t('overallProgress')}
                </span>
                <span className="font-mono font-bold text-cyan-300">
                  ٣٧٪
                </span>
              </div>

              <div className="h-1.5 overflow-hidden rounded-full bg-slate-900">
                <div className="h-full w-[37%] rounded-full bg-gradient-to-r from-cyan-400 to-violet-500" />
              </div>

              <p className="mt-3 text-[11px] leading-5 text-slate-600">
                {t('progressMessage')}
              </p>
            </div>
          </div>
        )}
      </nav>

      <Link
        href="/profile"
        onClick={() => onCloseMobileNav()}
        className="mt-5 flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3 transition-all hover:border-cyan-400/15 hover:bg-cyan-400/[0.04]"
      >
        <Avatar className="h-10 w-10 rounded-xl border border-cyan-400/15">
          <AvatarImage src={undefined} alt={accountName} />
          <AvatarFallback className="rounded-xl bg-cyan-400/[0.08] font-black text-cyan-300">
            {avatarInitial}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-bold text-slate-200">
            {accountName}
          </div>
          <div className="mt-1 truncate text-[10px] text-slate-600">
            {academicMeta}
          </div>
        </div>

        <UserRound size={16} className="shrink-0 text-slate-600" />
      </Link>
    </aside>
  );
}
