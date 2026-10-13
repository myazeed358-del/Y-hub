export function PreviewLine({ title, time }: { title: string; time: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/[0.05] bg-white/[0.025] px-3 py-2">
      <span className="text-[9px] font-bold text-slate-300">{title}</span>
      <span className="font-mono text-[9px] text-slate-600">{time}</span>
    </div>
  );
}
