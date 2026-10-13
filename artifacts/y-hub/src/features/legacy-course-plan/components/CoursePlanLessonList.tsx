import * as React from 'react';
import { Link } from 'wouter';
import { ArrowLeft } from 'lucide-react';
import type { CoursePlanController } from '../hooks/useCoursePlan';

type Props = Pick<
  CoursePlanController,
  't' | 'localizedLessons'
>;

export function CoursePlanLessonList({
  t,
  localizedLessons,
}: Props) {
  return (
<div className="space-y-3">
        {localizedLessons.map(({ lesson, localizedLesson }, index) => {
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
  );
}
