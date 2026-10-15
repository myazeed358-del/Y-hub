export function CoursePreview({
  code,
  title,
  progress,
}: {
  code: string;
  title: string;
  progress: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card dark:border-white/[0.05] dark:bg-[#0a1423] p-3">
      <div className="mb-4 flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-400/15 to-violet-500/15 font-mono text-[9px] font-black text-cyan-700 dark:text-cyan-300">
        {code}
      </div>

      <p className="text-[10px] font-black text-foreground dark:text-slate-200">{title}</p>

      <div className="mt-3 h-1 overflow-hidden rounded-full bg-slate-200 dark:bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-cyan-400"
          style={{ width: progress }}
        />
      </div>

      <p className="mt-2 text-[8px] text-slate-500 dark:text-slate-600">{progress}</p>
    </div>
  );
}
