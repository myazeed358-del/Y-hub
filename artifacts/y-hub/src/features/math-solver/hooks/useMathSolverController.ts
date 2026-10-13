import { useState } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import { getMathSolverCopy } from '@/i18n/mathSolverCopy';

import { createDerivativeHandler } from '../handlers/createDerivativeHandler';
import { createGradientHandler } from '../handlers/createGradientHandler';
import { createIntegralHandler } from '../handlers/createIntegralHandler';
import { createDoubleIntegralHandler } from '../handlers/createDoubleIntegralHandler';
import { createLimitHandler } from '../handlers/createLimitHandler';

import { useMathSolverPlot } from './useMathSolverPlot';
import type { MathSolverStep } from '../types';

export function useMathSolverController() {

  const { language } = useLanguage();
  const isArabic = language === 'ar';

  const copy = getMathSolverCopy(isArabic);

  const [expr, setExpr] = useState('x^2 + y^2 + z^2');
  const [variable, setVariable] = useState('x');
  const [loading, setLoading] = useState(false);
  const [steps, setSteps] = useState<MathSolverStep[]>([]);
  const [result, setResult] = useState<string | null>(null);

  const {
    plotMode,
    setPlotMode,
    plotExpr,
    setPlotExpr,
    plotData,
  } = useMathSolverPlot();

  // Handlers for limits
  const [limitPoint, setLimitPoint] = useState('0');

  const solveDerivative = createDerivativeHandler({
    expr,
    variable,
    copy,
    setLoading,
    setSteps,
    setResult,
  });

  const solveGradient = createGradientHandler({
    expr,
    copy,
    setLoading,
    setSteps,
    setResult,
  });

  const solveIntegral = createIntegralHandler({
    expr,
    variable,
    copy,
    setLoading,
    setSteps,
    setResult,
  });

  const solveDoubleIntegral = createDoubleIntegralHandler({
    expr,
    copy,
    setLoading,
    setSteps,
    setResult,
  });

  const solveLimit = createLimitHandler({
    expr,
    variable,
    limitPoint,
    copy,
    setLoading,
    setSteps,
    setResult,
  });

  return {
    language,
    isArabic,
    copy,
    expr,
    setExpr,
    variable,
    setVariable,
    loading,
    steps,
    result,
    plotMode,
    setPlotMode,
    plotExpr,
    setPlotExpr,
    plotData,
    limitPoint,
    setLimitPoint,
    solveDerivative,
    solveGradient,
    solveIntegral,
    solveDoubleIntegral,
    solveLimit
  };
}
