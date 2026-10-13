import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@workspace/y-hub-ds/components/ui/tabs';

import { ArrowLeft } from 'lucide-react';
import { Link } from 'wouter';

import { SolverForwardTab } from '../components/SolverForwardTab';
import { SolverReverseTab } from '../components/SolverReverseTab';
import { useSolverController } from '../hooks/useSolverController';

export default function SolverPage() {
  const {
    t,
    isArabic,
    copy,
    a,
    setA,
    b,
    setB,
    tnorm,
    setTnorm,
    result,
    proof,
    revA,
    revResult,
    revOperation,
    userAnswerB,
    setUserAnswerB,
    challenge,
    validation,
    generateNewChallenge,
    handleValidate,
    handleForwardExport,
    handleReverseExport
  } = useSolverController();

  return (
    <div
      className="mx-auto max-w-4xl py-10 px-5"
      dir={isArabic ? 'rtl' : 'ltr'}
    >
      <Link href="/" className="inline-flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))] mb-8">
        <ArrowLeft size={16} className={isArabic ? 'rotate-180' : ''} /> {copy.back}
      </Link>

      <div className="mb-8">
        <div className="mb-3 text-xs font-bold tracking-[0.18em] text-[hsl(var(--primary))]">{copy.kicker}</div>
        <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">{copy.title}</h1>
        <p className="mt-3 text-[hsl(var(--muted-foreground))]">{t('calculateOperations')}</p>
      </div>

      <Tabs defaultValue="forward" className="w-full">
        <TabsList className="mb-6 grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="forward">{t('forwardCalc')}</TabsTrigger>
          <TabsTrigger value="reverse">{t('reverseChallenge')}</TabsTrigger>
        </TabsList>

        <SolverForwardTab
          t={t}
          copy={copy}
          a={a}
          setA={setA}
          b={b}
          setB={setB}
          tnorm={tnorm}
          setTnorm={setTnorm}
          result={result}
          proof={proof}
          handleForwardExport={handleForwardExport}
        />

        <SolverReverseTab
          copy={copy}
          revOperation={revOperation}
          revA={revA}
          revResult={revResult}
          userAnswerB={userAnswerB}
          setUserAnswerB={setUserAnswerB}
          challenge={challenge}
          validation={validation}
          generateNewChallenge={generateNewChallenge}
          handleValidate={handleValidate}
          handleReverseExport={handleReverseExport}
        />
      </Tabs>
    </div>
  );
}
