import React, { useState, useEffect } from 'react';
import { Box } from 'lucide-react';
import { useLanguage } from '@/i18n/LanguageContext';
import { getMathSolverCopy } from '@/i18n/mathSolverCopy';
import { MathSolverResults } from '@/components/math-solver/MathSolverResults';
import { MathSolverPlotPanel } from '@/components/math-solver/MathSolverPlotPanel';
import { MathSolverEquationWorkspace } from '@/components/math-solver/MathSolverEquationWorkspace';
import { createDerivativeHandler } from '@/features/math-solver/handlers/createDerivativeHandler';
import { createGradientHandler } from '@/features/math-solver/handlers/createGradientHandler';
import { createIntegralHandler } from '@/features/math-solver/handlers/createIntegralHandler';
import { createDoubleIntegralHandler } from '@/features/math-solver/handlers/createDoubleIntegralHandler';
import { createLimitHandler } from '@/features/math-solver/handlers/createLimitHandler';
import { generateMathSolverPlotData } from '@/features/math-solver/plotting/generateMathSolverPlotData';

interface Step {
  desc: string;
  math?: string;
}

export default function MathSolver() {
  const { language } = useLanguage();
  const isArabic = language === 'ar';

  const copy = getMathSolverCopy(isArabic);

  const [expr, setExpr] = useState('x^2 + y^2 + z^2');
  const [variable, setVariable] = useState('x');
  const [loading, setLoading] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [result, setResult] = useState<string | null>(null);
  
  // Plotting states
  const [plotMode, setPlotMode] = useState<'surface' | 'parametric' | 'vector'>('surface');
  const [plotExpr, setPlotExpr] = useState('x^2 - y^2');
  const [plotData, setPlotData] = useState<any[]>([]);

  useEffect(() => {
    const handler = setTimeout(() => {
      try {
        setPlotData(generateMathSolverPlotData(plotMode, plotExpr));
      } catch (e) {
        setPlotData([]);
      }
    }, 500); // 500ms debounce
    return () => clearTimeout(handler);
  }, [plotExpr, plotMode]);

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

  return (
    <div
      className="mx-auto max-w-6xl p-4 md:p-6"
      dir={isArabic ? 'rtl' : 'ltr'}
    >
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shrink-0">
          <Box size={24} />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">{copy.title}</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            {copy.subtitle}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Main Workspace */}
        <div className="space-y-6">
          <MathSolverEquationWorkspace
            copy={copy}
            expr={expr}
            setExpr={setExpr}
            variable={variable}
            setVariable={setVariable}
            limitPoint={limitPoint}
            setLimitPoint={setLimitPoint}
            loading={loading}
            solveDerivative={solveDerivative}
            solveGradient={solveGradient}
            solveIntegral={solveIntegral}
            solveDoubleIntegral={solveDoubleIntegral}
            solveLimit={solveLimit}
          />

          {/* Results Area */}
          {(steps.length > 0 || result) && (
            <MathSolverResults
              copy={copy}
              steps={steps}
              result={result}
            />
          )}
        </div>

        {/* Visuals Area */}
        <MathSolverPlotPanel
          copy={copy}
          plotMode={plotMode}
          setPlotMode={setPlotMode}
          plotExpr={plotExpr}
          setPlotExpr={setPlotExpr}
          plotData={plotData}
        />
      </div>
    </div>
  );
}
