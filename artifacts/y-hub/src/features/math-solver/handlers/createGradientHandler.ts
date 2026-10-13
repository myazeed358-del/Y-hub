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

interface MathGradientHandlerDependencies {
  expr: string;
  copy: ReturnType<typeof getMathSolverCopy>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setSteps: Dispatch<SetStateAction<Step[]>>;
  setResult: Dispatch<SetStateAction<string | null>>;
}

export function createGradientHandler({
  expr,
  copy,
  setLoading,
  setSteps,
  setResult,
}: MathGradientHandlerDependencies) {
  return async () => {
    setLoading(true); setSteps([]); setResult(null);
    try {
      setSteps([{ desc: copy.gradientStep, math: `\\nabla f = \\langle f_x, f_y, f_z \\rangle` }]);
      const fx = await mathEngine.derivePartial(expr, 'x');
      const fy = await mathEngine.derivePartial(expr, 'y');
      const fz = await mathEngine.derivePartial(expr, 'z');

      const fxTex = await mathEngine.toTex(fx);
      const fyTex = await mathEngine.toTex(fy);
      const fzTex = await mathEngine.toTex(fz);

      setSteps(prev => [
        ...prev,
        { desc: copy.derivativeFor('x'), math: `f_x = ${fxTex}` },
        { desc: copy.derivativeFor('y'), math: `f_y = ${fyTex}` },
        { desc: copy.derivativeFor('z'), math: `f_z = ${fzTex}` }
      ]);
      setResult(`\\langle ${fxTex}, \\quad ${fyTex}, \\quad ${fzTex} \\rangle`);
    } catch (e: any) {
      toast.error(copy.gradientFailed);
    }
    setLoading(false);
  };
}
