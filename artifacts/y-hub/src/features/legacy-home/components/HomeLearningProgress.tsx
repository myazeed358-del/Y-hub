import * as React from 'react';
import { ArrowLeft, Info } from 'lucide-react';
import { Link } from 'wouter';
import {
  SectionKicker,
  ProgressRing,
} from '@/components/legacy/LegacyLearningWidgets';
import type { LegacyHomeController } from '../hooks/useLegacyHome';

type Props = Pick<
  LegacyHomeController,
  'language' | 't' | 'featuredLessons'
>;

export function HomeLearningProgress({
  language,
  t,
  featuredLessons,
}: Props) {
  return (
<section className="grid gap-4 md:grid-cols-[1.3fr_.7fr]">
        <div className="rounded-[1.5rem] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 md:p-7">
           <div className="mb-6 flex items-start justify-between">
             <div><SectionKicker>{t('currentPath')}</SectionKicker><h2 className="text-2xl font-extrabold">{language === 'ar' ? 'أساسيات المجموعات الضبابية' : 'Fuzzy sets foundations'}</h2></div>
             <div className="text-left"><div className="font-mono text-2xl font-bold text-[hsl(var(--primary))]">{language === 'ar' ? '٣٧٪' : '37%'}</div><div className="text-[11px] text-[hsl(var(--muted-foreground))]">{t('done')}</div></div>
          </div>
          <div className="mb-7 h-2 overflow-hidden rounded-full bg-[hsl(var(--muted))]"><div className="h-full w-[37%] rounded-full bg-[hsl(var(--primary))]" /></div>
          <div className="space-y-3">
             {featuredLessons.map(({ lesson, localizedLesson }) => {

               return (
              <Link key={lesson.slug} href={`/lesson/${lesson.slug}`} data-testid={`card-lesson-${lesson.slug}`} className="group flex items-center gap-4 rounded-2xl border border-transparent bg-[hsl(var(--background)/.72)] p-3.5 transition-all hover:border-[hsl(var(--primary)/.2)] hover:bg-[hsl(var(--primary)/.04)]">
                <ProgressRing value={lesson.progress} />
                 <div className="min-w-0 flex-1"><div className="mb-1 flex items-center gap-2"><span className="font-mono text-[10px] text-[hsl(var(--muted-foreground))]">{lesson.number}</span><h3 className="truncate text-sm font-bold">{localizedLesson.title}</h3></div><p className="truncate text-xs text-[hsl(var(--muted-foreground))]">{localizedLesson.subtitle}</p></div>
                <ArrowLeft size={17} className="text-[hsl(var(--muted-foreground))] transition-transform group-hover:-translate-x-1 group-hover:text-[hsl(var(--primary))]" />
              </Link>
               );
             })}
          </div>
        </div>
        <div className="rounded-[1.5rem] bg-[hsl(var(--sidebar))] p-6 text-[hsl(var(--sidebar-foreground))] md:p-7">
           <div className="mb-8 flex items-center justify-between"><div><SectionKicker>{t('dailySnapshot')}</SectionKicker><h2 className="text-xl font-extrabold">{t('ideaInMinute')}</h2></div><div className="rounded-xl bg-[hsl(var(--sidebar-accent))] p-2.5 text-[hsl(var(--accent))]"><Info size={18} /></div></div>
          <div className="font-mono text-4xl text-[hsl(var(--accent))]">μ(x)</div>
           <p className="mt-4 text-sm leading-7 text-[hsl(var(--sidebar-foreground)/.7)]">{language === 'ar' ? 'ليست درجة العضوية احتمالاً لحدوث شيء؛ إنها مقياس لمدى انتماء الشيء إلى مفهوم.' : 'Membership grade is not the probability that something happens; it measures how strongly it belongs to a concept.'}</p>
           <Link href="/lesson/membership-grade" data-testid="link-daily-idea" className="mt-8 inline-flex items-center gap-2 text-sm font-bold text-[hsl(var(--accent))]">{t('readExplanation')} <ArrowLeft size={16} /></Link>
        </div>
      </section>
  );
}
