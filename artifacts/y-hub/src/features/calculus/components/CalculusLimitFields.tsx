import { Input } from '@workspace/y-hub-ds/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/y-hub-ds/components/ui/select';
import type { getCalculusCopy } from '@/i18n/calculusCopy';

interface CalculusLimitFieldsProps {
  copy: ReturnType<typeof getCalculusCopy>;
  isArabic: boolean;
  expression: string;
  setExpression: (value: string) => void;
  limitPoint: string;
  setLimitPoint: (value: string) => void;
  limitDirection: string;
  setLimitDirection: (value: string) => void;
}

export function CalculusLimitFields({
  copy,
  isArabic,
  expression,
  setExpression,
  limitPoint,
  setLimitPoint,
  limitDirection,
  setLimitDirection,
}: CalculusLimitFieldsProps) {
  return (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold">{copy.enterFunction}</label>
                      <Input dir="ltr" placeholder="e.g. sin(x)/x or (1+1/x)^x" value={expression} onChange={e => setExpression(e.target.value)} className="font-mono text-lg py-6" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-semibold">{copy.approaches}</label>
                        <Input dir="ltr" placeholder="0, inf, -inf, pi" value={limitPoint} onChange={e => setLimitPoint(e.target.value)} className="font-mono" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold">{copy.direction}</label>
                        <Select value={limitDirection} onValueChange={setLimitDirection}>
                          <SelectTrigger dir={isArabic ? 'rtl' : 'ltr'}><SelectValue /></SelectTrigger>
                          <SelectContent dir={isArabic ? 'rtl' : 'ltr'}>
                            <SelectItem value="both">{copy.bothSides}</SelectItem>
                            <SelectItem value="right">{copy.fromRight}</SelectItem>
                            <SelectItem value="left">{copy.fromLeft}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
  );
}
