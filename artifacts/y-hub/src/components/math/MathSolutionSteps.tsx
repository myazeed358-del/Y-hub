import * as React from 'react';
import * as math from 'mathjs';
import { BlockMath } from 'react-katex';
import { ASTUtils } from '@/services/math/symbolic/utils';
import type { CanonicalAST } from '@/services/math/types/ast';
import type { MathStep } from '@/services/math/types/step';

interface Props {
  steps: readonly MathStep[];
  language: 'ar' | 'en';
}

function MathExpression({ ast }: { ast: CanonicalAST }) {
  const expression = ASTUtils.serialize(ast);

  try {
    const latex = math.parse(expression).toTex();
    return (
      <div dir="ltr" className="overflow-x-auto">
        <BlockMath math={latex} />
      </div>
    );
  } catch {
    return (
      <code dir="ltr" className="block overflow-x-auto">
        {expression}
      </code>
    );
  }
}

function DerivativeEquation({
  derivation
}: {
  derivation: NonNullable<MathStep['derivation']>;
}) {
  try {
    const before = math.parse(
      ASTUtils.serialize(derivation.input)
    ).toTex();

    const after = math.parse(
      ASTUtils.serialize(derivation.output)
    ).toTex();

    const latex =
      String.raw`\frac{d}{d${derivation.variable}}\left(${before}\right) = ${after}`;

    return (
      <div dir="ltr" className="overflow-x-auto">
        <BlockMath math={latex} />
      </div>
    );
  } catch {
    return (
      <p className="text-sm text-muted-foreground">
        Derivative equation could not be formatted.
      </p>
    );
  }
}

export function MathSolutionSteps({ steps, language }: Props) {
  const ar = language === 'ar';

  return (
    <ol className="space-y-3">
      {steps.map((step, index) => {
        const transformation = step.transformation;
        const hasExpressions = transformation
          && 'before' in transformation
          && 'after' in transformation;

        return (
          <li
            key={`${step.id}-${index}`}
            className="rounded-lg border bg-background p-3"
          >
            <h4 className="font-semibold text-foreground">
              {index + 1}. {step.title}
            </h4>

            <p className="mt-2 text-sm text-muted-foreground">
              {step.explanation}
            </p>

            {step.derivation && (
              <div className="mt-3 space-y-2">
                <DerivativeEquation
                  derivation={step.derivation}
                />
                {step.derivation.verification === 'not_proven' && (
                  <p className="text-xs text-muted-foreground">
                    {ar
                      ? 'التحقق الرياضي المستقل لهذه الخطوة لم يكتمل بعد.'
                      : 'This step has not been independently verified yet.'}
                  </p>
                )}
              </div>
            )}

            {hasExpressions && (
              <div className="mt-3 space-y-2">
                <p className="text-sm font-medium">
                  {ar ? 'قبل التحويل' : 'Before'}
                </p>
                <MathExpression ast={transformation.before} />

                <p className="text-sm font-medium">
                  {ar ? 'بعد التحويل' : 'After'}
                </p>
                <MathExpression ast={transformation.after} />

                {'restrictionsAdded' in transformation
                  && transformation.restrictionsAdded.length > 0 && (
                  <div className="text-sm text-muted-foreground">
                    {transformation.restrictionsAdded.map(
                      (condition, i) => (
                        <p key={i}>{condition}</p>
                      )
                    )}
                  </div>
                )}
              </div>
            )}

            {step.subSteps && step.subSteps.length > 0 && (
              <div className="mt-3 border-s-2 ps-3">
                <MathSolutionSteps
                  steps={step.subSteps}
                  language={language}
                />
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
