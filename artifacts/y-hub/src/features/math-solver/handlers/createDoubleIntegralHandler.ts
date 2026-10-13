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

interface MathDoubleIntegralHandlerDependencies {
  expr: string;
  copy: ReturnType<typeof getMathSolverCopy>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setSteps: Dispatch<SetStateAction<Step[]>>;
  setResult: Dispatch<SetStateAction<string | null>>;
}

export function createDoubleIntegralHandler({
  expr,
  copy,
  setLoading,
  setSteps,
  setResult,
}: MathDoubleIntegralHandlerDependencies) {
  return async () => {
    setLoading(true); setSteps([]); setResult(null);
    const inner = 'y'; // Just an example, UI could allow selecting order (dx dy or dy dx)
    const outer = 'x';
    try {
      const exprTex = await mathEngine.toTex(expr);
      setSteps(prev => [...prev, { desc: copy.preparingDoubleIntegral, math: `\\iint (${exprTex}) \\, d${inner} \\, d${outer}` }]);

      const innerInt = await mathEngine.integratePartial(expr, inner);
      const innerIntTex = await mathEngine.toTex(innerInt);
      setSteps(prev => [...prev, { desc: copy.innerIntegral(inner), math: `\\int (${innerIntTex}) \\, d${outer}` }]);

      const outerInt = await mathEngine.integratePartial(innerInt, outer);
      const outerIntTex = await mathEngine.toTex(outerInt);
      setSteps(prev => [...prev, { desc: copy.outerIntegral(outer), math: outerIntTex }]);

      setResult(`${outerIntTex} + C(x,y)`);
    } catch (e: any) {
      toast.error(copy.doubleIntegralFailed);
    }
    setLoading(false);
  };
}
