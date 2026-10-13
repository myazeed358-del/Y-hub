import * as React from 'react';
import type { ReactNode } from 'react';

export function SectionKicker({ children }: { children: ReactNode }) {
  return <div className="mb-3 text-xs font-bold tracking-[0.18em] text-[hsl(var(--primary))]">{children}</div>;
}

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

export function MiniCurve({ tone = 'teal', type = 'triangle' }: { tone?: 'teal' | 'amber' | 'coral'; type?: 'triangle' | 'gaussian' | 'trapezoid' }) {
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
