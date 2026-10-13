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

interface CalculusApplicationHandlerDependencies {
  expression: string;
  expression2: string;
  appType: string;
  lowerBound: string;
  upperBound: string;
  copy: ReturnType<typeof getCalculusCopy>;
  setFinalResult: Dispatch<SetStateAction<string | null>>;
  setSteps: Dispatch<SetStateAction<Step[]>>;
}

export function createApplicationHandler({
  expression,
  expression2,
  appType,
  lowerBound,
  upperBound,
  copy,
  setFinalResult,
  setSteps,
}: CalculusApplicationHandlerDependencies) {
  return async () => {
    let currentSteps: Step[] = [];
    try {
      if (appType === 'volume') {
         currentSteps.push({ desc: copy.volumeDisk, math: `V = \\pi \\int_{${lowerBound}}^{${upperBound}} [f(x)]^2 dx` });
         const squared = `(${expression})^2`;
         const areaFormat = `${lowerBound}:${upperBound}|${squared}`;
         const result = await mathEngine.compute('area', areaFormat);
         currentSteps.push({ desc: copy.squaredIntegral, math: `\\int [f(x)]^2 dx = ${result}` });
         setFinalResult(`V = ${result} \\pi`);
      } else if (appType === 'arclength') {
         currentSteps.push({ desc: copy.arcLengthCalculation, math: `L = \\int_{a}^{b} \\sqrt{1 + [f'(x)]^2} dx` });
         const deriv = await mathEngine.compute('derive', expression);
         currentSteps.push({ desc: copy.firstDerivativeStep, math: deriv });
         currentSteps.push({ desc: copy.integralFormula, math: `\\sqrt{1 + (${deriv})^2}` });
         setFinalResult(copy.arcLengthResult);
      } else if (appType === 'area_between') {
         currentSteps.push({ desc: copy.areaBetweenStep, math: `A = \\int_{${lowerBound}}^{${upperBound}} |f(x) - g(x)| dx` });
         currentSteps.push({ desc: 'f(x):', math: expression });
         currentSteps.push({ desc: 'g(x):', math: expression2 });
         const diff = `(${expression}) - (${expression2})`;
         const areaFormat = `${lowerBound}:${upperBound}|${diff}`;
         const result = await mathEngine.compute('area', areaFormat);
         currentSteps.push({ desc: copy.differenceIntegral, math: result });
         setFinalResult(result);
      }
    } catch (e: any) {
      currentSteps.push({ desc: copy.geometryError, isError: true });
    }
    setSteps(currentSteps);
  };
}
