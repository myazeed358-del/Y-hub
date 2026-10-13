import type {
  Dispatch,
  SetStateAction,
} from 'react';
import { mathEngine } from '@/utils/mathEngine';
import { toast } from 'sonner';
import type { getMathSolverCopy } from '@/i18n/mathSolverCopy';

interface Step {
  desc: string;
  math?: string;
}

interface MathLimitHandlerDependencies {
  expr: string;
  variable: string;
  limitPoint: string;
  copy: ReturnType<typeof getMathSolverCopy>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setSteps: Dispatch<SetStateAction<Step[]>>;
  setResult: Dispatch<SetStateAction<string | null>>;
}

export function createLimitHandler({
  expr,
  variable,
  limitPoint,
  copy,
  setLoading,
  setSteps,
  setResult,
}: MathLimitHandlerDependencies) {
  return async () => {
    setLoading(true); setSteps([]); setResult(null);
    try {
      const parts = expr.split('/');
      const isFraction = parts.length === 2;

      if (!isFraction) {
        const pt = limitPoint === 'inf' ? 10000 : parseFloat(limitPoint);
        const val = mathEngine.evaluateNumerically(expr, { [variable]: pt });
        const exprTex = await mathEngine.toTex(expr);
        setSteps([{ desc: copy.directSubstitution, math: `\\lim_{${variable} \\to ${limitPoint}} (${exprTex}) = ${val}` }]);
        setResult(val.toString());
      } else {
        let num = parts[0];
        let den = parts[1];
        let currentNum = num;
        let currentDen = den;
        let limitResolved = false;

        const pt = limitPoint === 'inf' ? 10000 : parseFloat(limitPoint);

        setSteps([{ desc: copy.originalLimit, math: `\\lim_{${variable} \\to ${limitPoint}} \\frac{${await mathEngine.toTex(num)}}{${await mathEngine.toTex(den)}}` }]);

        for (let i = 1; i <= 3; i++) {
          const numVal = mathEngine.evaluateNumerically(currentNum, { [variable]: pt });
          const denVal = mathEngine.evaluateNumerically(currentDen, { [variable]: pt });

          if ((Math.abs(numVal) < 1e-5 && Math.abs(denVal) < 1e-5) || (Math.abs(numVal) > 1000 && Math.abs(denVal) > 1000)) {
            setSteps(prev => [...prev, { desc: copy.indeterminate(numVal < 1e-5 ? '0/0' : '∞/∞') }]);
            currentNum = await mathEngine.derivePartial(currentNum, variable as any);
            currentDen = await mathEngine.derivePartial(currentDen, variable as any);
            const numTex = await mathEngine.toTex(currentNum);
            const denTex = await mathEngine.toTex(currentDen);
            setSteps(prev => [...prev, { desc: copy.afterDerivative(i), math: `\\lim_{${variable} \\to ${limitPoint}} \\frac{${numTex}}{${denTex}}` }]);
          } else {
            const finalVal = numVal / denVal;
            setSteps(prev => [...prev, { desc: copy.directSubstitutionWorks, math: `\\frac{${numVal.toFixed(4)}}{${denVal.toFixed(4)}} = ${finalVal.toFixed(4)}` }]);
            setResult(finalVal.toFixed(4));
            limitResolved = true;
            break;
          }
        }

        if (!limitResolved) {
          toast.warning(copy.lhopitalStopped);
          setResult(copy.indeterminateResult);
        }
      }
    } catch (e: any) {
      toast.error(copy.limitFailed);
    }
    setLoading(false);
  };
}
