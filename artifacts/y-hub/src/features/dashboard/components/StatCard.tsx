import type * as React from 'react';

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  tone: 'cyan' | 'violet' | 'slate';
}) {
  const toneClasses = {
    cyan: {
      wrapper: 'border-cyan-400/10 bg-cyan-400/[0.035]',
      icon: 'border-cyan-400/10 bg-cyan-400/[0.07] text-cyan-300',
    },
    violet: {
      wrapper: 'border-violet-400/10 bg-violet-400/[0.035]',
      icon: 'border-violet-400/10 bg-violet-400/[0.07] text-violet-300',
    },
    slate: {
      wrapper: 'border-slate-800 bg-white/[0.02]',
      icon: 'border-white/[0.05] bg-white/[0.025] text-slate-400',
    },
  }[tone];

  return (
    <div
      className={`rounded-[1.5rem] border p-5 transition-transform duration-200 hover:-translate-y-0.5 ${toneClasses.wrapper}`}
    >
      <div className="flex items-center gap-4">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${toneClasses.icon}`}
        >
          <Icon size={21} />
        </div>

        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-500">
            {title}
          </p>

          <div className="mt-1 text-2xl font-black text-white">
            {value}
          </div>

          <p className="mt-1 truncate text-[10px] text-slate-600">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}
