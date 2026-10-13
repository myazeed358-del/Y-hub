import * as React from 'react';

export function ProgressRing({ value }: { value: number }) {
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
