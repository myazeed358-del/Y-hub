import * as React from 'react';
import { Sparkles } from 'lucide-react';
import type { CourseLesson } from '@/content/course';

export function DeepSectionCard({ section, index }: { section: CourseLesson['sections'][number]; index: number }) {
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
