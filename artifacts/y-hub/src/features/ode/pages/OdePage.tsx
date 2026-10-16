import * as React from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import type { CanonicalAST } from '@/services/math/types/ast';
import type { ODEResult } from '@/services/math/types/ode';
import {
  solveODE,
  type OdeFormInput,
} from '../application/odeService';

const EXAMPLES = [
  { name: 'Separable', equation: "y'=x*y" },
  { name: 'Linear', equation: "y'+y=x" },
  { name: 'Second order', equation: "y''+y=0" },
  { name: 'Numerical', equation: "y'=y" },
];

const INITIAL: OdeFormInput = {
  expression: "y'=x*y",
  mode: 'symbolic',
  includeInitialConditions: false,
  x0: '0',
  y0: '1',
  method: 'rk4',
  stepSize: '0.1',
  steps: '20',
};

function formatAst(node: CanonicalAST): string {
  switch (node.type) {
    case 'Number':
      return node.value;
    case 'Symbol':
      return node.name
        .replace('y_triple_prime', "y'''")
        .replace('y_double_prime', "y''")
        .replace('y_prime', "y'");
    case 'Constant':
      return node.name;
    case 'Parenthesis':
      return `(${formatAst(node.content)})`;
    case 'Function':
      return `${node.name}(${node.args.map(formatAst).join(', ')})`;
    case 'Equation':
      return `${formatAst(node.lhs)} = ${formatAst(node.rhs)}`;
    case 'Operator':
      if (node.args.length === 1) {
        return `${node.operator}${formatAst(node.args[0])}`;
      }
      return `(${node.args.map(formatAst).join(
        node.operator === 'implicit_multiply'
          ? ' * '
          : ` ${node.operator} `,
      )})`;
    case 'Vector':
      return `[${node.elements.map(formatAst).join(', ')}]`;
    case 'Matrix':
      return `[${node.rows.map(row =>
        `[${row.map(formatAst).join(', ')}]`,
      ).join(', ')}]`;
    case 'Inequality':
      return `${formatAst(node.lhs)} ${node.operator} ${formatAst(node.rhs)}`;
  }
}

function NumericalGraph({
  points,
}: {
  points: { x: number; y: number }[];
}) {
  const valid = points.filter(
    point => Number.isFinite(point.x) && Number.isFinite(point.y),
  );

  if (valid.length < 2) return null;

  const xs = valid.map(p => p.x);
  const ys = valid.map(p => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const dx = Math.max(maxX - minX, 1e-9);
  const dy = Math.max(maxY - minY, 1e-9);

  const line = valid.map(p => {
    const x = 30 + ((p.x - minX) / dx) * 540;
    const y = 250 - ((p.y - minY) / dy) * 210;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');

  return (
    <div className="rounded-xl border bg-background p-3">
      <svg
        viewBox="0 0 600 290"
        role="img"
        aria-label="Numerical ODE solution graph"
        className="w-full"
      >
        <line x1="30" y1="250" x2="575" y2="250"
          stroke="currentColor" opacity="0.25" />
        <line x1="30" y1="35" x2="30" y2="250"
          stroke="currentColor" opacity="0.25" />
        <polyline
          points={line}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <text x="30" y="274" fill="currentColor" fontSize="12">
          x = {minX.toPrecision(4)}
        </text>
        <text x="480" y="274" fill="currentColor" fontSize="12">
          {maxX.toPrecision(4)}
        </text>
        <text x="35" y="25" fill="currentColor" fontSize="12">
          y: {minY.toPrecision(4)} … {maxY.toPrecision(4)}
        </text>
      </svg>
    </div>
  );
}

export default function OdePage() {
  const { language } = useLanguage();
  const ar = language === 'ar';

  const [input, setInput] = React.useState<OdeFormInput>(INITIAL);
  const [result, setResult] = React.useState<ODEResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const requestId = React.useRef(0);

  function change<K extends keyof OdeFormInput>(
    key: K,
    value: OdeFormInput[K],
  ) {
    requestId.current++;
    setInput(current => ({ ...current, [key]: value }));
    setResult(null);
    setError(null);
    setLoading(false);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const id = ++requestId.current;
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const next = await solveODE(input);
      if (id === requestId.current) setResult(next);
    } catch (cause) {
      if (id === requestId.current) {
        setError(
          cause instanceof Error
            ? cause.message
            : 'Unexpected ODE calculation error',
        );
      }
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }

  const solutions = result
    ? [
        ...result.solutions,
        ...(result.particularSolution
          ? [result.particularSolution]
          : []),
      ]
    : [];

  return (
    <main
      dir={ar ? 'rtl' : 'ltr'}
      className="mx-auto max-w-6xl space-y-6 p-4 md:p-8"
    >
      <header className="space-y-2">
        <h1 className="text-2xl font-bold md:text-3xl">
          {ar ? 'محرك المعادلات التفاضلية' : 'Differential Equations Engine'}
        </h1>
        <p className="text-muted-foreground">
          {ar
            ? 'حل المعادلات التفاضلية وعرض الطرق والخطوات والنتائج العددية ضمن الحالات المدعومة.'
            : 'Explore differential equations, solution methods, steps and numerical results.'}
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-2xl border bg-card p-5"
      >
        <div className="space-y-2">
          <label htmlFor="ode-expression" className="font-semibold">
            {ar ? 'أدخل المعادلة التفاضلية' : 'Differential equation'}
          </label>
          <input
            id="ode-expression"
            dir="ltr"
            value={input.expression}
            onChange={e => change('expression', e.target.value)}
            className="h-12 w-full rounded-lg border bg-background px-4 font-mono text-foreground"
            placeholder="y' = x*y"
            disabled={loading}
          />
          <p className="text-xs text-muted-foreground">
            {ar
              ? "استخدم y' للمشتقة الأولى، وy'' للثانية، وy''' للثالثة."
              : "Use y', y'' and y''' for derivatives."}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map(example => (
            <button
              key={example.name}
              type="button"
              disabled={loading}
              className="rounded-lg border px-3 py-2 text-sm hover:bg-accent"
              onClick={() => {
                change('expression', example.equation);
                if (example.name === 'Numerical') {
                  change('mode', 'numerical');
                } else {
                  change('mode', 'symbolic');
                }
              }}
            >
              {example.name}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          <label htmlFor="ode-mode" className="font-semibold">
            {ar ? 'نوع الحل' : 'Solution mode'}
          </label>
          <select
            id="ode-mode"
            value={input.mode}
            onChange={e => change(
              'mode',
              e.target.value as OdeFormInput['mode'],
            )}
            disabled={loading}
            className="block h-11 w-full max-w-sm rounded-lg border bg-background px-3"
          >
            <option value="symbolic">
              {ar ? 'حل رمزي' : 'Symbolic'}
            </option>
            <option value="numerical">
              {ar ? 'حل عددي' : 'Numerical'}
            </option>
          </select>
        </div>

        {input.mode === 'symbolic' && (
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={input.includeInitialConditions}
              onChange={e => change(
                'includeInitialConditions',
                e.target.checked,
              )}
              disabled={loading}
            />
            {ar ? 'إضافة شروط ابتدائية' : 'Add initial conditions'}
          </label>
        )}

        {(input.includeInitialConditions ||
          input.mode === 'numerical') && (
          <div className="grid gap-4 sm:grid-cols-2">
            {(['x0', 'y0'] as const).map(field => (
              <label key={field} className="space-y-2">
                <span className="block font-semibold">
                  {field === 'x0' ? 'x₀' : 'y₀'}
                </span>
                <input
                  dir="ltr"
                  inputMode="decimal"
                  value={input[field]}
                  onChange={e => change(field, e.target.value)}
                  disabled={loading}
                  className="h-11 w-full rounded-lg border bg-background px-3"
                />
              </label>
            ))}
          </div>
        )}

        {input.mode === 'numerical' && (
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="space-y-2">
              <span className="block font-semibold">
                {ar ? 'الطريقة' : 'Method'}
              </span>
              <select
                value={input.method}
                onChange={e => change(
                  'method',
                  e.target.value as OdeFormInput['method'],
                )}
                disabled={loading}
                className="h-11 w-full rounded-lg border bg-background px-3"
              >
                <option value="euler">Euler</option>
                <option value="heun">Heun</option>
                <option value="rk4">Runge–Kutta 4</option>
              </select>
            </label>
            {(['stepSize', 'steps'] as const).map(field => (
              <label key={field} className="space-y-2">
                <span className="block font-semibold">
                  {field === 'stepSize'
                    ? ar ? 'حجم الخطوة' : 'Step size'
                    : ar ? 'عدد الخطوات' : 'Steps'}
                </span>
                <input
                  dir="ltr"
                  inputMode="decimal"
                  value={input[field]}
                  onChange={e => change(field, e.target.value)}
                  disabled={loading}
                  className="h-11 w-full rounded-lg border bg-background px-3"
                />
              </label>
            ))}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="min-h-12 rounded-lg bg-primary px-6 font-bold text-primary-foreground disabled:opacity-50"
        >
          {loading
            ? ar ? 'جاري الحل...' : 'Solving...'
            : ar ? 'حل المعادلة' : 'Solve equation'}
        </button>
      </form>

      {error && (
        <section role="alert"
          className="rounded-xl border border-destructive p-4 text-destructive">
          {error}
        </section>
      )}

      {result && (
        <section
          className="space-y-5 rounded-2xl border bg-card p-5"
          aria-label="ODE result"
        >
          <h2 className="text-xl font-bold">
            {ar ? 'نتيجة الحل' : 'Solution result'}
          </h2>

          <div className="flex flex-wrap gap-2 text-sm">
            <span className="rounded-lg border px-3 py-1">
              {result.status}
            </span>
            <span className="rounded-lg border px-3 py-1">
              {result.classification}
            </span>
          </div>

          {solutions.length === 0 && !result.numerical && (
            <p className="text-muted-foreground">
              {ar
                ? 'لم يتمكن المحرك من إثبات حل لهذه الحالة.'
                : 'The engine could not establish a solution.'}
            </p>
          )}

          {solutions.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold">
                {ar ? 'الحلول' : 'Solutions'}
              </h3>
              {solutions.map((solution, index) => (
                <div key={index}
                  className="space-y-2 rounded-xl border bg-background p-4">
                  <div dir="ltr"
                    className="overflow-x-auto whitespace-pre-wrap break-words font-mono">
                    {formatAst(solution.equation)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {solution.type}
                  </p>
                  {solution.assumptions?.map((assumption, i) => (
                    <p key={i} className="text-sm text-muted-foreground">
                      {assumption}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          )}

          {result.numerical && (
            <div className="space-y-3">
              <h3 className="font-semibold">
                {ar ? 'الحل العددي' : 'Numerical solution'}
              </h3>
              <p className="text-sm">
                {result.numerical.convergenceStatus}
              </p>
              {result.numerical.finalValue !== null && (
                <p dir="ltr" className="font-mono text-lg">
                  y(final) = {result.numerical.finalValue}
                </p>
              )}
              <NumericalGraph points={result.numerical.points} />
            </div>
          )}

          {result.trace.length > 0 && (
            <details className="rounded-xl border p-4" open>
              <summary className="cursor-pointer font-semibold">
                {ar ? 'خطوات الحل' : 'Solution steps'}
                {' '}({result.trace.length})
              </summary>
              <ol className="mt-4 list-decimal space-y-4 ps-6">
                {result.trace.map((step, index) => (
                  <li key={index} className="space-y-1 text-sm">
                    <p className="font-semibold">{step.strategy}</p>
                    <p className="whitespace-pre-wrap break-words">
                      {step.transformation}
                    </p>
                    <p dir="ltr"
                      className="overflow-x-auto break-words font-mono text-muted-foreground">
                      {formatAst(step.resultingExpression)}
                    </p>
                  </li>
                ))}
              </ol>
            </details>
          )}

          {result.warnings.length > 0 && (
            <div role="alert" className="space-y-2 text-sm text-amber-700 dark:text-amber-300">
              {result.warnings.map((warning, i) => (
                <p key={i}>{warning}</p>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
