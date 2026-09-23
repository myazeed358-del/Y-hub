import type { ReactNode } from 'react';

import { cn } from '../../lib/utils';

export function LearningKicker({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        'text-[0.68rem] font-bold uppercase tracking-[0.18em] text-primary',
        className,
      )}
    >
      {children}
    </p>
  );
}