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

interface MathDerivativeHandlerDependencies {
  expr: string;
  variable: string;
  copy: ReturnType<typeof getMathSolverCopy>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setSteps: Dispatch<SetStateAction<Step[]>>;
  setResult: Dispatch<SetStateAction<string | null>>;
}

export function createDerivativeHandler({
  expr,
  variable,
  copy,
  setLoading,
  setSteps,
  setResult,
}: MathDerivativeHandlerDependencies) {
  return async () => {
    setLoading(true); setSteps([]); setResult(null);
    try {
      const exprTex = await mathEngine.toTex(expr);
      const derived = await mathEngine.derivePartial(expr, variable as any);
      const derivedTex = await mathEngine.toTex(derived);

      setSteps([
        { desc: copy.originalFunction, math: `f(${variable}) = ${exprTex}` },
        { desc: copy.partialStep(variable), math: `\\frac{\\partial}{\\partial ${variable}} (${exprTex})` }
      ]);
      setResult(derivedTex);
    } catch (e: any) {
      toast.error(copy.derivativeFailed);
    }
    setLoading(false);
  };
}
