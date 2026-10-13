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

interface MathIntegralHandlerDependencies {
  expr: string;
  variable: string;
  copy: ReturnType<typeof getMathSolverCopy>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setSteps: Dispatch<SetStateAction<Step[]>>;
  setResult: Dispatch<SetStateAction<string | null>>;
}

export function createIntegralHandler({
  expr,
  variable,
  copy,
  setLoading,
  setSteps,
  setResult,
}: MathIntegralHandlerDependencies) {
  return async () => {
    setLoading(true); setSteps([]); setResult(null);
    try {
      const exprTex = await mathEngine.toTex(expr);
      const integrated = await mathEngine.integratePartial(expr, variable as any);
      const intTex = await mathEngine.toTex(integrated);
      setSteps([{ desc: copy.indefiniteStep, math: `\\int (${exprTex}) \\, d${variable}` }]);
      setResult(`${intTex} + C`);
    } catch (e: any) {
      toast.error(copy.integralFailed);
    }
    setLoading(false);
  };
}
