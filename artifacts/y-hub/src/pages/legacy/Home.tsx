import * as React from 'react';
import {
  ArrowLeft,
  BarChart3,
  BrainCircuit,
  FlaskConical,
  Info,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import { Link } from 'wouter';
import { courseLessons } from '@/content/course';
import { localizeLesson } from '@/content/localizeLesson';
import { useLanguage } from '@/i18n/LanguageContext';
import {
  SectionKicker,
  ProgressRing,
  MiniCurve,
} from '@/components/legacy/LegacyLearningWidgets';

const lessons = courseLessons;

export default function Home() {
  const { language, t } = useLanguage();
  return (
    <div className="space-y-10">
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

      <section className="grid gap-4 md:grid-cols-[1.3fr_.7fr]">
        <div className="rounded-[1.5rem] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 md:p-7">
           <div className="mb-6 flex items-start justify-between">
             <div><SectionKicker>{t('currentPath')}</SectionKicker><h2 className="text-2xl font-extrabold">{language === 'ar' ? 'أساسيات المجموعات الضبابية' : 'Fuzzy sets foundations'}</h2></div>
             <div className="text-left"><div className="font-mono text-2xl font-bold text-[hsl(var(--primary))]">{language === 'ar' ? '٣٧٪' : '37%'}</div><div className="text-[11px] text-[hsl(var(--muted-foreground))]">{t('done')}</div></div>
          </div>
          <div className="mb-7 h-2 overflow-hidden rounded-full bg-[hsl(var(--muted))]"><div className="h-full w-[37%] rounded-full bg-[hsl(var(--primary))]" /></div>
          <div className="space-y-3">
             {lessons.slice(0, 4).map((lesson) => {
               const localizedLesson = localizeLesson(lesson, language);
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
             <div className="mb-10 flex h-12 w-12 items-center justify-center rounded-2xl bg-[hsl(var(--chart-4)/.12)] text-[hsl(var(--chart-4))]"><BarChart3 size={22} /></div><h3 className="text-lg font-extrabold">{t('achievementStations')}</h3><p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">{t('firstStation')}</p><div className="mt-5 h-1.5 rounded-full bg-[hsl(var(--muted))]"><div className="h-full w-1/4 rounded-full bg-[hsl(var(--chart-4))]" /></div>
          </div>
        </div>
      </section>
    </div>
  );
}
