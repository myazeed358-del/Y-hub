import * as React from 'react';
import { SectionKicker } from '@/components/legacy/LegacyLearningWidgets';
import type { CoursePlanController } from '../hooks/useCoursePlan';

type Props = Pick<
  CoursePlanController,
  'language' | 't' | 'completed' | 'lessons'
>;

export function CoursePlanHeader({
  language,
  t,
  completed,
  lessons,
}: Props) {
  return (
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
  );
}
