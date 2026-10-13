import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { Link, useParams } from 'wouter';
import { courseLessons, type CourseLesson } from '@/content/course';
import { localizeLesson } from '@/content/localizeLesson';
import { useLanguage } from '@/i18n/LanguageContext';
import { SectionKicker } from '@/components/legacy/LegacyLearningWidgets';
import NotFound from '@/pages/legacy/NotFound';

const lessons = courseLessons;

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

export default function LessonPage() {
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
