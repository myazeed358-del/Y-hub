import type * as React from 'react';

export function ReadOnlyField({
  icon,
  label,
  value,
  badge,
  ltr = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  badge: string;
  ltr?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.18)] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-bold">
          <span className="text-[hsl(var(--primary))]">{icon}</span>
          {label}
        </div>

        <span className="rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--background)/.5)] px-2.5 py-1 text-[10px] font-bold text-[hsl(var(--muted-foreground))]">
          {badge}
        </span>
      </div>

      <p
        dir={ltr ? 'ltr' : undefined}
        className={`truncate text-sm font-semibold ${
          ltr ? 'text-left' : ''
        }`}
      >
        {value}
      </p>
    </div>
  );
}
