import * as React from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { Link } from 'wouter';
import type { CourseLesson } from '@/content/course';
import { SectionKicker } from '@/components/legacy/LegacyLearningWidgets';
import { DeepSectionCard } from './DeepSectionCard';
import type { LegacyLessonController } from '../hooks/useLegacyLesson';

type Props = Pick<
  LegacyLessonController,
  't' | 'previous' | 'next'
> & {
  lesson: CourseLesson;
};

export function LessonArticle({
  lesson,
  t,
  previous,
  next,
}: Props) {
  return (
<article className="space-y-6">
          <div className="rounded-[1.75rem] bg-[hsl(var(--sidebar))] p-7 text-[hsl(var(--sidebar-foreground))] md:p-9">
            <div className="mb-5 flex items-center gap-2 text-xs font-bold text-[hsl(var(--accent))]"><Sparkles size={15} /> {t('centralIdea')}</div>
            <p className="text-xl font-semibold leading-[2] md:text-2xl">{lesson.summary}</p>
          </div>
          <div className="rounded-[1.75rem] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-7 md:p-9">
            <h2 className="mb-7 text-xl font-extrabold">{t('keyTakeaways')}</h2>
            <div className="space-y-5">
              {lesson.points.map((point, pointIndex) => (
                <div key={point} className="flex gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--primary)/.1)] font-mono text-xs font-bold text-[hsl(var(--primary))]">{String(pointIndex + 1).padStart(2, '٠')}</div>
                  <p className="pt-1 text-sm leading-7 text-[hsl(var(--muted-foreground))]">{point}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[1.5rem] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6">
              <SectionKicker>{t('learningObjectives')}</SectionKicker>
              <h2 className="mb-4 text-lg font-extrabold">{t('afterLesson')}</h2>
              <ul className="space-y-3 text-sm leading-7 text-[hsl(var(--muted-foreground))]">
                {lesson.objectives.map((objective) => <li key={objective} className="flex gap-3"><CheckCircle2 size={16} className="mt-1 shrink-0 text-[hsl(var(--primary))]" /><span>{objective}</span></li>)}
              </ul>
            </div>
            <div className="rounded-[1.5rem] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6">
              <SectionKicker>{t('coreVocabulary')}</SectionKicker>
              <h2 className="mb-4 text-lg font-extrabold">{t('recurringWords')}</h2>
              <div className="flex flex-wrap gap-2">
                {lesson.keywords.map((keyword) => <span key={keyword} className="rounded-xl bg-[hsl(var(--muted))] px-3 py-2 text-xs font-semibold text-[hsl(var(--muted-foreground))]">{keyword}</span>)}
              </div>
              <div className="mt-6 border-t border-[hsl(var(--border))] pt-4 text-xs leading-6 text-[hsl(var(--muted-foreground))]">
                {t('planTopics')}: {lesson.topics.join(' · ')}
              </div>
            </div>
          </div>
          <div className="space-y-6">
            {lesson.sections.map((section, sectionIndex) => <DeepSectionCard key={section.title} section={section} index={sectionIndex} />)}
          </div>
          <div className="flex items-center justify-between border-t border-[hsl(var(--border))] pt-6">
             {previous ? <Link href={`/lesson/${previous.slug}`} data-testid="link-previous-lesson" className="inline-flex items-center gap-2 rounded-xl px-2 py-2 text-sm font-bold text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))]"><ArrowRight size={16} /> {t('previous')}</Link> : <span />}
             {next ? <Link href={`/lesson/${next.slug}`} data-testid="link-next-lesson" className="inline-flex items-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 py-3 text-sm font-bold text-[hsl(var(--primary-foreground))]">{t('nextLesson')} <ArrowLeft size={16} /></Link> : <Link href="/quiz" data-testid="link-finish-to-quiz" className="inline-flex items-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 py-3 text-sm font-bold text-[hsl(var(--primary-foreground))]">{t('testUnderstanding')} <ArrowLeft size={16} /></Link>}
          </div>
        </article>
  );
}
