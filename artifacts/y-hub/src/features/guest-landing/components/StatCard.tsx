import type * as React from 'react';

export function StatCard({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-[#F8FAFC] dark:border-white/[0.07] dark:bg-white/[0.025] p-4">
      <div className="flex items-start justify-between">
        <div className="text-2xl font-black">{value}</div>
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300">
          {icon}
        </div>
      </div>
      <p className="mt-2 text-[9px] text-slate-600 dark:text-slate-500">{label}</p>
    </div>
  );
}
