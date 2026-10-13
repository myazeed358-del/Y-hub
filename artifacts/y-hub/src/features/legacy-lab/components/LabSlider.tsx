import * as React from 'react';
export function LabSlider({ label, value, min = 0, max = 100, onChange }: { label: string; value: number; min?: number; max?: number; onChange: (value: number) => void }) {
  return <label className="mb-4 block last:mb-0"><div className="mb-2 flex justify-between text-xs font-semibold"><span>{label}</span><span className="font-mono text-[hsl(var(--primary))]">{value}</span></div><input aria-label={label} data-testid={`input-${label}`} type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} className="w-full accent-[hsl(var(--primary))]" /></label>;
}
