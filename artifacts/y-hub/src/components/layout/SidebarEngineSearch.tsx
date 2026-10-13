import {
  ArrowRight,
  BrainCircuit,
  Calculator,
  Search,
} from 'lucide-react';
import { Link } from 'wouter';
import { searchEngines } from '@/config/majorEngineAccess';
import { useLanguage } from '@/i18n/LanguageContext';

interface SidebarEngineSearchProps {
  isInstructor: boolean;
  engineSearch: string;
  onEngineSearchChange: (value: string) => void;
  instructorSearchResults: ReturnType<typeof searchEngines>;
  quickPracticeSearchMatch: boolean;
  majorLabels: Record<string, { ar: string; en: string }>;
  onCloseMobileNav: () => void;
}

export function SidebarEngineSearch({
  isInstructor,
  engineSearch,
  onEngineSearchChange,
  instructorSearchResults,
  quickPracticeSearchMatch,
  majorLabels,
  onCloseMobileNav,
}: SidebarEngineSearchProps) {
  const { language } = useLanguage();

  return (
    <>
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
    </>
  );
}
