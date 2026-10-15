import * as React from 'react';
import { BlockMath } from 'react-katex';
import { MathSolutionSteps } from '@/components/math/MathSolutionSteps';
import { useLanguage } from '@/i18n/LanguageContext';
import {
  solveCalculus1Derivative,
  solveCalculus1Limit,
  type Calculus1Result,
} from '../services/calculus1Service';
import 'katex/dist/katex.min.css';

type Operation = 'limits' | 'derivatives';

export default function Calculus1Page() {
  const { language } = useLanguage();
  const ar = language === 'ar';

  const [operation, setOperation] =
    React.useState<Operation>('limits');
  const [expression, setExpression] = React.useState('sin(x)/x');
  const [point, setPoint] = React.useState('0');
  const [direction, setDirection] =
    React.useState<'both' | 'left' | 'right'>('both');

  const [result, setResult] =
    React.useState<Calculus1Result | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  function solve(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(null);
    setError(null);

    try {
      const next = operation === 'limits'
        ? solveCalculus1Limit(expression, point, direction)
        : solveCalculus1Derivative(expression);

      setResult(next);
    } catch (unknownError) {
      setError(unknownError instanceof Error
        ? unknownError.message
        : 'Unexpected calculation error');
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
            ? 'حل النهايات والمشتقات باستخدام محركات Y-Hub الداخلية.'
            : 'Solve limits and derivatives using internal Y-Hub engines.'}
        </p>
      </header>

      <div role="tablist" aria-label="Calculus operations"
        className="flex flex-wrap gap-2">
        {(['limits', 'derivatives'] as const).map(item => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={operation === item}
            onClick={() => {
              setOperation(item);
              setResult(null);
              setError(null);
            }}
            className={`rounded-lg border px-5 py-3 font-semibold ${
              operation === item
                ? 'bg-primary text-primary-foreground'
                : 'bg-card text-foreground'
            }`}
          >
            {item === 'limits'
              ? ar ? 'النهايات' : 'Limits'
              : ar ? 'الاشتقاق' : 'Derivatives'}
          </button>
        ))}
      </div>

      <form onSubmit={solve}
        className="space-y-5 rounded-xl border bg-card p-5">
        <div className="space-y-2">
          <label htmlFor="calc1-expression" className="font-semibold">
            {ar ? 'الدالة الرياضية' : 'Mathematical expression'}
          </label>
          <input
            id="calc1-expression"
            dir="ltr"
            required
            maxLength={1000}
            value={expression}
            onChange={event => setExpression(event.target.value)}
            placeholder="x^2 + 3*x"
            className="w-full rounded-lg border bg-background p-3 font-mono text-foreground"
          />
        </div>

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
          className="rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground"
        >
          {ar ? 'احسب' : 'Calculate'}
        </button>
      </form>

      {error && (
        <div role="alert"
          className="rounded-lg border border-destructive p-4 text-destructive">
          {error}
        </div>
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
