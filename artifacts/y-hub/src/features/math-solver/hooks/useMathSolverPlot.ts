import { useEffect, useState } from 'react';
import { generateMathSolverPlotData } from '../plotting/generateMathSolverPlotData';
import type { PlotMode } from '../types';

export function useMathSolverPlot() {
  const [plotMode, setPlotMode] =
    useState<PlotMode>('surface');

  const [plotExpr, setPlotExpr] =
    useState('x^2 - y^2');

  const [plotData, setPlotData] =
    useState<ReturnType<typeof generateMathSolverPlotData>>([]);

  useEffect(() => {
    const handler = setTimeout(() => {
      try {
        setPlotData(
          generateMathSolverPlotData(plotMode, plotExpr)
        );
      } catch {
        setPlotData([]);
      }
    }, 500);

    return () => clearTimeout(handler);
  }, [plotExpr, plotMode]);

  return {
    plotMode,
    setPlotMode,
    plotExpr,
    setPlotExpr,
    plotData,
  };
}
