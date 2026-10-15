import * as React from 'react';
import * as math from 'mathjs';
import { MathSolutionSteps } from '@/components/math/MathSolutionSteps';
import { BlockMath } from 'react-katex';
import type {
  FunctionStudyResult
} from '../services/functionStudyService';

interface Props {
  result: FunctionStudyResult;
  language: 'ar' | 'en';
}

function DerivativeDisplay({
  expression
}: {
  expression: string;
}) {
  let latex: string | null = null;

  try {
    latex = math.parse(expression).toTex();
  } catch {
    // A formatting failure must not hide the computed text.
  }

  return (
    <div dir="ltr" className="overflow-x-auto">
      {latex
        ? <BlockMath math={latex} />
        : <code>{expression}</code>}
    </div>
  );
}

function CandidateSection({
  title,
  items,
  emptyMessage
}: {
  title: string;
  items: readonly string[];
  emptyMessage: string;
}) {
  return (
    <section className="rounded-lg border bg-background p-4">
      <h3 className="mb-3 font-semibold">{title}</h3>
      {items.length > 0
        ? (
          <ul className="space-y-2">
            {items.map((item, index) => (
              <li key={index} dir="ltr" className="font-mono text-sm">
                {item}
              </li>
            ))}
          </ul>
        )
        : (
          <p className="text-sm text-muted-foreground">
            {emptyMessage}
          </p>
        )}
    </section>
  );
}

export function FunctionStudyResults({
  result,
  language
}: Props) {
  const ar = language === 'ar';

  const emptyMessage = ar
    ? 'لم يرجع المحرك مرشحات؛ هذا لا يثبت عدم وجودها.'
    : 'No candidates returned; this does not prove none exist.';

  const sections = [
    {
      title: ar ? 'النقاط الحرجة المرشحة' : 'Critical point candidates',
      items: result.criticalPointCandidates
    },
    {
      title: ar ? 'فترات التزايد المرشحة' : 'Increasing interval candidates',
      items: result.increasingIntervalCandidates
    },
    {
      title: ar ? 'فترات التناقص المرشحة' : 'Decreasing interval candidates',
      items: result.decreasingIntervalCandidates
    },
    {
      title: ar ? 'القيم القصوى المرشحة' : 'Extrema candidates',
      items: result.extremaCandidates.map(item =>
        `${item.type}: x = ${item.point}`
      )
    },
    {
      title: ar ? 'فترات التقعر لأعلى المرشحة' : 'Concave-up candidates',
      items: result.concaveUpIntervalCandidates
    },
    {
      title: ar ? 'فترات التقعر لأسفل المرشحة' : 'Concave-down candidates',
      items: result.concaveDownIntervalCandidates
    },
    {
      title: ar ? 'نقاط الانعطاف المرشحة' : 'Inflection candidates',
      items: result.inflectionCandidates.map(item =>
        `${item.status}: x = ${item.point}`
      )
    }
  ];

  return (
    <section
      aria-label="Function study results"
      className="space-y-5 rounded-xl border bg-card p-5"
    >
      <h2 className="text-xl font-bold">
        {ar ? 'دراسة الدالة' : 'Function study'}
      </h2>

      <p role="status" className="text-sm text-muted-foreground">
        {ar
          ? 'التحليل العام ما زال أوليًا؛ فقط النتائج المحددة أدناه كمثبتة تم إثباتها ضمن نطاقها.'
          : 'General analysis remains preliminary; only explicitly marked results below are proven within their stated scope.'}
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-lg border bg-background p-4">
          <h3 className="font-semibold">
            {ar ? 'المشتقة الأولى' : 'First derivative'}
          </h3>
          <DerivativeDisplay expression={result.firstDerivative} />
        </section>

        <section className="rounded-lg border bg-background p-4">
          <h3 className="font-semibold">
            {ar ? 'المشتقة الثانية' : 'Second derivative'}
          </h3>
          <DerivativeDisplay expression={result.secondDerivative} />
        </section>
      </div>

      {result.monotonicityProof.status === 'verified' ? (
        <section
          aria-label="Verified monotonicity proof"
          className="space-y-4 rounded-lg border bg-background p-4"
        >
          <h3 className="font-semibold">
            {ar
              ? 'نتائج مثبتة: التزايد والتناقص والقيم القصوى'
              : 'Proven results: monotonicity and extrema'}
          </h3>

          <p className="text-sm text-muted-foreground">
            {ar
              ? 'إثبات دقيق لكثيرة حدود من الدرجة الأولى أو الثانية ضمن نطاق الأعداد الحقيقية.'
              : 'Exact proof for a supported linear or quadratic polynomial over the real numbers.'}
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              {
                label: ar ? 'النقاط الحرجة' : 'Critical points',
                values: result.monotonicityProof.criticalPoints
              },
              {
                label: ar ? 'فترات التزايد' : 'Increasing intervals',
                values: result.monotonicityProof.increasingIntervals
              },
              {
                label: ar ? 'فترات التناقص' : 'Decreasing intervals',
                values: result.monotonicityProof.decreasingIntervals
              },
              {
                label: ar ? 'القيم القصوى' : 'Extrema',
                values: result.monotonicityProof.extrema.map(item =>
                  `${item.type}: x = ${item.x}, f(x) = ${item.y}`
                )
              }
            ].map(section => (
              <div key={section.label} className="space-y-1">
                <h4 className="text-sm font-semibold">
                  {section.label}
                </h4>
                {section.values.length > 0 ? (
                  <ul className="space-y-1">
                    {section.values.map((value, index) => (
                      <li
                        key={index}
                        dir="ltr"
                        className="font-mono text-sm"
                      >
                        {value}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {ar ? 'لا يوجد' : 'None'}
                  </p>
                )}
              </div>
            ))}
          </div>

          <h4 className="font-semibold">
            {ar ? 'خطوات الإثبات' : 'Proof steps'}
          </h4>

          <MathSolutionSteps
            steps={result.monotonicityProof.steps}
            language={language}
          />
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">
          {ar
            ? 'لم يتوفر إثبات دقيق للتزايد والتناقص لهذه الدالة ضمن الإصدار الحالي.'
            : 'An exact monotonicity proof is not available for this function in the current version.'}
        </p>
      )}

      <h3 className="font-semibold">
        {ar
          ? 'نتائج التحليل الأولية غير المثبتة'
          : 'Unverified analysis candidates'}
      </h3>

      <div className="grid gap-4 md:grid-cols-2">
        {sections.map(section => (
          <CandidateSection
            key={section.title}
            title={section.title}
            items={section.items}
            emptyMessage={emptyMessage}
          />
        ))}
      </div>

      <section className="space-y-2">
        <h3 className="font-semibold">
          {ar ? 'حدود النتائج والتنبيهات' : 'Limitations and warnings'}
        </h3>

        <ul className="list-disc space-y-1 ps-5 text-sm text-muted-foreground">
          {result.warnings.map((warning, index) => (
            <li key={index}>{warning}</li>
          ))}
        </ul>
      </section>
    </section>
  );
}
