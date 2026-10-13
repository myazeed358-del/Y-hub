import type {
  Dispatch,
  SetStateAction,
} from 'react';
import { mathEngine } from '@/utils/mathEngine';
import type { getCalculusCopy } from '@/i18n/calculusCopy';

interface Step {
  desc: string;
  math?: string;
  isError?: boolean;
}

interface CalculusDerivativeHandlerDependencies {
  expression: string;
  derivOrder: string;
  isImplicit: boolean;
  copy: ReturnType<typeof getCalculusCopy>;
  setFinalResult: Dispatch<SetStateAction<string | null>>;
  setSteps: Dispatch<SetStateAction<Step[]>>;
}

export function createDerivativeHandler({
  expression,
  derivOrder,
  isImplicit,
  copy,
  setFinalResult,
  setSteps,
}: CalculusDerivativeHandlerDependencies) {
  return async () => {
    let currentSteps: Step[] = [];
    try {
      if (isImplicit) {
        currentSteps.push({ desc: copy.implicitDifferentiation, math: expression });
        currentSteps.push({ desc: copy.implicitExplanation });
        setFinalResult(copy.implicitEngineResult);
      } else {
        currentSteps.push({ desc: copy.originalFunction, math: `f(x) = ${expression}` });
        let currentExpr = expression;

        for (let i = 1; i <= parseInt(derivOrder); i++) {
          const derived = await mathEngine.compute('derive', currentExpr);
          currentSteps.push({ desc: copy.derivativeOrderStep(i), math: `f${'^\\prime'.repeat(i)}(x) = ${derived}` });
          currentExpr = derived;
        }
        setFinalResult(`f${'^\\prime'.repeat(parseInt(derivOrder))}(x) = ${currentExpr}`);

        if (parseInt(derivOrder) === 1) {
           currentSteps.push({ desc: copy.criticalPointsSearch });
           try {
             const zeroes = await mathEngine.compute('zeroes', currentExpr);
             currentSteps.push({ desc: copy.criticalPoints, math: `x = ${zeroes}` });
           } catch(e) {}
        }
      }
    } catch (e: any) {
      currentSteps.push({ desc: copy.derivativeError, isError: true });
    }
    setSteps(currentSteps);
  };
}
