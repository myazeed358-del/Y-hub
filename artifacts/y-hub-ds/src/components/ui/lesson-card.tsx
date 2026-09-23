import type { ReactNode } from 'react';

import { cn } from '../../lib/utils';
import { ProgressRing } from './progress-ring';

export function LessonCard({
  number,
  title,
  subtitle,
  progress = 0,
  meta,
  children,
  className,
}: {
  number: string | number;
  title: string;
  subtitle: string;
  progress?: number;
  meta?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <article className={cn('flex items-center gap-4 rounded-2xl border border-border bg-card p-4 text-card-foreground transition-colors hover:border-primary/35', className)}>
      <ProgressRing value={progress} />
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <span className="font-mono text-[0.65rem] text-muted-foreground">{number}</span>
          <h3 className="truncate text-sm font-bold">{title}</h3>
        </div>
        <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        {meta ? <div className="mt-2 text-xs text-muted-foreground">{meta}</div> : null}
        {children}
      </div>
    </article>
  );
}