import { useState, useMemo } from 'react';
import {
  tNormStandard,
  tNormAlgebraic,
  tNormBounded,
  tNormDrastic,
} from '@/utils/fuzzyLogic';
import {
  generateReverseTNormChallenge,
  validateReverseChallenge,
  type TNormType,
} from '@/utils/reverseEngine';
import { exportToPDF } from '@/utils/pdfExport';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsList, TabsTrigger } from '@workspace/y-hub-ds/components/ui/tabs';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'wouter';
import { useLanguage } from '@/i18n/LanguageContext';
import { getSolverCopy } from '@/i18n/solverCopy';
import { SolverForwardTab } from '@/components/solver/SolverForwardTab';
import { SolverReverseTab } from '@/components/solver/SolverReverseTab';

export default function Solver() {
  const { t, language } = useLanguage();
  const isArabic = language === 'ar';

  const copy = getSolverCopy(isArabic);
  const [a, setA] = useState<string>('0.5');
  const [b, setB] = useState<string>('0.5');
  const [tnorm, setTnorm] = useState<TNormType>('standard');

  const numA = Math.max(0, Math.min(1, parseFloat(a) || 0));
  const numB = Math.max(0, Math.min(1, parseFloat(b) || 0));

  let result = 0;
  let proof = '';

  switch (tnorm) {
    case 'standard':
      result = tNormStandard(numA, numB);
      proof = `\\mu_{A \\cap B}(x) = \\min(${numA}, ${numB}) = ${result}`;
      break;
    case 'algebraic':
      result = tNormAlgebraic(numA, numB);
      proof = `\\mu_{A \\cdot B}(x) = ${numA} \\cdot ${numB} = ${result}`;
      break;
    case 'bounded':
      result = tNormBounded(numA, numB);
      proof = `\\mu_{A \\odot B}(x) = \\max(0, ${numA} + ${numB} - 1) = \\max(0, ${(numA + numB - 1).toFixed(2)}) = ${result}`;
      break;
    case 'drastic':
      result = tNormDrastic(numA, numB);
      if (numB === 1) {
        proof = isArabic
          ? `\\text{بما أن } b = 1, \\mu_{A \\wedge B}(x) = a = ${result}`
          : `\\text{Since } b = 1, \\mu_{A \\wedge B}(x) = a = ${result}`;
      } else if (numA === 1) {
        proof = isArabic
          ? `\\text{بما أن } a = 1, \\mu_{A \\wedge B}(x) = b = ${result}`
          : `\\text{Since } a = 1, \\mu_{A \\wedge B}(x) = b = ${result}`;
      } else {
        proof = isArabic
          ? `\\text{بما أن } a \\neq 1 \\text{ و } b \\neq 1, \\mu_{A \\wedge B}(x) = 0`
          : `\\text{Since neither } a = 1 \\text{ nor } b = 1, \\mu_{A \\wedge B}(x) = 0`;
      }
      break;
  }

  // Reverse Challenge State
  const [revA, setRevA] = useState<number>(0.8);
  const [revResult, setRevResult] = useState<number>(0.4);
  const [revOperation, setRevOperation] = useState<TNormType>('algebraic');
  const [userAnswerB, setUserAnswerB] = useState<string>('');

  const challenge = useMemo(() => generateReverseTNormChallenge(revOperation, revA, revResult), [revOperation, revA, revResult]);

  const [validation, setValidation] = useState<{ isCorrect: boolean; proof: string } | null>(null);

  const generateNewChallenge = () => {
    const ops: TNormType[] = ['standard', 'algebraic', 'bounded', 'drastic'];
    const op = ops[Math.floor(Math.random() * ops.length)];
    const newA = Number((Math.random() * 0.9 + 0.1).toFixed(1));
    const newB = Number((Math.random() * 0.9 + 0.1).toFixed(1));

    setRevOperation(op);
    setRevA(newA);
    // Use the actual calculation to ensure the challenge result is valid
    let newRes = 0;
    if (op === 'standard') newRes = Math.min(newA, newB);
    if (op === 'algebraic') newRes = newA * newB;
    if (op === 'bounded') newRes = Math.max(0, newA + newB - 1);
    if (op === 'drastic') { if (newB === 1) newRes = newA; else if (newA === 1) newRes = newB; else newRes = 0; }

    setRevResult(Number(newRes.toFixed(2)));
    setUserAnswerB('');
    setValidation(null);
  };

  const handleValidate = () => {
    const ans = parseFloat(userAnswerB);
    if (isNaN(ans)) return;
    setValidation(validateReverseChallenge(challenge, ans, language));
  };

  const { profile } = useAuth();

  const handleForwardExport = () => {
    const userName =
      profile?.full_name?.split(' ')[0] ||
      (isArabic ? 'مستخدم Y HUB' : 'Y HUB User');
    exportToPDF({
      title: copy.forwardReport,
      userName,
      operation: tnorm,
      inputs: { [copy.inputA]: numA, [copy.inputB]: numB },
      result,
      proof
    });
  };

  const handleReverseExport = () => {
    if (!validation) return;
    const userName =
      profile?.full_name?.split(' ')[0] ||
      (isArabic ? 'مستخدم Y HUB' : 'Y HUB User');
    exportToPDF({
      title: copy.reverseReport,
      userName,
      operation: revOperation,
      inputs: {
        [copy.givenA]: revA,
        [copy.targetResult]: revResult,
        [copy.guessedB]: userAnswerB,
      },
      result: validation.isCorrect ? copy.valid : copy.invalid,
      proof: validation.proof,
      isCorrect: validation.isCorrect
    });
  };

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
