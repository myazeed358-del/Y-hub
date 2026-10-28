import * as React from 'react';
import {
  ArrowLeft,
  BarChart3,
  BrainCircuit,
  FlaskConical,
  SlidersHorizontal,
} from 'lucide-react';
import { Link } from 'wouter';
import { SectionKicker } from '@/components/legacy/LegacyLearningWidgets';
import type { LegacyHomeController } from '../hooks/useLegacyHome';

type Props = Pick<LegacyHomeController, 't' | 'language'>;

export function HomeToolGrid({ t, language }: Props) {
  return (
<section>
         <div className="mb-5 flex items-end justify-between"><div><SectionKicker>{t('understandingTools')}</SectionKicker><h2 className="text-2xl font-extrabold">{t('dontMemorize')}</h2></div><span className="hidden text-xs text-[hsl(var(--muted-foreground))] sm:block">{t('everyToolLinked')}</span></div>
        <div className="grid gap-4 md:grid-cols-3">
          <Link href="/lab" data-testid="card-tool-lab" className="group relative overflow-hidden rounded-[1.5rem] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 transition-all hover:-translate-y-1 hover:border-[hsl(var(--primary)/.35)]">
             <div className="mb-10 flex h-12 w-12 items-center justify-center rounded-2xl bg-[hsl(var(--primary)/.1)] text-[hsl(var(--primary))]"><SlidersHorizontal size={22} /></div><h3 className="text-lg font-extrabold">{t('membershipLab')}</h3><p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">{t('membershipLabDescription')}</p><ArrowLeft size={17} className="absolute bottom-7 left-7 text-[hsl(var(--muted-foreground))] transition-transform group-hover:-translate-x-1" />
          </Link>
          <Link href="/quiz" data-testid="card-tool-quiz" className="group relative overflow-hidden rounded-[1.5rem] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 transition-all hover:-translate-y-1 hover:border-[hsl(var(--accent)/.45)]">
             <div className="mb-10 flex h-12 w-12 items-center justify-center rounded-2xl bg-[hsl(var(--accent)/.18)] text-[hsl(var(--accent-foreground))]"><BrainCircuit size={22} /></div><h3 className="text-lg font-extrabold">{t('quickPractice')}</h3><p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">{t('quickPracticeDescription')}</p><ArrowLeft size={17} className="absolute bottom-7 left-7 text-[hsl(var(--muted-foreground))] transition-transform group-hover:-translate-x-1" />
          </Link>
          <div className="rounded-[1.5rem] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6">
             <div className="mb-10 flex h-12 w-12 items-center justify-center rounded-2xl bg-[hsl(var(--chart-4)/.12)] text-[hsl(var(--chart-4))]"><BarChart3 size={22} /></div><h3 className="text-lg font-extrabold">{t('achievementStations')}</h3><p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">{language === 'ar' ? 'تُعرض الإنجازات عند توفر سجل إكمال موثوق.' : 'Achievements will appear when verified completion records are available.'}</p>
          </div>
        </div>
      </section>
  );
}
