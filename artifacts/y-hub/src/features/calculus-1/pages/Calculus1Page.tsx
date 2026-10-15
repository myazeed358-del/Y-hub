import * as React from 'react';
import { BlockMath } from 'react-katex';
import { MathSolutionSteps } from '@/components/math/MathSolutionSteps';
import { useLanguage } from '@/i18n/LanguageContext';
import {
  solveCalculus1Derivative,
  solveCalculus1Limit,
  type Calculus1Result,
} from '../services/calculus1Service';
import { solveCalculus1ImplicitDerivative } from '../services/implicitDifferentiationService';
import { solveCalculus1HigherOrderDerivative } from '../services/higherOrderDerivativeService';
import { solveCalculus1TangentNormal } from '../services/tangentNormalService';
import {
  studyCalculus1Function,
  type FunctionStudyResult
} from '../services/functionStudyService';
import { FunctionStudyResults } from '../components/FunctionStudyResults';
import 'katex/dist/katex.min.css';

type Operation = 'limits' | 'derivatives' | 'implicit' | 'higher-order' | 'tangent-normal' | 'function-study';

const DEFAULT_EXPRESSIONS: Record<Operation, string> = {
  limits: 'sin(x)/x',
  derivatives: 'x^2 + 3*x',
  implicit: 'x^2+y^2=25',
  'higher-order': 'x^4',
  'tangent-normal': 'x^2',
  'function-study': 'x^3-3*x'
};

export default function Calculus1Page() {
  const { language } = useLanguage();
  const ar = language === 'ar';

  const [operation, setOperation] =
    React.useState<Operation>('limits');
  const [expressions, setExpressions] =
    React.useState<Record<Operation, string>>({
      ...DEFAULT_EXPRESSIONS
    });

  const expression = expressions[operation];
  const [derivativeOrder, setDerivativeOrder] = React.useState(2);
  const [tangentPoint, setTangentPoint] = React.useState('3');
  const [point, setPoint] = React.useState('0');
  const [direction, setDirection] =
    React.useState<'both' | 'left' | 'right'>('both');

  const [result, setResult] =
    React.useState<Calculus1Result | null>(null);
  const [studyResult, setStudyResult] =
    React.useState<FunctionStudyResult | null>(null);
  const [isStudying, setIsStudying] = React.useState(false);
  const requestIdRef = React.useRef(0);
  const [error, setError] = React.useState<string | null>(null);

  async function solve(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const requestId = ++requestIdRef.current;

    setResult(null);
    setStudyResult(null);
    setError(null);
    setIsStudying(operation === 'function-study');

    try {
      if (operation === 'function-study') {
        const studied = await studyCalculus1Function(expression);

        if (requestId === requestIdRef.current) {
          setStudyResult(studied);
        }
      } else {
        const next = operation === 'limits'
          ? solveCalculus1Limit(expression, point, direction)
          : operation === 'implicit'
            ? solveCalculus1ImplicitDerivative(expression)
            : operation === 'higher-order'
              ? solveCalculus1HigherOrderDerivative(
                  expression,
                  derivativeOrder
                )
              : operation === 'tangent-normal'
                ? solveCalculus1TangentNormal(
                    expression,
                    tangentPoint
                  )
                : solveCalculus1Derivative(expression);

        if (requestId === requestIdRef.current) {
          setResult(next);
        }
      }
    } catch (unknownError) {
      if (requestId === requestIdRef.current) {
        setError(unknownError instanceof Error
          ? unknownError.message
          : 'Unexpected calculation error');
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setIsStudying(false);
      }
    }
  }

  return (
    <main
      className="mx-auto max-w-5xl space-y-6 p-4 md:p-8"
      dir={ar ? 'rtl' : 'ltr'}
    >
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground">
          {ar ? 'التفاضل والتكامل 1' : 'Calculus 1'}
        </h1>
        <p className="text-muted-foreground">
          {ar
            ? 'حل النهايات والمشتقات والاشتقاق الضمني باستخدام محركات Y-Hub الداخلية.'
            : 'Solve limits, derivatives and implicit differentiation using internal Y-Hub engines.'}
        </p>
      </header>

      <div role="tablist" aria-label="Calculus operations"
        className="flex flex-wrap gap-2">
        {(['limits', 'derivatives', 'implicit', 'higher-order', 'tangent-normal', 'function-study'] as const).map(item => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={operation === item}
            onClick={() => {
              requestIdRef.current += 1;
              setOperation(item);
              setResult(null);
              setStudyResult(null);
              setIsStudying(false);
              setError(null);
            }}
            className={`rounded-lg border px-5 py-3 font-semibold ${
              operation === item
                ? 'bg-primary text-primary-foreground'
                : 'bg-card text-foreground'
            }`}
          >
            {item === 'limits'
              ? (ar ? 'النهايات' : 'Limits')
              : item === 'derivatives'
                ? (ar ? 'الاشتقاق' : 'Derivatives')
                : item === 'implicit'
                  ? (ar ? 'الاشتقاق الضمني' : 'Implicit differentiation')
                  : item === 'higher-order'
                    ? (ar ? 'المشتقات العليا' : 'Higher-order derivatives')
                    : item === 'tangent-normal'
                      ? (ar ? 'المماس والعمودي' : 'Tangent & normal')
                      : (ar ? 'دراسة الدالة' : 'Function study')}
          </button>
        ))}
      </div>

      <form onSubmit={solve}
        className="space-y-5 rounded-xl border bg-card p-5">
        <div className="space-y-2">
          <label htmlFor="calc1-expression" className="font-semibold">
            {operation === 'implicit'
              ? (ar ? 'المعادلة الرياضية' : 'Mathematical equation')
              : (ar ? 'الدالة الرياضية' : 'Mathematical expression')}
          </label>
          <input
            id="calc1-expression"
            dir="ltr"
            required
            maxLength={1000}
            value={expression}
            onChange={event =>
              setExpressions(current => ({
                ...current,
                [operation]: event.target.value
              }))
            }
            placeholder={DEFAULT_EXPRESSIONS[operation]}
            className="w-full rounded-lg border bg-background p-3 font-mono text-foreground"
          />
        </div>

        {operation === 'implicit' && (
          <p className="text-sm text-muted-foreground">
            {ar
              ? 'الإصدار الحالي يدعم المعادلات كثيرة الحدود في x و y. النتيجة صالحة على المعادلة عندما Fy لا تساوي صفرًا.'
              : 'Currently supports polynomial equations in x and y. The result applies on the equation where Fy is nonzero.'}
          </p>
        )}

        {operation === 'tangent-normal' && (
          <div className="space-y-2">
            <label
              htmlFor="calc1-tangent-point"
              className="font-semibold"
            >
              {ar ? 'النقطة x =' : 'Point x ='}
            </label>
            <input
              id="calc1-tangent-point"
              dir="ltr"
              value={tangentPoint}
              required
              onChange={event =>
                setTangentPoint(event.target.value)
              }
              className="w-full rounded-lg border bg-background p-3 text-foreground"
            />
            <p className="text-sm text-muted-foreground">
              {ar
                ? 'حاليًا يدعم كثيرات الحدود في x، ويحسب النتائج بدقة كسرية.'
                : 'Currently supports polynomials in x with exact rational calculations.'}
            </p>
          </div>
        )}

        {operation === 'higher-order' && (
          <div className="space-y-2">
            <label
              htmlFor="calc1-derivative-order"
              className="font-semibold"
            >
              {ar ? 'رتبة المشتقة' : 'Derivative order'}
            </label>
            <input
              id="calc1-derivative-order"
              type="number"
              min={1}
              max={6}
              step={1}
              required
              value={derivativeOrder}
              onChange={event =>
                setDerivativeOrder(Number(event.target.value))
              }
              className="w-full rounded-lg border bg-background p-3 text-foreground"
            />
          </div>
        )}

        {operation === 'limits' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="calc1-point" className="font-semibold">
                {ar ? 'نقطة الاقتراب' : 'Approach point'}
              </label>
              <input
                id="calc1-point"
                dir="ltr"
                required
                value={point}
                onChange={event => setPoint(event.target.value)}
                className="w-full rounded-lg border bg-background p-3 text-foreground"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="calc1-direction" className="font-semibold">
                {ar ? 'الاتجاه' : 'Direction'}
              </label>
              <select
                id="calc1-direction"
                value={direction}
                onChange={event =>
                  setDirection(event.target.value as typeof direction)}
                className="w-full rounded-lg border bg-background p-3 text-foreground"
              >
                <option value="both">{ar ? 'الطرفان' : 'Both sides'}</option>
                <option value="left">{ar ? 'اليسار' : 'Left'}</option>
                <option value="right">{ar ? 'اليمين' : 'Right'}</option>
              </select>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={isStudying}
          className="rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground"
        >
          {isStudying
            ? (ar ? 'جارٍ تحليل الدالة...' : 'Analyzing function...')
            : (ar ? 'احسب' : 'Calculate')}
        </button>
      </form>

      {error && (
        <div role="alert"
          className="rounded-lg border border-destructive p-4 text-destructive">
          {error}
        </div>
      )}

      {studyResult && operation === 'function-study' && (
        <FunctionStudyResults
          result={studyResult}
          language={language}
        />
      )}

      {result && (
        <section aria-label="Calculation result"
          className="space-y-4 rounded-xl border bg-card p-5">
          <h2 className="text-xl font-bold">
            {ar ? 'النتيجة' : 'Result'}
          </h2>

          {result.status === 'computed' && result.latex
            ? <div dir="ltr" className="overflow-x-auto">
                <BlockMath math={result.latex} />
              </div>
            : <p className="text-muted-foreground">
                {ar
                  ? 'لم يتمكن المحرك من إثبات نتيجة لهذه الحالة.'
                  : 'The engine could not establish a result for this case.'}
              </p>}

          <p className="text-sm text-muted-foreground">
            {ar ? 'الطريقة:' : 'Method:'} {result.method}
          </p>

          {result.steps.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold">
                {ar ? 'القواعد المستخدمة' : 'Applied rules'}
              </h3>
              <MathSolutionSteps
                steps={result.steps}
                language={language}
              />
            </div>
          )}

          {result.warnings.length > 0 && (
            <div className="space-y-1 text-sm text-muted-foreground">
              {result.warnings.map((warning, index) =>
                <p key={index}>{warning}</p>
              )}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
