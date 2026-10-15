import * as React from 'react';
import { CheckCircle2, Circle } from 'lucide-react';
import { Link } from 'wouter';
import { courseLessons } from '@/content/course';
import { localizeLesson } from '@/content/localizeLesson';
import { useLanguage } from '@/i18n/LanguageContext';

const lessons = courseLessons;

interface SidebarLessonPathProps {
  location: string;
  onCloseMobileNav: () => void;
}

export function SidebarLessonPath({
  location,
  onCloseMobileNav,
}: SidebarLessonPathProps) {
  const { language, t } = useLanguage();

  return (
    <>
        {(location.startsWith('/lesson') ||
          location.startsWith('/course')) && (
          <div>
            <div className="my-6 h-px bg-gradient-to-r from-transparent via-slate-300 dark:via-slate-800 to-transparent" />

            <div className="mb-3 px-3 text-[10px] font-black uppercase tracking-[0.22em] text-slate-600 dark:text-slate-600">
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
                    className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs text-slate-700 transition-colors hover:bg-white hover:text-slate-950 dark:text-slate-500 dark:hover:bg-white/[0.035] dark:hover:text-slate-200"
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

            <div className="mt-5 rounded-2xl border border-border bg-card/80 p-4 dark:border-white/[0.06] dark:bg-white/[0.025]">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="text-slate-500">
                  {t('overallProgress')}
                </span>
                <span className="font-mono font-bold text-cyan-700 dark:text-cyan-300">
                  ٣٧٪
                </span>
              </div>

              <div className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-900">
                <div className="h-full w-[37%] rounded-full bg-gradient-to-r from-cyan-400 to-violet-500" />
              </div>

              <p className="mt-3 text-[11px] leading-5 text-slate-600 dark:text-slate-600">
                {t('progressMessage')}
              </p>
            </div>
          </div>
        )}
    </>
  );
}
