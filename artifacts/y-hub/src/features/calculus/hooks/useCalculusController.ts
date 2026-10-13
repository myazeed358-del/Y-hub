import { useState, useEffect } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import { getCalculusCopy } from '@/i18n/calculusCopy';

import { createLimitHandler } from '../handlers/createLimitHandler';
import { createDerivativeHandler } from '../handlers/createDerivativeHandler';
import { createIntegralHandler } from '../handlers/createIntegralHandler';
import { createApplicationHandler } from '../handlers/createApplicationHandler';
import { createSeriesHandler } from '../handlers/createSeriesHandler';

import type { LimitClassification } from '@/services/math/types/result';
import type {
  EngineType,
  Step,
  GraphPoint,
  CalculusHistoryEntry,
} from '../types';

import { sampleFunctionGraph } from '../domain/sampleFunctionGraph';
import { evaluateCalculusAt } from '../services/calculusNumericService';
import { calculusHistoryStorage } from '../services/calculusHistoryStorage';
import { calculusClipboardService } from '../services/calculusClipboardService';

export function useCalculusController() {

  const { language } = useLanguage();
  const isArabic = language === 'ar';

  const copy = getCalculusCopy(isArabic);

  const [activeEngine, setActiveEngine] = useState<EngineType>('limits');

  // Form States
  const [expression, setExpression] = useState('');
  const [expression2, setExpression2] = useState(''); // for g(x) or implicit

  // Limit States
  const [limitPoint, setLimitPoint] = useState('0');
  const [limitDirection, setLimitDirection] = useState('both');

  // Derivative States
  const [derivOrder, setDerivOrder] = useState('1');
  const [isImplicit, setIsImplicit] = useState(false);

  // Integral States
  const [integralType, setIntegralType] = useState('indefinite');
  const [lowerBound, setLowerBound] = useState('0');
  const [upperBound, setUpperBound] = useState('1');

  // App/Series States
  const [appType, setAppType] = useState('volume');

  // Results & UI States
  const [steps, setSteps] = useState<Step[]>([]);
  const [finalResult, setFinalResult] = useState<string | null>(null);
  const [limitClassification, setLimitClassification] =
    useState<LimitClassification | null>(null);
  const [loading, setLoading] = useState(false);
  const [graphData, setGraphData] = useState<GraphPoint[]>([]);
  const [history, setHistory] = useState<CalculusHistoryEntry[]>([]);

  useEffect(() => {
    const saved = calculusHistoryStorage.read();
    if (saved) {
      try { setHistory(JSON.parse(saved)); } catch (e) {}
    }
  }, []);

  const saveToHistory = (expr: string, res: string) => {
    const newEntry = { id: Date.now(), engine: activeEngine, expr, result: res };
    const updated = [newEntry, ...history].slice(0, 10);
    setHistory(updated);
    calculusHistoryStorage.write(updated);
  };

  const copyToClipboard = (text: string) => {
    calculusClipboardService.copy(text);
  };

  const generateGraph = (expr: string) => {
    setGraphData(
      sampleFunctionGraph(expr, evaluateCalculusAt)
    );
  };

  const handleLimits = createLimitHandler({
    expression,
    limitPoint,
    limitDirection,
    copy,
    language,
    isArabic,
    setLimitClassification,
    setFinalResult,
    setSteps,
  });

  const handleDerivatives = createDerivativeHandler({
    expression,
    derivOrder,
    isImplicit,
    copy,
    setFinalResult,
    setSteps,
  });

  const handleIntegrals = createIntegralHandler({
    expression,
    integralType,
    lowerBound,
    upperBound,
    copy,
    setFinalResult,
    setSteps,
  });

  const handleApplications = createApplicationHandler({
    expression,
    expression2,
    appType,
    lowerBound,
    upperBound,
    copy,
    setFinalResult,
    setSteps,
  });

  const handleSeries = createSeriesHandler({
    expression,
    copy,
    setFinalResult,
    setSteps,
  });

  const handleSolve = async () => {
    setLoading(true);
    setSteps([]);
    setFinalResult(null);
    setLimitClassification(null);
    setGraphData([]);

    generateGraph(expression);

    switch(activeEngine) {
      case 'limits': await handleLimits(); break;
      case 'derivatives': await handleDerivatives(); break;
      case 'integrals': await handleIntegrals(); break;
      case 'applications': await handleApplications(); break;
      case 'series': await handleSeries(); break;
    }

    setLoading(false);
  };

  // Add to history after solve completes
  useEffect(() => {
    const canSaveLimit =
      limitClassification === 'finite' ||
      limitClassification === '+infinity' ||
      limitClassification === '-infinity';

    if (
      finalResult &&
      !loading &&
      finalResult !== 'null' &&
      (activeEngine !== 'limits' || canSaveLimit)
    ) {
      saveToHistory(expression, finalResult);
    }
  }, [finalResult, loading, limitClassification]);

  return {
    language,
    isArabic,
    copy,
    activeEngine,
    setActiveEngine,
    expression,
    setExpression,
    expression2,
    setExpression2,
    limitPoint,
    setLimitPoint,
    limitDirection,
    setLimitDirection,
    derivOrder,
    setDerivOrder,
    isImplicit,
    setIsImplicit,
    integralType,
    setIntegralType,
    lowerBound,
    setLowerBound,
    upperBound,
    setUpperBound,
    appType,
    setAppType,
    steps,
    setSteps,
    finalResult,
    setFinalResult,
    loading,
    graphData,
    history,
    setHistory,
    copyToClipboard,
    handleSolve
  };
}
