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
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
      <div className="flex items-start justify-between">
        <div className="text-2xl font-black">{value}</div>
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/10 text-violet-300">
          {icon}
        </div>
      </div>
      <p className="mt-2 text-[9px] text-slate-500">{label}</p>
    </div>
  );
}
