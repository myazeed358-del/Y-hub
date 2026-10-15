export function PreviewLine({ title, time }: { title: string; time: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-card dark:border-white/[0.05] dark:bg-white/[0.025] px-3 py-2">
      <span className="text-[9px] font-bold text-foreground dark:text-slate-300">{title}</span>
      <span className="font-mono text-[9px] text-slate-500 dark:text-slate-600">{time}</span>
    </div>
  );
}
