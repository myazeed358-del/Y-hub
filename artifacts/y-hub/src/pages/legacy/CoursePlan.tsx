import * as React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'wouter';
import { courseLessons } from '@/content/course';
import { localizeLesson } from '@/content/localizeLesson';
import { useLanguage } from '@/i18n/LanguageContext';
import {
  SectionKicker,
} from '@/components/legacy/LegacyLearningWidgets';

const lessons = courseLessons;

export default function CoursePlan() {
  const { language, t } = useLanguage();
  const completed = lessons.filter((lesson) => lesson.progress === 100).length;
  return (
    <div className="mx-auto max-w-6xl" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="mb-9 flex flex-wrap items-end justify-between gap-5">
        <div>
          <SectionKicker>{t('courseMap')}</SectionKicker>
          <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">{language === 'ar' ? 'من الأساس إلى أنظمة الاستدلال' : 'From foundations to inference systems'}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-8 text-[hsl(var(--muted-foreground))]">{t('courseDescription')}</p>
        </div>
        <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-5 py-4 text-center">
          <div className="font-mono text-2xl font-bold text-[hsl(var(--primary))]">{completed} / {lessons.length}</div>
          <div className="text-xs text-[hsl(var(--muted-foreground))]">{t('unitsCompleted')}</div>
        </div>
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-3">
        <div className="rounded-[1.5rem] bg-[hsl(var(--sidebar))] p-6 text-[hsl(var(--sidebar-foreground))]">
          <div className="font-mono text-3xl text-[hsl(var(--accent))]">١٥</div>
          <p className="mt-2 text-sm text-[hsl(var(--sidebar-foreground)/.7)]">{language === 'ar' ? 'أسبوعًا من التدرج النظري والتطبيقي' : 'of theory and applied progression'}</p>
        </div>
        <div className="rounded-[1.5rem] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6">
          <div className="font-mono text-3xl text-[hsl(var(--primary))]">٤</div>
          <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">{t('stages')}</p>
        </div>
        <div className="rounded-[1.5rem] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6">
          <div className="font-mono text-3xl text-[hsl(var(--chart-4))]">∞</div>
          <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">{t('examplesAndFormulas')}</p>
        </div>
      </div>

      <div className="space-y-3">
        {lessons.map((lesson, index) => {
          const localizedLesson = localizeLesson(lesson, language);
          return (
          <Link
            key={lesson.slug}
            href={`/lesson/${lesson.slug}`}
            data-testid={`course-week-${index + 1}`}
            className="group grid gap-4 rounded-[1.5rem] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 transition-all hover:-translate-y-0.5 hover:border-[hsl(var(--primary)/.35)] hover:shadow-[0_12px_30px_rgba(65,54,33,0.07)] md:grid-cols-[86px_1fr_auto] md:items-center"
          >
            <div className="flex items-center gap-3 md:block">
              <div className="font-mono text-xs text-[hsl(var(--muted-foreground))]">{lesson.number}</div>
              <div className="mt-1 text-sm font-bold text-[hsl(var(--primary))]">{lesson.week}</div>
            </div>
            <div>
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <h2 className="text-base font-extrabold">{localizedLesson.title}</h2>
                <span className="rounded-full bg-[hsl(var(--muted))] px-2 py-1 text-[10px] text-[hsl(var(--muted-foreground))]">{lesson.duration}</span>
              </div>
              <p className="text-sm leading-7 text-[hsl(var(--muted-foreground))]">{localizedLesson.subtitle}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {localizedLesson.topics.slice(0, 3).map((topic) => (
                  <span key={topic} className="rounded-lg border border-[hsl(var(--border))] px-2 py-1 text-[10px] text-[hsl(var(--muted-foreground))]">{topic}</span>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between gap-5 md:block md:text-left">
              <div className="text-xs text-[hsl(var(--muted-foreground))]">{lesson.sections.length} {t('deepTopics')}</div>
              <ArrowLeft size={18} className="mt-2 text-[hsl(var(--muted-foreground))] transition-transform group-hover:-translate-x-1 group-hover:text-[hsl(var(--primary))]" />
            </div>
          </Link>
          );
        })}
      </div>
    </div>
  );
}
