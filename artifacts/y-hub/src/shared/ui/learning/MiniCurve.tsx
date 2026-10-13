import * as React from 'react';

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
