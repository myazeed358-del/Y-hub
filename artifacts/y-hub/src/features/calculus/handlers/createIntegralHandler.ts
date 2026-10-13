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

interface CalculusIntegralHandlerDependencies {
  expression: string;
  integralType: string;
  lowerBound: string;
  upperBound: string;
  copy: ReturnType<typeof getCalculusCopy>;
  setFinalResult: Dispatch<SetStateAction<string | null>>;
  setSteps: Dispatch<SetStateAction<Step[]>>;
}

export function createIntegralHandler({
  expression,
  integralType,
  lowerBound,
  upperBound,
  copy,
  setFinalResult,
  setSteps,
}: CalculusIntegralHandlerDependencies) {
  return async () => {
    let currentSteps: Step[] = [];
    try {
      if (integralType === 'indefinite') {
        currentSteps.push({ desc: copy.indefiniteIntegralStep, math: `\\int \\left( ${expression} \\right) dx` });
        const result = await mathEngine.compute('integrate', expression);
        currentSteps.push({ desc: copy.basicIntegralRules, math: result });
        setFinalResult(`${result} + C`);
      } else {
        currentSteps.push({ desc: copy.definiteIntegralStep, math: `\\int_{${lowerBound}}^{${upperBound}} \\left( ${expression} \\right) dx` });

        if (lowerBound === 'inf' || upperBound === 'inf') {
           currentSteps.push({ desc: copy.improperIntegral });
        }

        // Newton API uses area/a:b|expr
        const areaFormat = `${lowerBound}:${upperBound}|${expression}`;
        const result = await mathEngine.compute('area', areaFormat);
        currentSteps.push({ desc: copy.areaEvaluation, math: result });
        setFinalResult(result);
      }
    } catch (e: any) {
      currentSteps.push({ desc: copy.integralError, isError: true });
    }
    setSteps(currentSteps);
  };
}
