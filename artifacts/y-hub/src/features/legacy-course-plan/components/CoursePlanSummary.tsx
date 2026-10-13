import * as React from 'react';
import type { CoursePlanController } from '../hooks/useCoursePlan';

type Props = Pick<CoursePlanController, 'language' | 't'>;

export function CoursePlanSummary({ language, t }: Props) {
  return (
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
  );
}
