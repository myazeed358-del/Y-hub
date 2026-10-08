import { useState, useMemo } from 'react';
import {
  tNormStandard,
  tNormAlgebraic,
  tNormBounded,
  tNormDrastic,
} from '@/utils/fuzzyLogic';
import { generateReverseTNormChallenge, validateReverseChallenge, type TNormType } from '@/utils/reverseEngine';
import { exportToPDF } from '@/utils/pdfExport';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@workspace/y-hub-ds/components/ui/card';
import { Input } from '@workspace/y-hub-ds/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@workspace/y-hub-ds/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@workspace/y-hub-ds/components/ui/tabs';
import { Button } from '@workspace/y-hub-ds/components/ui/button';
import { ArrowLeft, BrainCircuit, RefreshCw, CheckCircle2, XCircle, Download } from 'lucide-react';
import { Link } from 'wouter';
import { useLanguage } from '../App';

export default function Solver() {
  const { t, language } = useLanguage();
  const isArabic = language === 'ar';

  const copy = isArabic
    ? {
        back: 'العودة إلى المنصة',
        kicker: 'منطق ضبابي تفاعلي',
        title: 'المنطق الضبابي',
        selectOperation: 'اختر العملية',
        standard: 'التقاطع القياسي (min)',
        algebraic: 'الضرب الجبري',
        bounded: 'الفرق المحدود',
        drastic: 'الضرب الحاد',
        findMissing: 'أوجد القيمة المفقودة',
        newChallenge: 'تحدٍ جديد',
        operation: 'العملية',
        givenA: 'القيمة المعطاة A',
        targetResult: 'النتيجة المطلوبة',
        whatB: 'ما القيمة المطلوبة للمدخل B؟',
        enterB: 'أدخل قيمة B...',
        check: 'تحقق',
        noSolution: 'سؤال خدعة: قد لا توجد قيمة صحيحة لـ B.',
        rangeSolution: 'قد توجد عدة قيم صحيحة. أدخل أي قيمة صالحة لـ B.',
        validationProof: 'برهان التحقق',
        downloadProof: 'تنزيل البرهان',
        enterAndCheck: 'أدخل إجابتك واضغط تحقق لعرض البرهان الجبري.',
        correct: 'إجابة صحيحة!',
        incorrect: 'إجابة غير صحيحة',
        algebraicSteps: 'الخطوات الجبرية بالتفصيل',
        forwardReport: 'تقرير الحساب المباشر',
        reverseReport: 'تقرير التحدي العكسي',
        inputA: 'المدخل A (μ_A)',
        inputB: 'المدخل B (μ_B)',
        guessedB: 'قيمة B المدخلة',
        valid: 'صحيح',
        invalid: 'غير صحيح',
      }
    : {
        back: 'Back to Platform',
        kicker: 'INTERACTIVE FUZZY LOGIC',
        title: 'Fuzzy Logic',
        selectOperation: 'Select operation',
        standard: 'Standard Intersection (min)',
        algebraic: 'Algebraic Product',
        bounded: 'Bounded Difference',
        drastic: 'Drastic Product',
        findMissing: 'Find the Missing Input',
        newChallenge: 'New Challenge',
        operation: 'Operation',
        givenA: 'Given Input A',
        targetResult: 'Target Result',
        whatB: 'What must Input B be?',
        enterB: 'Enter value for B...',
        check: 'Check',
        noSolution: 'Trick question: there may be no valid value for B.',
        rangeSolution: 'Multiple values may be correct. Enter any valid value for B.',
        validationProof: 'Validation Proof',
        downloadProof: 'Download Proof',
        enterAndCheck: 'Enter your answer and click Check to see the algebraic proof.',
        correct: 'Correct Answer!',
        incorrect: 'Incorrect',
        algebraicSteps: 'Algebraic Step-by-Step',
        forwardReport: 'Forward Calculation Report',
        reverseReport: 'Reverse Challenge Report',
        inputA: 'Input A (μ_A)',
        inputB: 'Input B (μ_B)',
        guessedB: 'User Guessed B',
        valid: 'Valid',
        invalid: 'Invalid',
      };
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

        <TabsContent value="forward">
          <div className="grid gap-8 md:grid-cols-2">
            <Card className="p-6">
              <h2 className="text-lg font-bold mb-4">{t('inputParams')}</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-semibold mb-1 block">{t('membershipValueA')}</label>
                  <Input type="number" step="0.1" min="0" max="1" value={a} onChange={(e) => setA(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-semibold mb-1 block">{t('membershipValueB')}</label>
                  <Input type="number" step="0.1" min="0" max="1" value={b} onChange={(e) => setB(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-semibold mb-1 block">{t('tnormOp')}</label>
                  <Select value={tnorm} onValueChange={(val) => setTnorm(val as TNormType)}>
                    <SelectTrigger>
                      <SelectValue placeholder={copy.selectOperation} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">{copy.standard}</SelectItem>
                      <SelectItem value="algebraic">{copy.algebraic}</SelectItem>
                      <SelectItem value="bounded">{copy.bounded}</SelectItem>
                      <SelectItem value="drastic">{copy.drastic}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-[hsl(var(--sidebar))] text-[hsl(var(--sidebar-foreground))] relative">
              <div className="mb-8 flex items-center justify-between">
                <h2 className="text-xl font-extrabold">{t('proofEngine')}</h2>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleForwardExport} className="gap-2 bg-[hsl(var(--card))]">
                    <Download size={14} /> {t('exportPdf')}
                  </Button>
                  <div className="rounded-xl bg-[hsl(var(--sidebar-accent))] p-2.5 text-[hsl(var(--accent))]">
                    <BrainCircuit size={18} />
                  </div>
                </div>
              </div>
              <div className="mb-8">
                <div className="mb-2 text-sm font-semibold opacity-60 uppercase tracking-widest">{t('finalResult')}</div>
                <div className="text-5xl font-mono text-[hsl(var(--accent))] tracking-tighter">{result}</div>
              </div>
              <div>
                <div className="mb-3 text-sm font-semibold opacity-60">{t('algebraicStep')}</div>
                <div className="rounded-xl bg-[hsl(var(--background))] p-4 font-mono text-sm leading-relaxed overflow-x-auto border border-[hsl(var(--border))]">
                  $$ {proof} $$
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="reverse">
          <div className="grid gap-8 md:grid-cols-2">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">{copy.findMissing}</h2>
                <Button variant="outline" size="sm" onClick={generateNewChallenge} className="gap-2">
                  <RefreshCw size={14} /> {copy.newChallenge}
                </Button>
              </div>
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-[hsl(var(--muted)/.5)] space-y-2 border border-[hsl(var(--border))]">
                  <div className="flex justify-between">
                    <span className="text-sm text-[hsl(var(--muted-foreground))]">{copy.operation}</span>
                    <span className="font-mono font-bold capitalize text-[hsl(var(--primary))]">{revOperation} T-norm</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-[hsl(var(--muted-foreground))]">{copy.givenA}</span>
                    <span className="font-mono font-bold text-[hsl(var(--foreground))]">{revA}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-[hsl(var(--muted-foreground))]">{copy.targetResult}</span>
                    <span className="font-mono font-bold text-[hsl(var(--foreground))]">{revResult}</span>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold mb-2 block">{copy.whatB}</label>
                  <div className="flex gap-3">
                    <Input
                      type="number" step="0.01" min="0" max="1"
                      placeholder={copy.enterB}
                      value={userAnswerB}
                      onChange={(e) => setUserAnswerB(e.target.value)}
                    />
                    <Button onClick={handleValidate} disabled={userAnswerB === ''}>{copy.check}</Button>
                  </div>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mt-2">
                    {challenge.solutionType === 'none' && copy.noSolution}
                    {challenge.solutionType === 'range' && copy.rangeSolution}
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-[hsl(var(--sidebar))] text-[hsl(var(--sidebar-foreground))] relative">
              <div className="mb-8 flex items-center justify-between">
                <h2 className="text-xl font-extrabold">{copy.validationProof}</h2>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleReverseExport} disabled={!validation} className="gap-2 bg-[hsl(var(--card))]">
                    <Download size={14} /> {copy.downloadProof}
                  </Button>
                  <div className="rounded-xl bg-[hsl(var(--sidebar-accent))] p-2.5 text-[hsl(var(--accent))]">
                    <BrainCircuit size={18} />
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                {!validation ? (
                  <div className="text-sm text-[hsl(var(--sidebar-foreground)/.6)] text-center py-10">
                    {copy.enterAndCheck}
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      {validation.isCorrect ? (
                         <CheckCircle2 size={32} className="text-[hsl(var(--primary))]" />
                      ) : (
                         <XCircle size={32} className="text-[hsl(var(--destructive))]" />
                      )}
                      <div>
                        <div className={`font-bold ${validation.isCorrect ? 'text-[hsl(var(--primary))]' : 'text-[hsl(var(--destructive))]'}`}>
                          {validation.isCorrect ? copy.correct : copy.incorrect}
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm text-[hsl(var(--sidebar-foreground)/.6)] mb-2">{copy.algebraicSteps}</h3>
                      <div className="bg-[hsl(var(--background))] text-[hsl(var(--foreground))] p-4 rounded-xl border border-[hsl(var(--border))] font-mono overflow-x-auto whitespace-pre">
                        {`$$ ${validation.proof} $$`}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
