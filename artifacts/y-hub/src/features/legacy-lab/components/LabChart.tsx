import * as React from 'react';

import type {
  LegacyLabController,
} from '../hooks/useLegacyLab';

type Props = Pick<
  LegacyLabController,
  | 'copy'
  | 'membership'
  | 'params'
  | 'curvePath'
  | 'axisLabels'
  | 'isArabic'
  | 'functionNames'
  | 'functionType'
>;

export function LabChart({
  copy,
  membership,
  params,
  curvePath,
  axisLabels,
  isArabic,
  functionNames,
  functionType,
}: Props) {
  return (
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
  );
}
