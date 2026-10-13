import * as React from 'react';
import { ArrowRight } from 'lucide-react';
import { Link } from 'wouter';
import type { CourseLesson } from '@/content/course';
import type { LegacyLessonController } from '../hooks/useLegacyLesson';

type Props = Pick<
  LegacyLessonController,
  't' | 'index' | 'lessons'
> & {
  lesson: CourseLesson;
};

export function LessonHeader({
  t,
  index,
  lessons,
  lesson,
}: Props) {
  return (
    <>
<Link href="/" data-testid="link-back-dashboard" className="mb-8 inline-flex items-center gap-2 text-sm font-bold text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))]"><ArrowRight size={16} /> {t('backToDesk')}</Link>
      <div className="mb-10 grid gap-8 lg:grid-cols-[1fr_300px] lg:items-start">
        <div>
          <div className="mb-4 flex flex-wrap items-center gap-3 text-xs font-bold text-[hsl(var(--primary))]"><span className="rounded-full bg-[hsl(var(--primary)/.1)] px-3 py-1.5">{lesson.eyebrow}</span><span className="text-[hsl(var(--muted-foreground))]">{lesson.week} · {lesson.duration}</span></div>
          <h1 className="text-4xl font-extrabold leading-[1.25] tracking-tight md:text-6xl">{lesson.title}</h1>
          <p className="mt-4 text-lg leading-8 text-[hsl(var(--muted-foreground))]">{lesson.subtitle}</p>
        </div>
        <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
          <div className="mb-3 flex items-center justify-between text-xs font-bold"><span>تقدم الدرس</span><span className="font-mono text-[hsl(var(--primary))]">{lesson.progress}٪</span></div>
          <div className="mb-4 h-2 rounded-full bg-[hsl(var(--muted))]"><div className="h-full rounded-full bg-[hsl(var(--primary))]" style={{ width: `${lesson.progress}%` }} /></div>
          <div className="flex items-center justify-between text-[11px] text-[hsl(var(--muted-foreground))]"><span>{index + 1} {t('from')} {lessons.length}</span><span>{lesson.progress === 100 ? t('completed') : t('learning')}</span></div>
        </div>
      </div>
    </>
  );
}
