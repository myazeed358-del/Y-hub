import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@workspace/y-hub-ds/components/ui/tooltip';
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BrainCircuit,
  Check,
  CheckCircle2,
  FlaskConical,
  Info,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { Link, useLocation, useParams, Router as WouterRouter } from 'wouter';
import { Button } from '@workspace/y-hub-ds/components/ui/button';
import { courseLessons, type CourseLesson } from '@/content/course';
import { localizeLesson } from '@/content/localizeLesson';
import {
  membershipValue,
  sampleMembershipCurve,
  type MembershipFunctionType,
} from '@/utils/fuzzyLogic';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { uiCopy, type Language, type UiKey } from '@/i18n/uiCopy';
import { LanguageContext, useLanguage } from '@/i18n/LanguageContext';
import { AppShell } from '@/components/layout/AppShell';
import { AppRoutes } from '@/routing/AppRoutes';

const queryClient = new QueryClient();
const lessons = courseLessons;

function SectionKicker({ children }: { children: ReactNode }) {
  return <div className="mb-3 text-xs font-bold tracking-[0.18em] text-[hsl(var(--primary))]">{children}</div>;
}

function ProgressRing({ value }: { value: number }) {
  const radius = 23;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference - (value / 100) * circumference;
  return (
    <div className="relative h-16 w-16 shrink-0">
      <svg viewBox="0 0 58 58" className="h-full w-full -rotate-90">
        <circle cx="29" cy="29" r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth="5" />
        <circle cx="29" cy="29" r={radius} fill="none" stroke="hsl(var(--primary))" strokeWidth="5" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={dash} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-mono text-[11px] font-bold">{value}٪</span>
    </div>
  );
}

function MiniCurve({ tone = 'teal', type = 'triangle' }: { tone?: 'teal' | 'amber' | 'coral'; type?: 'triangle' | 'gaussian' | 'trapezoid' }) {
  const color = tone === 'amber' ? 'hsl(var(--accent))' : tone === 'coral' ? 'hsl(var(--chart-4))' : 'hsl(var(--primary))';
  const paths = {
    triangle: 'M 8 100 L 48 100 L 108 22 L 168 100 L 208 100',
    trapezoid: 'M 8 100 L 34 100 L 74 25 L 140 25 L 180 100 L 208 100',
    gaussian: 'M 8 100 C 45 99, 52 93, 73 66 C 92 41, 108 18, 128 18 C 148 18, 164 41, 183 66 C 204 93, 211 99, 248 100',
  };
  return (
    <svg viewBox="0 0 216 112" className="h-full w-full overflow-visible" aria-hidden="true">
      <path d="M 8 100 H 208" stroke="hsl(var(--border))" strokeWidth="1.5" />
      <path d="M 8 100 V 10" stroke="hsl(var(--border))" strokeWidth="1.5" />
      <path d={paths[type]} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d={`${paths[type]} L 208 100 L 8 100`} fill={color} opacity=".08" />
    </svg>
  );
}

function Home() {
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

function CoursePlan() {
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

function DeepSectionCard({ section, index }: { section: CourseLesson['sections'][number]; index: number }) {
  return (
    <section className="rounded-[1.75rem] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-7 md:p-9">
      <div className="mb-5 flex items-start gap-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--primary)/.1)] font-mono text-xs font-bold text-[hsl(var(--primary))]">{String(index + 1).padStart(2, '٠')}</div>
        <h2 className="pt-1 text-xl font-extrabold leading-8">{section.title}</h2>
      </div>
      <div className="space-y-4 text-sm leading-8 text-[hsl(var(--muted-foreground))]">
        {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
      </div>
      {section.formula && (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-[hsl(var(--primary)/.2)] bg-[hsl(var(--primary)/.06)] p-5 text-center font-mono text-sm leading-8 text-[hsl(var(--primary))]" dir="ltr">
          {section.formula}
        </div>
      )}
      {section.bullets && (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {section.bullets.map((bullet) => (
            <li key={bullet} className="flex gap-3 rounded-xl bg-[hsl(var(--background)/.7)] p-3 text-sm leading-7 text-[hsl(var(--muted-foreground))]">
              <span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-[hsl(var(--accent))]" />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      )}
      {section.example && (
        <div className="mt-7 rounded-2xl border border-[hsl(var(--accent)/.3)] bg-[hsl(var(--accent)/.08)] p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-extrabold text-[hsl(var(--accent-foreground))]">
            <Sparkles size={15} />
            {section.example.title}
          </div>
          <ol className="space-y-2 text-sm leading-7 text-[hsl(var(--foreground))]">
            {section.example.steps.map((step, stepIndex) => <li key={step} className="flex gap-3"><span className="font-mono text-xs text-[hsl(var(--accent-foreground)/.75)]">{stepIndex + 1}.</span><span>{step}</span></li>)}
          </ol>
          <div className="mt-4 border-t border-[hsl(var(--accent)/.2)] pt-4 text-sm font-bold leading-7 text-[hsl(var(--accent-foreground))]">{section.example.result}</div>
        </div>
      )}
    </section>
  );
}

function LessonPage() {
  const { slug } = useParams<{ slug: string }>();
  const { language, t } = useLanguage();
  const baseLesson = lessons.find((item) => item.slug === slug);
  if (!baseLesson) return <NotFound />;
  const lesson = localizeLesson(baseLesson, language);
  const index = lessons.findIndex((item) => item.slug === slug);
  const next = lessons[index + 1];
  return (
    <div className="mx-auto max-w-5xl">
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

      <div className="grid gap-6 lg:grid-cols-[1fr_270px]">
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
             {index > 0 ? <Link href={`/lesson/${lessons[index - 1].slug}`} data-testid="link-previous-lesson" className="inline-flex items-center gap-2 rounded-xl px-2 py-2 text-sm font-bold text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))]"><ArrowRight size={16} /> {t('previous')}</Link> : <span />}
             {next ? <Link href={`/lesson/${next.slug}`} data-testid="link-next-lesson" className="inline-flex items-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 py-3 text-sm font-bold text-[hsl(var(--primary-foreground))]">{t('nextLesson')} <ArrowLeft size={16} /></Link> : <Link href="/quiz" data-testid="link-finish-to-quiz" className="inline-flex items-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 py-3 text-sm font-bold text-[hsl(var(--primary-foreground))]">{t('testUnderstanding')} <ArrowLeft size={16} /></Link>}
          </div>
        </article>
        <aside className="hidden lg:block">
          <div className="sticky top-28 rounded-[1.5rem] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
            <div className="mb-4 text-xs font-bold text-[hsl(var(--muted-foreground))]">{language === 'ar' ? 'في هذا المسار' : 'In this path'}</div>
            <div className="space-y-1">{lessons.map((item, itemIndex) => { const localizedItem = localizeLesson(item, language); return <Link key={item.slug} href={`/lesson/${item.slug}`} data-testid={`link-lesson-index-${itemIndex + 1}`} className={`flex items-center gap-2 rounded-xl px-2.5 py-2.5 text-xs transition-colors ${item.slug === slug ? 'bg-[hsl(var(--primary)/.1)] font-bold text-[hsl(var(--primary))]' : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted)/.55)]'}`}><span className="w-6 font-mono text-[10px]">{item.number}</span><span className="truncate">{localizedItem.title}</span>{item.progress === 100 && <Check size={13} className="mr-auto" />}</Link>; })}</div>
          </div>
        </aside>
      </div>
    </div>
  );
}

type FunctionType = MembershipFunctionType;

const labCopy = {
  ar: {
    kicker: 'مختبر تفاعلي',
    title: 'شكّل دالتك بيدك',
    description: 'اختر نموذجاً، حرّك المعلمات، وراقب كيف تتغير درجة العضوية لحظياً.',
    trial: 'التجربة رقم ٠١',
    curve: 'منحنى العضوية',
    axis: 'المحور الأفقي: قيمة المتغير · العمودي: μ(x)',
    at: 'عند x',
    note: 'ملاحظة المختبر',
    membershipIs: 'تكون العضوية',
    meaning: 'أي أن القيمة تنتمي إلى مفهوم',
    degree: 'بهذه الدرجة.',
    functionType: 'نوع الدالة',
    parameters: 'المعلمات',
    reset: 'إعادة الضبط',
    center: 'المركز c',
    spread: 'الانتشار σ',
    start: 'بداية a',
    peak: 'القمة b',
    end: 'نهاية c',
    final: 'النهاية d',
    testValue: 'القيمة المراد اختبارها x',
    triangle: 'مثلثية',
    trapezoid: 'شبه منحرفة',
    gaussian: 'غاوسية',
  },
  en: {
    kicker: 'Interactive lab',
    title: 'Shape your function',
    description: 'Choose a model, move its parameters, and watch membership change in real time.',
    trial: 'Experiment 01',
    curve: 'Membership curve',
    axis: 'Horizontal: variable value · vertical: μ(x)',
    at: 'At x',
    note: 'Lab note',
    membershipIs: 'membership is',
    meaning: 'That means the value belongs to the concept',
    degree: 'at this degree.',
    functionType: 'Function type',
    parameters: 'Parameters',
    reset: 'Reset',
    center: 'Center c',
    spread: 'Spread σ',
    start: 'Start a',
    peak: 'Peak b',
    end: 'End c',
    final: 'Final d',
    testValue: 'Value to test x',
    triangle: 'Triangular',
    trapezoid: 'Trapezoidal',
    gaussian: 'Gaussian',
  },
} as const;

function Lab() {
  const { language } = useLanguage();
  const copy = labCopy[language];
  const isArabic = language === 'ar';
  const axisLabels = isArabic
    ? { zero: '٠', fifty: '٥٠', hundred: '١٠٠', one: '١' }
    : { zero: '0', fifty: '50', hundred: '100', one: '1' };
  const [functionType, setFunctionType] = useState<FunctionType>('triangle');
  const [params, setParams] = useState({ a: 20, b: 45, c: 72, d: 88, center: 55, spread: 16, x: 58 });
  const update = (key: keyof typeof params, value: number) => setParams((current) => ({ ...current, [key]: value }));
  const membership = useMemo(() => membershipValue(functionType, params.x, params), [functionType, params]);
  const curvePath = useMemo(() => {
    const points = sampleMembershipCurve(functionType, params).map(({ x, y }, index) =>
      `${index === 0 ? 'M' : 'L'} ${x * 3.9 + 10} ${194 - y * 160}`,
    );
    return points.join(' ');
  }, [functionType, params]);
  const functionNames: Record<FunctionType, string> = {
    triangle: copy.triangle,
    trapezoid: copy.trapezoid,
    gaussian: copy.gaussian,
  };
  return (
    <div className="mx-auto max-w-6xl" dir={isArabic ? 'rtl' : 'ltr'}>
      <div className="mb-9 flex flex-wrap items-end justify-between gap-5"><div><SectionKicker>{copy.kicker}</SectionKicker><h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">{copy.title}</h1><p className="mt-3 max-w-xl text-sm leading-7 text-[hsl(var(--muted-foreground))]">{copy.description}</p></div><div className="flex items-center gap-2 rounded-xl bg-[hsl(var(--primary)/.1)] px-3 py-2 text-xs font-bold text-[hsl(var(--primary))]"><FlaskConical size={16} /> {copy.trial}</div></div>
      <div className="grid gap-6 lg:grid-cols-[1fr_330px]">
        <div className="order-2 rounded-[1.75rem] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 md:p-8 lg:order-1">
           <div className="mb-6 flex items-center justify-between"><div><h2 className="text-lg font-extrabold">{copy.curve}</h2><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{copy.axis}</p></div><div className="rounded-xl bg-[hsl(var(--accent)/.2)] px-3 py-2 text-center"><div className="font-mono text-2xl font-bold text-[hsl(var(--accent-foreground))]">{membership.toFixed(2)}</div><div className="text-[10px] text-[hsl(var(--accent-foreground)/.7)]">{copy.at} = {params.x}</div></div></div>
          <div className="relative h-[300px] overflow-hidden rounded-2xl bg-[hsl(var(--background))] p-3 md:h-[360px]">
            <svg viewBox="0 0 410 220" className="h-full w-full overflow-visible">
              <defs><pattern id="grid" width="39" height="32" patternUnits="userSpaceOnUse"><path d="M 39 0 L 0 0 0 32" fill="none" stroke="hsl(var(--border))" strokeWidth=".8" /></pattern></defs>
              <rect x="10" y="10" width="390" height="184" fill="url(#grid)" rx="8" />
              <path d="M 10 194 H 400 M 10 194 V 10" stroke="hsl(var(--muted-foreground))" strokeWidth="1.5" />
              <path d={curvePath} fill="none" stroke="hsl(var(--primary))" strokeWidth="4" strokeLinecap="round" />
              <path d={`M ${params.x * 3.9 + 10} 194 V ${194 - membership * 160}`} stroke="hsl(var(--accent))" strokeWidth="1.5" strokeDasharray="5 5" />
              <circle cx={params.x * 3.9 + 10} cy={194 - membership * 160} r="6" fill="hsl(var(--accent))" stroke="hsl(var(--card))" strokeWidth="3" />
              <text x="10" y="211" fill="hsl(var(--muted-foreground))" fontSize="9">{axisLabels.zero}</text><text x="200" y="211" fill="hsl(var(--muted-foreground))" fontSize="9">{axisLabels.fifty}</text><text x="390" y="211" fill="hsl(var(--muted-foreground))" fontSize="9">{axisLabels.hundred}</text>
              <text x="2" y="17" fill="hsl(var(--muted-foreground))" fontSize="9">{axisLabels.one}</text><text x="2" y="198" fill="hsl(var(--muted-foreground))" fontSize="9">{axisLabels.zero}</text>
            </svg>
          </div>
           <div className="mt-6 rounded-2xl border border-dashed border-[hsl(var(--primary)/.3)] bg-[hsl(var(--primary)/.05)] p-4 text-sm leading-7"><span className="font-bold text-[hsl(var(--primary))]">{copy.note}: </span>{copy.at} = {params.x} {copy.membershipIs} <span className="font-mono font-bold">{membership.toFixed(2)}</span>{isArabic ? '؛' : ';'} {copy.meaning} «{functionNames[functionType]}» {copy.degree}</div>
        </div>
        <div className="order-1 space-y-4 lg:order-2">
          <div className="rounded-[1.75rem] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
             <div className="mb-4 flex items-center gap-2"><SlidersHorizontal size={17} className="text-[hsl(var(--primary))]" /><h2 className="font-extrabold">{copy.functionType}</h2></div>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(functionNames) as FunctionType[]).map((type) => <button key={type} onClick={() => setFunctionType(type)} data-testid={`button-function-${type}`} className={`rounded-xl border px-2 py-3 text-xs font-bold transition-all ${functionType === type ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/.1)] text-[hsl(var(--primary))]' : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary)/.3)]'}`}><div className="mb-2 h-8"><MiniCurve tone={type === 'gaussian' ? 'coral' : type === 'trapezoid' ? 'amber' : 'teal'} type={type} /></div>{functionNames[type]}</button>)}
            </div>
          </div>
           <div className="rounded-[1.75rem] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
             <div className="mb-5 flex items-center justify-between"><h2 className="font-extrabold">{copy.parameters}</h2><button onClick={() => setParams({ a: 20, b: 45, c: 72, d: 88, center: 55, spread: 16, x: 58 })} data-testid="button-reset-lab" className="inline-flex items-center gap-1.5 text-xs font-bold text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))]"><RotateCcw size={13} /> {copy.reset}</button></div>
             {functionType === 'gaussian' ? <><LabSlider label={copy.center} value={params.center} onChange={(value) => update('center', value)} /><LabSlider label={copy.spread} value={params.spread} min={5} max={30} onChange={(value) => update('spread', value)} /></> : <><LabSlider label={copy.start} value={params.a} max={Math.max(25, params.b - 5)} onChange={(value) => update('a', value)} /><LabSlider label={copy.peak} value={params.b} min={params.a + 5} max={Math.min(85, params.c - 5)} onChange={(value) => update('b', value)} /><LabSlider label={copy.end} value={params.c} min={params.b + 5} max={functionType === 'trapezoid' ? params.d - 5 : 98} onChange={(value) => update('c', value)} />{functionType === 'trapezoid' && <LabSlider label={copy.final} value={params.d} min={params.c + 5} max={100} onChange={(value) => update('d', value)} />}</>}
             <div className="mt-4 border-t border-[hsl(var(--border))] pt-4"><LabSlider label={copy.testValue} value={params.x} onChange={(value) => update('x', value)} /></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LabSlider({ label, value, min = 0, max = 100, onChange }: { label: string; value: number; min?: number; max?: number; onChange: (value: number) => void }) {
  return <label className="mb-4 block last:mb-0"><div className="mb-2 flex justify-between text-xs font-semibold"><span>{label}</span><span className="font-mono text-[hsl(var(--primary))]">{value}</span></div><input aria-label={label} data-testid={`input-${label}`} type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} className="w-full accent-[hsl(var(--primary))]" /></label>;
}

const questions = [
  { question: 'ما المجال الصحيح لدرجة العضوية μ(x)؟', options: ['من −١ إلى ١', 'من ٠ إلى ١', 'أكبر من ١ فقط', 'قيمتان فقط: ٠ أو ١'], answer: 1, explanation: 'درجة العضوية قيمة حقيقية بين ٠ و١، وهذا ما يسمح بالانتماء الجزئي.' },
  { question: 'أي عملية تستخدم min لدرجات العضوية؟', options: ['الاتحاد', 'المتممة', 'التقاطع', 'القطع عند α'], answer: 2, explanation: 'التقاطع الضبابي يأخذ الدرجة الأصغر: μA∩B(x) = min(μA(x), μB(x)).' },
  { question: 'إذا كانت μA(x)=٠.٣، فما μAᶜ(x)؟', options: ['٠.٣', '٠.٧', '١.٣', '٠'], answer: 1, explanation: 'المتممة تحسب بطرح الدرجة من ١: 1 − 0.3 = 0.7.' },
  { question: 'ما القيمة اللغوية للمتغير «السرعة»؟', options: ['سريعة', 'كيلومتر', 'x = ٨٠', 'دالة مثلثية'], answer: 0, explanation: 'القيمة اللغوية وصف مثل «سريعة» يمثل مجموعة ضبابية ضمن المتغير.' },
  { question: 'ماذا يحدث للقطع عند α عندما نرفع قيمة α؟', options: ['تتسع المجموعة', 'تضيق المجموعة', 'لا تتغير أبداً', 'تصبح كل الدرجات صفراً'], answer: 1, explanation: 'رفع العتبة يعني الاحتفاظ بعناصر أقل، لذلك تضيق مجموعة القطع.' },
  { question: 'أي دالة انتقالها الأكثر نعومة؟', options: ['المثلثية', 'شبه المنحرفة', 'الغاوسية', 'دالة المؤشر'], answer: 2, explanation: 'الدالة الغاوسية تعطي منحنى ناعماً بلا زوايا حادة عند الانتقال.' },
];

function Quiz() {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState<Record<number, boolean>>({});
  const [finished, setFinished] = useState(false);
  const score = questions.reduce((total, question, index) => total + (answers[index] === question.answer ? 1 : 0), 0);
  const answerQuestion = (questionIndex: number, optionIndex: number) => {
    if (submitted[questionIndex]) return;
    setAnswers((current) => ({ ...current, [questionIndex]: optionIndex }));
    setSubmitted((current) => ({ ...current, [questionIndex]: true }));
  };
  const reset = () => { setAnswers({}); setSubmitted({}); setFinished(false); };
  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-9 flex flex-wrap items-end justify-between gap-5"><div><SectionKicker>مساحة التمرين</SectionKicker><h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">اختبر بوصلتك</h1><p className="mt-3 max-w-xl text-sm leading-7 text-[hsl(var(--muted-foreground))]">أجب، ثم اقرأ سبب الإجابة. الهدف هنا ليس الدرجة، بل أن تعرف أين يحتاج فهمك إلى سؤال آخر.</p></div><div className="flex items-center gap-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3"><div className="font-mono text-xl font-bold text-[hsl(var(--primary))]">{score}</div><div className="text-xs text-[hsl(var(--muted-foreground))]">من {questions.length}</div></div></div>
      {finished && <div className="mb-6 flex items-center justify-between rounded-2xl border border-[hsl(var(--primary)/.25)] bg-[hsl(var(--primary)/.08)] p-5"><div><div className="font-bold">اكتملت الجولة</div><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">نتيجتك {score} من {questions.length}. عد إلى أي سؤال لتقرأ منطقه بهدوء.</p></div><button onClick={reset} data-testid="button-reset-quiz" className="inline-flex items-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-3 py-2 text-xs font-bold text-[hsl(var(--primary-foreground))]"><RotateCcw size={14} /> إعادة الجولة</button></div>}
      <div className="space-y-4">
        {questions.map((question, index) => {
          const answered = submitted[index];
          return <div key={question.question} className={`rounded-[1.5rem] border bg-[hsl(var(--card))] p-5 md:p-7 ${answered ? 'border-[hsl(var(--border))]' : 'border-[hsl(var(--border))]'}`}>
            <div className="mb-5 flex gap-4"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--sidebar))] font-mono text-xs text-[hsl(var(--accent))]">{String(index + 1).padStart(2, '٠')}</div><h2 className="pt-1 text-base font-bold leading-7">{question.question}</h2></div>
            <div className="grid gap-2 sm:grid-cols-2">{question.options.map((option, optionIndex) => { const isCorrect = optionIndex === question.answer; const isChosen = answers[index] === optionIndex; return <button key={option} onClick={() => answerQuestion(index, optionIndex)} data-testid={`button-answer-${index}-${optionIndex}`} className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-right text-sm transition-all ${answered && isCorrect ? 'border-[hsl(var(--primary)/.55)] bg-[hsl(var(--primary)/.1)] text-[hsl(var(--primary))]' : answered && isChosen ? 'border-[hsl(var(--destructive)/.45)] bg-[hsl(var(--destructive)/.07)] text-[hsl(var(--destructive))]' : 'border-[hsl(var(--border))] hover:border-[hsl(var(--primary)/.35)] hover:bg-[hsl(var(--primary)/.04)]'}`}><span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg font-mono text-[10px] ${answered && isCorrect ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'bg-[hsl(var(--muted))]'}`}>{String.fromCharCode(1575 + optionIndex)}</span><span className="flex-1">{option}</span>{answered && isCorrect && <CheckCircle2 size={16} />}{answered && isChosen && !isCorrect && <XCircle size={16} />}</button>; })}</div>
            {answered && <div className={`mt-4 flex gap-2 rounded-xl p-3 text-xs leading-6 ${answers[index] === question.answer ? 'bg-[hsl(var(--primary)/.07)] text-[hsl(var(--primary))]' : 'bg-[hsl(var(--destructive)/.07)] text-[hsl(var(--destructive))]'}`}><Info size={15} className="mt-1 shrink-0" /><span>{question.explanation}</span></div>}
          </div>;
        })}
      </div>
      {Object.keys(submitted).length === questions.length && !finished && <button onClick={() => setFinished(true)} data-testid="button-finish-quiz" className="mt-7 inline-flex items-center gap-2 rounded-2xl bg-[hsl(var(--primary))] px-5 py-3.5 text-sm font-bold text-[hsl(var(--primary-foreground))]">إنهاء الجولة <ArrowLeft size={16} /></button>}
    </div>
  );
}

function NotFound() {
  return <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center text-center"><div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[hsl(var(--muted))] font-mono text-xl">404</div><h1 className="text-3xl font-extrabold">هذه الصفحة خارج المسار</h1><p className="mt-3 text-sm leading-7 text-[hsl(var(--muted-foreground))]">يبدو أن هذه النقطة لم تُرسم بعد. عد إلى مكتبك لنكمل من حيث توقفنا.</p><Link href="/" data-testid="link-not-found-home" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-5 py-3 text-sm font-bold text-[hsl(var(--primary-foreground))]">العودة إلى المكتب <ArrowRight size={16} /></Link></div>;
}





function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function ApplicationFrame() {
  const { user, loading } = useAuth();
  const [location] = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[hsl(var(--background))]">
        <div className="text-sm font-semibold text-[hsl(var(--muted-foreground))] animate-pulse">
          جاري تحميل Y HUB...
        </div>
      </div>
    );
  }

  const routes = (
    <RoutedErrorBoundary>
      <AppRoutes
        Home={Home}
        CoursePlan={CoursePlan}
        LessonPage={LessonPage}
        Lab={Lab}
        Quiz={Quiz}
        NotFound={NotFound}
      />
    </RoutedErrorBoundary>
  );

  const isAuthRoute =
    location.startsWith('/login') ||
    location.startsWith('/reset-password');

  if (!user || isAuthRoute) {
    return routes;
  }

  return <AppShell>{routes}</AppShell>;
}

import { ThemeProvider } from 'next-themes';

function App() {
  const [language, setLanguage] = useState<Language>(() => {
    if (typeof window === 'undefined') return 'ar';
    const storedLanguage =
      window.localStorage.getItem('yhub-language') ??
      window.localStorage.getItem('fuzzy-academy-language');

    return storedLanguage === 'en' ? 'en' : 'ar';
  });

  useEffect(() => {
    window.localStorage.setItem('yhub-language', language);
    window.localStorage.removeItem('fuzzy-academy-language');
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  }, [language]);

  const t = (key: UiKey) => uiCopy[language][key];

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthProvider>
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
          <QueryClientProvider client={queryClient}>
            <TooltipProvider>
              <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
                <ApplicationFrame />
              </WouterRouter>
              <Toaster position="top-center" dir="rtl" richColors />
            </TooltipProvider>
          </QueryClientProvider>
        </LanguageContext.Provider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;

