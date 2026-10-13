import * as React from 'react';
import { FlaskConical } from 'lucide-react';
import {
  SectionKicker,
} from '@/components/legacy/LegacyLearningWidgets';

import type {
  LegacyLabController,
} from '../hooks/useLegacyLab';

export function LabHeader({
  copy,
}: Pick<LegacyLabController, 'copy'>) {
  return (
<div className="mb-9 flex flex-wrap items-end justify-between gap-5"><div><SectionKicker>{copy.kicker}</SectionKicker><h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">{copy.title}</h1><p className="mt-3 max-w-xl text-sm leading-7 text-[hsl(var(--muted-foreground))]">{copy.description}</p></div><div className="flex items-center gap-2 rounded-xl bg-[hsl(var(--primary)/.1)] px-3 py-2 text-xs font-bold text-[hsl(var(--primary))]"><FlaskConical size={16} /> {copy.trial}</div></div>
  );
}
