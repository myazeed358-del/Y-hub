import { Input } from '@workspace/y-hub-ds/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/y-hub-ds/components/ui/select';
import type { getCalculusCopy } from '@/i18n/calculusCopy';

interface CalculusIntegralFieldsProps {
  copy: ReturnType<typeof getCalculusCopy>;
  isArabic: boolean;
  expression: string;
  setExpression: (value: string) => void;
  integralType: string;
  setIntegralType: (value: string) => void;
  lowerBound: string;
  setLowerBound: (value: string) => void;
  upperBound: string;
  setUpperBound: (value: string) => void;
}

export function CalculusIntegralFields({
  copy,
  isArabic,
  expression,
  setExpression,
  integralType,
  setIntegralType,
  lowerBound,
  setLowerBound,
  upperBound,
  setUpperBound,
}: CalculusIntegralFieldsProps) {
  return (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold">{copy.integrand}</label>
                      <Input dir="ltr" placeholder="e.g. x * e^x or 1/(1+x^2)" value={expression} onChange={e => setExpression(e.target.value)} className="font-mono text-lg py-6" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold">{copy.integralType}</label>
                      <Select value={integralType} onValueChange={setIntegralType}>
                        <SelectTrigger dir={isArabic ? 'rtl' : 'ltr'}><SelectValue /></SelectTrigger>
                        <SelectContent dir={isArabic ? 'rtl' : 'ltr'}>
                          <SelectItem value="indefinite">{copy.indefinite}</SelectItem>
                          <SelectItem value="definite">{copy.definite}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {integralType === 'definite' && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-semibold">{copy.lowerBoundA}</label>
                          <Input dir="ltr" value={lowerBound} onChange={e => setLowerBound(e.target.value)} className="font-mono" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-semibold">{copy.upperBoundB}</label>
                          <Input dir="ltr" value={upperBound} onChange={e => setUpperBound(e.target.value)} className="font-mono" />
                        </div>
                      </div>
                    )}
                  </div>
  );
}
