import * as React from 'react';
import { ArrowLeft, FlaskConical, Sparkles } from 'lucide-react';
import { Link } from 'wouter';
import { MiniCurve } from '@/components/legacy/LegacyLearningWidgets';
import type { LegacyHomeController } from '../hooks/useLegacyHome';

type Props = Pick<LegacyHomeController, 'language' | 't'>;

export function HomeHero({ language, t }: Props) {
  return (
<section className="relative overflow-hidden rounded-[2rem] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-7 shadow-[0_18px_50px_rgba(65,54,33,0.06)] md:p-10">
        <div className="absolute -left-10 -top-20 h-64 w-64 rounded-full bg-[hsl(var(--primary)/.08)] blur-3xl" />
        <div className="absolute -bottom-24 right-1/3 h-52 w-52 rounded-full bg-[hsl(var(--accent)/.12)] blur-3xl" />
        <div className="relative grid gap-10 lg:grid-cols-[1.2fr_.8fr] lg:items-center">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[hsl(var(--primary)/.2)] bg-[hsl(var(--primary)/.07)] px-3 py-1.5 text-xs font-bold text-[hsl(var(--primary))]">
              <Sparkles size={14} />
              {t('currentSession')} · 07
            </div>
            <h1 className="max-w-2xl text-4xl font-extrabold leading-[1.25] tracking-tight md:text-6xl">
              اجعل الغموض
              <br />
              <span className="text-[hsl(var(--primary))]">قابلاً للرسم.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-8 text-[hsl(var(--muted-foreground))] md:text-lg">
              {language === 'ar' ? 'أهلاً سارة. اليوم سنحوّل مفهوم درجة العضوية من رمز على الورق إلى منحنى تراه وتلمسه وتفهمه.' : 'Today we will turn membership grade from a symbol on paper into a curve you can see, touch, and understand.'}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/lesson/membership-grade"
                data-testid="link-continue-learning"
                className="group inline-flex items-center gap-3 rounded-2xl bg-[hsl(var(--primary))] px-5 py-3.5 text-sm font-bold text-[hsl(var(--primary-foreground))] shadow-[0_10px_22px_rgba(27,145,119,0.22)] transition-transform hover:-translate-y-0.5"
              >
                {t('continueLesson')}
                <ArrowLeft size={17} className="transition-transform group-hover:-translate-x-1" />
              </Link>
              <Link href="/lab" data-testid="link-open-lab" className="inline-flex items-center gap-2 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--background)/.7)] px-5 py-3.5 text-sm font-bold hover:border-[hsl(var(--primary)/.35)] hover:bg-[hsl(var(--primary)/.05)]">
                <FlaskConical size={17} />
                {t('openLab')}
              </Link>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-[390px]">
            <div className="absolute inset-5 rounded-full bg-[hsl(var(--primary)/.09)] blur-2xl" />
            <div className="relative rounded-[2rem] border border-[hsl(var(--border))] bg-[hsl(var(--background)/.72)] p-5">
              <div className="mb-5 flex items-center justify-between">
                <span className="font-mono text-xs text-[hsl(var(--muted-foreground))]">μ(temperature)</span>
                 <span className="rounded-lg bg-[hsl(var(--accent)/.24)] px-2 py-1 font-mono text-[10px] text-[hsl(var(--accent-foreground))]">{t('live')}</span>
              </div>
              <div className="h-44">
                <MiniCurve type="gaussian" />
              </div>
              <div className="mt-2 flex justify-between font-mono text-[10px] text-[hsl(var(--muted-foreground))]">
                <span>0°</span><span>١٨°</span><span>٢٢°</span><span>٣٠°</span><span>٤٠°</span>
              </div>
              <div className="mt-5 flex items-end justify-between border-t border-[hsl(var(--border))] pt-4">
                <div><div className="text-xs text-[hsl(var(--muted-foreground))]">قيمة عند ٢٢°</div><div className="font-mono text-2xl font-bold text-[hsl(var(--primary))]">٠.٨٦</div></div>
                <div className="text-left text-xs leading-5 text-[hsl(var(--muted-foreground))]">الجو<br /><strong className="text-[hsl(var(--foreground))]">دافئ</strong></div>
              </div>
            </div>
          </div>
        </div>
      </section>
  );
}
