import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@workspace/y-hub-ds/components/ui/card';

import { Button } from '@workspace/y-hub-ds/components/ui/button';

import {
  Infinity,
  TrendingUp,
  Activity,
  Sigma,
  Layers,
  History,
} from 'lucide-react';

import 'katex/dist/katex.min.css';

import { CalculusHistory } from '../components/CalculusHistory';
import { CalculusResults } from '../components/CalculusResults';
import { CalculusLimitFields } from '../components/CalculusLimitFields';
import { CalculusDerivativeFields } from '../components/CalculusDerivativeFields';
import { CalculusIntegralFields } from '../components/CalculusIntegralFields';
import { CalculusApplicationFields } from '../components/CalculusApplicationFields';
import { CalculusSeriesFields } from '../components/CalculusSeriesFields';
import { CalculusEngineNavigation } from '../components/CalculusEngineNavigation';

import { useCalculusController } from '../hooks/useCalculusController';

export default function CalculusSolverPage() {
  const {
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
  } = useCalculusController();

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
