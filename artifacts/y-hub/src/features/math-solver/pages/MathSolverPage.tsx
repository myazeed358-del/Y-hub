import { Box } from 'lucide-react';

import { MathSolverResults } from '../components/MathSolverResults';
import { MathSolverPlotPanel } from '../components/MathSolverPlotPanel';
import { MathSolverEquationWorkspace } from '../components/MathSolverEquationWorkspace';

import { useMathSolverController } from '../hooks/useMathSolverController';

export default function MathSolverPage() {
  const {
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
  } = useMathSolverController();

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
