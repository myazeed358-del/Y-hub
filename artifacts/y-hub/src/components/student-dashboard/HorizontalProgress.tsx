export function HorizontalProgress({ progress, label, valueText }: any) {
  return (
    <div className="w-full" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className="flex justify-between items-end mb-2">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <span className="text-xs font-bold text-primary">{valueText}</span>
      </div>
      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full transition-all duration-1000 ease-out" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
