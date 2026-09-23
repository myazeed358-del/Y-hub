import type { ReactNode } from 'react';

import { cn } from '../../lib/utils';

export function LearningSidebar({
  title,
  subtitle,
  items,
  footer,
  className,
}: {
  title: string;
  subtitle: string;
  items: Array<{ label: string; active?: boolean; icon?: ReactNode }>;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <aside className={cn('flex min-h-[420px] w-full max-w-[250px] flex-col rounded-3xl bg-sidebar p-5 text-sidebar-foreground', className)}>
      <div className="mb-9 flex items-center gap-3 px-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary font-bold text-primary-foreground">μ</div>
        <div>
          <p className="font-bold">{title}</p>
          <p className="text-xs text-sidebar-foreground/60">{subtitle}</p>
        </div>
      </div>
      <nav className="space-y-1.5" aria-label={title}>
        {items.map((item) => (
          <div key={item.label} className={cn('flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-semibold text-sidebar-foreground/65', item.active && 'bg-sidebar-accent text-sidebar-foreground shadow-[inset_3px_0_0_hsl(var(--sidebar-primary))]')}>
            {item.icon}
            <span>{item.label}</span>
          </div>
        ))}
      </nav>
      {footer ? <div className="mt-auto pt-8">{footer}</div> : null}
    </aside>
  );
}