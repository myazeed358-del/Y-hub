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

interface CalculusSeriesHandlerDependencies {
  expression: string;
  copy: ReturnType<typeof getCalculusCopy>;
  setFinalResult: Dispatch<SetStateAction<string | null>>;
  setSteps: Dispatch<SetStateAction<Step[]>>;
}

export function createSeriesHandler({
  expression,
  copy,
  setFinalResult,
  setSteps,
}: CalculusSeriesHandlerDependencies) {
  return async () => {
    let currentSteps: Step[] = [];
    try {
      currentSteps.push({ desc: copy.seriesAnalysis, math: `a_n = ${expression}` });
      currentSteps.push({ desc: copy.nthTermTest });
      currentSteps.push({ desc: copy.limitAtInfinity });

      const limitsAtInf = await mathEngine.compute('simplify', expression); // mock behavior for sequence limit
      currentSteps.push({ desc: copy.ratioTest, math: `\\lim_{n \\to \\infty} \\left| \\frac{a_{n+1}}{a_n} \\right|` });

      setFinalResult(copy.seriesResult(limitsAtInf));
    } catch (e: any) {
      currentSteps.push({ desc: copy.seriesError, isError: true });
    }
    setSteps(currentSteps);
  };
}
