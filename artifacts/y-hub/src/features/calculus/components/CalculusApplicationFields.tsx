import { Input } from '@workspace/y-hub-ds/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/y-hub-ds/components/ui/select';
import type { getCalculusCopy } from '@/i18n/calculusCopy';

interface CalculusApplicationFieldsProps {
  copy: ReturnType<typeof getCalculusCopy>;
  isArabic: boolean;
  appType: string;
  setAppType: (value: string) => void;
  expression: string;
  setExpression: (value: string) => void;
  expression2: string;
  setExpression2: (value: string) => void;
  lowerBound: string;
  setLowerBound: (value: string) => void;
  upperBound: string;
  setUpperBound: (value: string) => void;
}

export function CalculusApplicationFields({
  copy,
  isArabic,
  appType,
  setAppType,
  expression,
  setExpression,
  expression2,
  setExpression2,
  lowerBound,
  setLowerBound,
  upperBound,
  setUpperBound,
}: CalculusApplicationFieldsProps) {
  return (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold">{copy.geometricApplication}</label>
                      <Select value={appType} onValueChange={setAppType}>
                        <SelectTrigger dir={isArabic ? 'rtl' : 'ltr'}><SelectValue /></SelectTrigger>
                        <SelectContent dir={isArabic ? 'rtl' : 'ltr'}>
                          <SelectItem value="volume">{copy.volume}</SelectItem>
                          <SelectItem value="arclength">{copy.arcLength}</SelectItem>
                          <SelectItem value="area_between">{copy.areaBetween}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold">{copy.mainFunction}</label>
                      <Input dir="ltr" placeholder="e.g. sqrt(x)" value={expression} onChange={e => setExpression(e.target.value)} className="font-mono text-lg py-6" />
                    </div>
                    {appType === 'area_between' && (
                      <div className="space-y-2">
                        <label className="text-sm font-semibold">{copy.secondaryFunction}</label>
                        <Input dir="ltr" placeholder="e.g. x^2" value={expression2} onChange={e => setExpression2(e.target.value)} className="font-mono text-lg py-6" />
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-semibold">{copy.lowerBound}</label>
                        <Input dir="ltr" value={lowerBound} onChange={e => setLowerBound(e.target.value)} className="font-mono" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold">{copy.upperBound}</label>
                        <Input dir="ltr" value={upperBound} onChange={e => setUpperBound(e.target.value)} className="font-mono" />
                      </div>
                    </div>
                  </div>
  );
}
