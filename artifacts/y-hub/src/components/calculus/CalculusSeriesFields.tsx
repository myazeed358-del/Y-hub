import { Input } from '@workspace/y-hub-ds/components/ui/input';
import type { getCalculusCopy } from '@/i18n/calculusCopy';

interface CalculusSeriesFieldsProps {
  copy: ReturnType<typeof getCalculusCopy>;
  expression: string;
  setExpression: (value: string) => void;
}

export function CalculusSeriesFields({
  copy,
  expression,
  setExpression,
}: CalculusSeriesFieldsProps) {
  return (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold">{copy.nthTerm}</label>
                      <Input dir="ltr" placeholder="e.g. 1/n^2 or (-1)^n / n!" value={expression} onChange={e => setExpression(e.target.value)} className="font-mono text-lg py-6" />
                    </div>
                    <p className="text-xs text-muted-foreground">{copy.seriesHint}</p>
                  </div>
  );
}
