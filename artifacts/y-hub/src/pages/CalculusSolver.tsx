import { useState, useEffect } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import { getCalculusCopy } from '@/i18n/calculusCopy';
import { createLimitHandler } from '@/features/calculus/handlers/createLimitHandler';
import { createDerivativeHandler } from '@/features/calculus/handlers/createDerivativeHandler';
import { createIntegralHandler } from '@/features/calculus/handlers/createIntegralHandler';
import { createApplicationHandler } from '@/features/calculus/handlers/createApplicationHandler';
import { createSeriesHandler } from '@/features/calculus/handlers/createSeriesHandler';
import { CalculusHistory } from '@/components/calculus/CalculusHistory';
import { CalculusResults } from '@/components/calculus/CalculusResults';
import { CalculusLimitFields } from '@/components/calculus/CalculusLimitFields';
import { CalculusDerivativeFields } from '@/components/calculus/CalculusDerivativeFields';
import { CalculusIntegralFields } from '@/components/calculus/CalculusIntegralFields';
import { CalculusApplicationFields } from '@/components/calculus/CalculusApplicationFields';
import { CalculusSeriesFields } from '@/components/calculus/CalculusSeriesFields';
import { CalculusEngineNavigation } from '@/components/calculus/CalculusEngineNavigation';
import type { EngineType } from '@/components/calculus/CalculusEngineNavigation';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@workspace/y-hub-ds/components/ui/card';
import { Button } from '@workspace/y-hub-ds/components/ui/button';
import { Infinity, TrendingUp, Activity, Sigma, Layers, History, AlertCircle } from 'lucide-react';
import { InlineMath } from 'react-katex';
import 'katex/dist/katex.min.css';
import { mathEngine } from '@/utils/mathEngine';
import type { LimitClassification } from '@/services/math/types/result';



interface Step {
  desc: string;
  math?: string;
  isError?: boolean;
}

export default function CalculusSolver() {
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
  const [graphData, setGraphData] = useState<any[]>([]);
  const [history, setHistory] = useState<{ id: number; engine: string; expr: string; result: string }[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('calculus_history');
    if (saved) {
      try { setHistory(JSON.parse(saved)); } catch (e) {}
    }
  }, []);

  const saveToHistory = (expr: string, res: string) => {
    const newEntry = { id: Date.now(), engine: activeEngine, expr, result: res };
    const updated = [newEntry, ...history].slice(0, 10);
    setHistory(updated);
    localStorage.setItem('calculus_history', JSON.stringify(updated));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const generateGraph = (expr: string) => {
    const data = [];
    for (let x = -10; x <= 10; x += 0.5) {
      let y = mathEngine.evaluateNumerically(expr, {x});
      if (!isNaN(y) && Math.abs(y) < 100) {
        data.push({ x, y });
      }
    }
    setGraphData(data);
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

  const engines = [
    { id: 'limits', label: copy.limits, icon: Infinity },
    { id: 'derivatives', label: copy.derivatives, icon: TrendingUp },
    { id: 'integrals', label: copy.integrals, icon: Sigma },
    { id: 'applications', label: copy.applications, icon: Layers },
    { id: 'series', label: copy.series, icon: Activity },
    { id: 'history', label: copy.history, icon: History },
  ] as const;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto min-h-screen space-y-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8 bg-[hsl(var(--card))] p-6 rounded-2xl border shadow-sm">
        <div className="p-4 bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] rounded-2xl">
          <Sigma size={32} />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{copy.title}</h1>
          <p className="text-[hsl(var(--muted-foreground))] mt-1 text-sm md:text-base">{copy.subtitle}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Navigation Sidebar */}
        <CalculusEngineNavigation
          engines={engines}
          activeEngine={activeEngine}
          onSelectEngine={(engineId) => {
            setActiveEngine(engineId);
            setSteps([]);
            setFinalResult(null);
          }}
        />

        {/* Main Content Area */}
        <div className="lg:col-span-3 space-y-6">
          {activeEngine === 'history' ? (
            <CalculusHistory
              copy={copy}
              history={history}
              setHistory={setHistory}
              copyToClipboard={copyToClipboard}
            />
          ) : (
            <Card className="shadow-md border-2 overflow-hidden">
              <CardHeader className="bg-[hsl(var(--muted))]/30 border-b">
                <CardTitle className="text-xl">{engines.find(e => e.id === activeEngine)?.label}</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">

                {/* 1. Limits Engine UI */}
                {activeEngine === 'limits' && (
                  <CalculusLimitFields
                    copy={copy}
                    isArabic={isArabic}
                    expression={expression}
                    setExpression={setExpression}
                    limitPoint={limitPoint}
                    setLimitPoint={setLimitPoint}
                    limitDirection={limitDirection}
                    setLimitDirection={setLimitDirection}
                  />
                )}
                {/* 2. Derivatives Engine UI */}
                {activeEngine === 'derivatives' && (
                  <CalculusDerivativeFields
                    copy={copy}
                    isArabic={isArabic}
                    expression={expression}
                    setExpression={setExpression}
                    derivOrder={derivOrder}
                    setDerivOrder={setDerivOrder}
                    isImplicit={isImplicit}
                    setIsImplicit={setIsImplicit}
                  />
                )}
                {/* 3. Integrals Engine UI */}
                {activeEngine === 'integrals' && (
                  <CalculusIntegralFields
                    copy={copy}
                    isArabic={isArabic}
                    expression={expression}
                    setExpression={setExpression}
                    integralType={integralType}
                    setIntegralType={setIntegralType}
                    lowerBound={lowerBound}
                    setLowerBound={setLowerBound}
                    upperBound={upperBound}
                    setUpperBound={setUpperBound}
                  />
                )}
                {/* 4. Applications Engine UI */}
                {activeEngine === 'applications' && (
                  <CalculusApplicationFields
                    copy={copy}
                    isArabic={isArabic}
                    appType={appType}
                    setAppType={setAppType}
                    expression={expression}
                    setExpression={setExpression}
                    expression2={expression2}
                    setExpression2={setExpression2}
                    lowerBound={lowerBound}
                    setLowerBound={setLowerBound}
                    upperBound={upperBound}
                    setUpperBound={setUpperBound}
                  />
                )}
                {/* 5. Series Engine UI */}
                {activeEngine === 'series' && (
                  <CalculusSeriesFields
                    copy={copy}
                    expression={expression}
                    setExpression={setExpression}
                  />
                )}
                <Button onClick={handleSolve} disabled={!expression || loading} className="w-full text-lg h-14 rounded-xl font-bold shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground transition-all">
                  {loading ? copy.analyzing : copy.solve}
                </Button>

              </CardContent>

              {/* Results Area */}
              {finalResult && (
                <CalculusResults
                  copy={copy}
                  steps={steps}
                  finalResult={finalResult}
                  activeEngine={activeEngine}
                  graphData={graphData}
                  copyToClipboard={copyToClipboard}
                />
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

