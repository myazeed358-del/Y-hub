import type {
  Dispatch,
  SetStateAction,
} from 'react';
import { mathEngine } from '@/utils/mathEngine';
import { evaluateCalculusLimit } from '@/utils/calculusLimitBridge';
import type { LimitClassification } from '@/services/math/types/result';
import type { Language } from '@/i18n/uiCopy';
import type { getCalculusCopy } from '@/i18n/calculusCopy';

interface Step {
  desc: string;
  math?: string;
  isError?: boolean;
}

interface CalculusLimitHandlerDependencies {
  expression: string;
  limitPoint: string;
  limitDirection: string;
  copy: ReturnType<typeof getCalculusCopy>;
  language: Language;
  isArabic: boolean;
  setLimitClassification: Dispatch<
    SetStateAction<LimitClassification | null>
  >;
  setFinalResult: Dispatch<SetStateAction<string | null>>;
  setSteps: Dispatch<SetStateAction<Step[]>>;
}

export function createLimitHandler({
  expression,
  limitPoint,
  limitDirection,
  copy,
  language,
  isArabic,
  setLimitClassification,
  setFinalResult,
  setSteps,
}: CalculusLimitHandlerDependencies) {
  return async () => {
    const currentSteps: Step[] = [];

    try {
      const expressionText = expression.trim();
      const point = limitPoint.trim().toLowerCase();

      const approachTex =
        ['inf', '+inf', 'infinity', '+infinity', '∞', '+∞'].includes(point)
          ? '\\infty'
          : ['-inf', '-infinity', '-∞'].includes(point)
            ? '-\\infty'
            : await mathEngine.toTex(limitPoint);

      const expressionTex = await mathEngine.toTex(expressionText);

      const directionTex =
        approachTex.includes('\\infty')
          ? ''
          : limitDirection === 'right'
            ? '^{+}'
            : limitDirection === 'left'
              ? '^{-}'
              : '';

      currentSteps.push({
        desc: copy.problemFormulation,
        math: `\\lim_{x \\to ${approachTex}${directionTex}} \\left(${expressionTex}\\right)`,
      });

      const result = evaluateCalculusLimit(
        expressionText,
        limitPoint,
        limitDirection as 'left' | 'right' | 'both'
      );

      setLimitClassification(result.classification);

      const messages: Record<LimitClassification, string> = {
        finite: copy.limitComputed,
        '+infinity': copy.limitComputed,
        '-infinity': copy.limitComputed,
        does_not_exist: copy.limitDne,
        undefined: copy.limitUndefined,
        indeterminate: copy.limitIndeterminate,
        not_proven: copy.limitNotProven,
        unsupported: copy.limitUnsupported,
      };

      const isResolved = [
        'finite',
        '+infinity',
        '-infinity',
      ].includes(result.classification);

      const message = messages[result.classification];

      currentSteps.push({
        desc: message,
        isError: !isResolved && result.classification !== 'does_not_exist',
      });

      // Show actual mathematical conditions instead of a generic warning.
      const domainTranslations: Record<string, string> = {
        'Denominator must not equal zero':
          'المقام يجب ألا يساوي صفرًا.',
        'cos(argument) must not equal zero':
          'قيمة جيب التمام في المقام يجب ألا تساوي صفرًا.',
        'sin(argument) must not equal zero':
          'قيمة الجيب في المقام يجب ألا تساوي صفرًا.',
        'Argument of logarithm must be strictly greater than zero':
          'مدخل اللوغاريتم يجب أن يكون موجبًا.',
        'Argument of square root must be greater than or equal to zero in the real domain':
          'ما تحت الجذر التربيعي يجب أن يكون غير سالب في الأعداد الحقيقية.',
        'Argument of arcsin/arccos must be in the interval [-1, 1]':
          'مدخل الجيب أو جيب التمام العكسي يجب أن يكون بين −1 و1.',
        'Argument of arcsec/arccsc must be <= -1 or >= 1 in the real domain':
          'مدخل القاطع أو قاطع التمام العكسي يجب أن يكون خارج الفترة (−1، 1).',
      };

      const warningTranslations: Record<string, { ar: string; en: string }> = {
        requires_algebraic_rearrangement: {
          ar: 'تحتاج المسألة إلى إعادة ترتيب جبري إضافية.',
          en: 'Additional algebraic rearrangement is needed.',
        },
        requires_exponential_form_strategy: {
          ar: 'تحتاج المسألة إلى معالجة الصيغة الأسية.',
          en: 'Exponential-form analysis is needed.',
        },
        l_hopital_applicability_check_failed: {
          ar: 'لم يتم إثبات إمكانية تطبيق قاعدة لوبيتال.',
          en: "The applicability of L'Hôpital's rule could not be established.",
        },
        l_hopital_iteration_limit_reached: {
          ar: 'تم الوصول إلى الحد الأقصى لمحاولات قاعدة لوبيتال.',
          en: "The maximum number of L'Hôpital iterations was reached.",
        },
      };

      const conditions = [...new Set(result.conditions.filter(Boolean))];
      const warnings = [...new Set(result.warnings.filter(Boolean))];

      if (conditions.length > 0) {
        const translated = conditions.map((condition) =>
          isArabic
            ? (domainTranslations[condition] ?? condition)
            : condition
        );

        currentSteps.push({
          desc: `${isArabic ? 'ملاحظة عن مجال الدالة' : 'Domain note'}: ${translated.join(isArabic ? '؛ ' : '; ')}`,
        });
      }

      if (warnings.length > 0) {
        const translated = warnings.map((warning) => {
          const known = warningTranslations[warning];
          return known
            ? known[language]
            : warning.replace(/_/g, ' ');
        });

        currentSteps.push({
          desc: `${isArabic ? 'ملاحظة حسابية' : 'Calculation note'}: ${translated.join(isArabic ? '؛ ' : '; ')}`,
        });
      }

      const displayResult =
        isResolved && result.valueLatex
          ? result.valueLatex
          : `\\text{${message}}`;

      setFinalResult(displayResult);
    } catch {
      setLimitClassification('unsupported');

      currentSteps.push({
        desc: copy.limitError,
        isError: true,
      });

      setFinalResult(`\\text{${copy.limitError}}`);
    }

    setSteps(currentSteps);
  };
}
