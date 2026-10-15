import * as React from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import type { LinearAlgebraResult } from '@/services/math/linear_algebra/types';

import { MatrixEditor } from '../components/MatrixEditor';
import { ResultViewer } from '../components/ResultViewer';

import {
  solveLinearAlgebra,
  type BasicLinearAlgebraOperation,
} from '../application/linearAlgebraService';

const OPERATIONS: {
  value: BasicLinearAlgebraOperation;
  ar: string;
  en: string;
}[] = [
  { value: 'determinant', ar: 'حساب المحدد', en: 'Determinant' },
  { value: 'inverse', ar: 'معكوس المصفوفة', en: 'Matrix Inverse' },
  { value: 'rref', ar: 'اختزال المصفوفة RREF', en: 'Row Reduction (RREF)' },
  { value: 'solve_system', ar: 'حل نظام خطي', en: 'Solve Linear System' },
];

export default function LinearAlgebraPage() {
  const { language } = useLanguage();
  const ar = language === 'ar';

  const [operation, setOperation] =
    React.useState<BasicLinearAlgebraOperation>('determinant');

  const [matrix, setMatrix] = React.useState<string[][]>([
    ['1', '2'],
    ['3', '4'],
  ]);

  const [vector, setVector] = React.useState<string[]>(['5', '6']);

  const [result, setResult] =
    React.useState<LinearAlgebraResult | null>(null);

  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  function clearResult() {
    setResult(null);
    setError(null);
  }

  function updateMatrix(next: string[][]) {
    setMatrix(next);

    setVector(current =>
      Array.from(
        { length: next.length },
        (_, i) => current[i] ?? '0'
      )
    );

    clearResult();
  }

  async function handleSolve(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) return;

    setLoading(true);
    clearResult();

    try {
      const calculation = await solveLinearAlgebra({
        operation,
        matrix,
        vector: operation === 'solve_system' ? vector : undefined,
      });

      setResult(calculation);
    } catch (unknownError) {
      setError(
        unknownError instanceof Error
          ? unknownError.message
          : 'Unexpected calculation error'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      className="mx-auto max-w-6xl space-y-6 p-4 md:p-8"
      dir={ar ? 'rtl' : 'ltr'}
    >
      <header className="space-y-2">
        <h1 className="text-2xl font-bold md:text-3xl">
          {ar ? 'محرك الجبر الخطي' : 'Linear Algebra Engine'}
        </h1>

        <p className="text-muted-foreground">
          {ar
            ? 'أدخل المصفوفة، اختر العملية الرياضية، وشاهد النتيجة.'
            : 'Enter a matrix, select an operation, and view the result.'}
        </p>
      </header>

      <form onSubmit={handleSolve} className="space-y-6">
        <section className="space-y-3">
          <label htmlFor="linear-algebra-operation" className="font-semibold">
            {ar ? 'اختر العملية الرياضية' : 'Choose an operation'}
          </label>

          <select
            id="linear-algebra-operation"
            value={operation}
            disabled={loading}
            onChange={event => {
              setOperation(event.target.value as BasicLinearAlgebraOperation);
              clearResult();
            }}
            className="block h-12 w-full max-w-md rounded-lg border bg-background px-3 text-foreground"
          >
            {OPERATIONS.map(item => (
              <option key={item.value} value={item.value}>
                {ar ? item.ar : item.en}
              </option>
            ))}
          </select>
        </section>

        <MatrixEditor
          value={matrix}
          onChange={updateMatrix}
          language={language}
          title={ar ? 'المصفوفة A' : 'Matrix A'}
          disabled={loading}
        />

        {operation === 'solve_system' && (
          <section className="space-y-3 rounded-xl border bg-card p-4">
            <h2 className="text-lg font-semibold">
              {ar ? 'متجه الثوابت b' : 'Constants Vector b'}
            </h2>

            <div className="flex flex-wrap gap-2" dir="ltr">
              {vector.map((value, i) => (
                <label key={i} className="space-y-1 text-sm">
                  <span className="block">b{i + 1}</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={value}
                    disabled={loading}
                    onChange={event => {
                      setVector(current =>
                        current.map((cell, j) =>
                          i === j ? event.target.value : cell
                        )
                      );
                      clearResult();
                    }}
                    className="h-11 w-20 rounded-md border bg-background px-2 text-center"
                  />
                </label>
              ))}
            </div>
          </section>
        )}

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-destructive p-4 text-destructive"
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="min-h-12 w-full rounded-lg bg-primary px-6 py-3 font-bold text-primary-foreground disabled:opacity-50 md:w-auto"
        >
          {loading
            ? ar ? 'جاري الحساب...' : 'Calculating...'
            : ar ? 'احسب النتيجة' : 'Calculate'}
        </button>
      </form>

      {result && (
        <ResultViewer result={result} language={language} />
      )}
    </main>
  );
}
