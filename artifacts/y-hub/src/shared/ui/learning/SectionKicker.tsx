import * as React from 'react';
import type { ReactNode } from 'react';

export function SectionKicker({ children }: { children: ReactNode }) {
  return <div className="mb-3 text-xs font-bold tracking-[0.18em] text-[hsl(var(--primary))]">{children}</div>;
}
