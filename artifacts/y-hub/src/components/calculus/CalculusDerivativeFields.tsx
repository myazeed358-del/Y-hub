import { Input } from '@workspace/y-hub-ds/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/y-hub-ds/components/ui/select';
import type { getCalculusCopy } from '@/i18n/calculusCopy';

interface CalculusDerivativeFieldsProps {
  copy: ReturnType<typeof getCalculusCopy>;
  isArabic: boolean;
  expression: string;
  setExpression: (value: string) => void;
  derivOrder: string;
  setDerivOrder: (value: string) => void;
  isImplicit: boolean;
  setIsImplicit: (value: boolean) => void;
}

export function CalculusDerivativeFields({
  copy,
  isArabic,
  expression,
  setExpression,
  derivOrder,
  setDerivOrder,
  isImplicit,
  setIsImplicit,
}: CalculusDerivativeFieldsProps) {
  return (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold">{copy.equationOrFunction}</label>
                      <Input dir="ltr" placeholder="e.g. x^3 * sin(x) or x^2 + y^2 = 25" value={expression} onChange={e => setExpression(e.target.value)} className="font-mono text-lg py-6" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-semibold">{copy.derivativeOrder}</label>
                        <Select value={derivOrder} onValueChange={setDerivOrder}>
                          <SelectTrigger dir={isArabic ? 'rtl' : 'ltr'}><SelectValue /></SelectTrigger>
                          <SelectContent dir={isArabic ? 'rtl' : 'ltr'}>
                            <SelectItem value="1">{copy.firstDerivative}</SelectItem>
                            <SelectItem value="2">{copy.secondDerivative}</SelectItem>
                            <SelectItem value="3">{copy.thirdDerivative}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold">{copy.type}</label>
                        <Select value={isImplicit ? 'implicit' : 'explicit'} onValueChange={v => setIsImplicit(v === 'implicit')}>
                          <SelectTrigger dir={isArabic ? 'rtl' : 'ltr'}><SelectValue /></SelectTrigger>
                          <SelectContent dir={isArabic ? 'rtl' : 'ltr'}>
                            <SelectItem value="explicit">{copy.explicit}</SelectItem>
                            <SelectItem value="implicit">{copy.implicit}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
  );
}
