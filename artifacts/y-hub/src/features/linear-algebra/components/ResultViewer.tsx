import * as React from 'react';
import type { LinearAlgebraResult } from '@/services/math/linear_algebra/types';
import type { CanonicalAST } from '@/services/math/types/ast';
import { Rat } from '@/services/math/utils/rational';

interface ResultViewerProps {
  result: LinearAlgebraResult;
  language: 'ar' | 'en';
}

function formatAst(node: CanonicalAST): string {
  if (node.type === 'Number') return node.value;

  if (node.type === 'Operator' && node.args.length === 2) {
    const [left, right] = node.args;

    if (
      node.operator === '-' &&
      left.type === 'Number' &&
      left.value === '0'
    ) {
      return `-${formatAst(right)}`;
    }

    if (node.operator === '/') {
      return `${formatAst(left)}/${formatAst(right)}`;
    }
  }

  return '[Unsupported expression]';
}

export function ResultViewer({
  result,
  language,
}: ResultViewerProps) {
  const ar = language === 'ar';

  const success =
    result.status === 'solved' ||
    result.status === 'completed';

  const system = result.linearSystem;

  const systemMessages = {
    unique: ar ? 'حل وحيد' : 'Unique solution',
    infinitely_many: ar
      ? 'عدد لا نهائي من الحلول'
      : 'Infinitely many solutions',
    inconsistent: ar ? 'لا يوجد حل' : 'No solution',
  };

  const statusMessages: Record<string, string> = {
    no_solution: ar ? 'لا يوجد حل أو معكوس' : 'No solution or inverse',
    unsupported: ar ? 'عملية غير مدعومة' : 'Unsupported operation',
    invalid_input: ar ? 'مدخلات غير صالحة' : 'Invalid input',
    resource_limit: ar ? 'تم تجاوز حدود الموارد' : 'Resource limit reached',
    not_established: ar ? 'لم يتم إثبات النتيجة' : 'Result not established',
    infinitely_many_solutions: ar
      ? 'عدد لا نهائي من الحلول'
      : 'Infinitely many solutions',
  };

  return (
    <section
      className="space-y-4 rounded-xl border bg-card p-5 text-card-foreground"
      aria-label={ar ? 'نتيجة الجبر الخطي' : 'Linear algebra result'}
    >
      <h2 className="text-xl font-bold">
        {ar ? 'نتيجة الحساب' : 'Calculation Result'}
      </h2>

      <p
        role="status"
        className={success ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}
      >
        {success
          ? ar ? 'تم تنفيذ العملية' : 'Calculation completed'
          : statusMessages[result.status] ?? result.status}
      </p>

      {result.resultScalar && (
        <div className="space-y-2">
          <h3 className="font-semibold">
            {ar ? 'القيمة الناتجة' : 'Resulting value'}
          </h3>
          <p className="text-xl font-mono" dir="ltr">
            {formatAst(result.resultScalar)}
          </p>
        </div>
      )}

      {result.resultMatrix && (
        <div className="space-y-2">
          <h3 className="font-semibold">
            {ar ? 'المصفوفة الناتجة' : 'Result Matrix'}
          </h3>
          <div className="overflow-x-auto">
            <table className="border-separate border-spacing-2" dir="ltr">
              <tbody>
                {result.resultMatrix.map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => (
                      <td
                        key={j}
                        className="min-w-16 rounded border bg-background p-3 text-center font-mono"
                      >
                        {formatAst(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {system && (
        <div className="space-y-3">
          <h3 className="font-semibold">
            {ar ? 'تصنيف النظام الخطي' : 'Linear System Classification'}
          </h3>

          <p>{systemMessages[system.systemType]}</p>

          {system.solution && (
            <div dir="ltr" className="font-mono">
              {system.solution.map((value, i) => (
                <p key={i}>
                  x{i + 1} = {Rat.toString(value)}
                </p>
              ))}
            </div>
          )}

          {system.parametricSolution && (
            <div className="space-y-2 font-mono" dir="ltr">
              <p>
                Base = (
                {system.parametricSolution.base.map(Rat.toString).join(', ')}
                )
              </p>
              {system.parametricSolution.nullSpaceBasis.map((basis, i) => (
                <p key={i}>
                  Basis {i + 1} = ({basis.map(Rat.toString).join(', ')})
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {result.operation === 'rref' &&
        result.explanationSteps &&
        result.explanationSteps.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-semibold">
              {ar ? 'عمليات الصفوف المسجلة' : 'Recorded Row Operations'}
            </h3>

            <ol className="list-decimal space-y-1 ps-6" dir="ltr">
              {result.explanationSteps.map((step, i) => {
                const row1 = step.row1 + 1;
                const row2 = step.row2 === undefined
                  ? null
                  : step.row2 + 1;

                let text = step.type;

                if (step.type === 'swap') {
                  text = `R${row1} ↔ R${row2}`;
                } else if (step.type === 'scale') {
                  text = `R${row1} ← (${Rat.toString(step.scalar)}) R${row1}`;
                } else if (step.type === 'add_multiple') {
                  text = `R${row1} ← R${row1} + (${Rat.toString(step.scalar)}) R${row2}`;
                }

                return <li key={i} className="font-mono text-sm">{text}</li>;
              })}
            </ol>
          </div>
        )}

      {result.warnings && result.warnings.length > 0 && (
        <div role="alert" className="space-y-1 text-sm text-destructive">
          {result.warnings.map((warning, i) => (
            <p key={i}>{warning}</p>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {result.exactness === 'exact_symbolic'
          ? ar ? 'حساب رمزي دقيق' : 'Exact symbolic calculation'
          : ar ? 'نتيجة عددية تقريبية' : 'Numerical approximation'}
      </p>
    </section>
  );
}
