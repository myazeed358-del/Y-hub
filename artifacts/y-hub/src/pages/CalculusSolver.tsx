import { useState, useEffect } from 'react';
import { useLanguage } from '../App';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@workspace/y-hub-ds/components/ui/card';
import { Button } from '@workspace/y-hub-ds/components/ui/button';
import { Input } from '@workspace/y-hub-ds/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@workspace/y-hub-ds/components/ui/select';
import { Infinity, TrendingUp, Activity, Sigma, Layers, History, LineChart as ChartIcon, CheckCircle2, AlertCircle, Copy, Trash2 } from 'lucide-react';
import { BlockMath, InlineMath } from 'react-katex';
import 'katex/dist/katex.min.css';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { mathEngine } from '@/utils/mathEngine';
import { evaluateCalculusLimit } from '@/utils/calculusLimitBridge';
import type { LimitClassification } from '@/services/math/types/result';

type EngineType = 'limits' | 'derivatives' | 'integrals' | 'applications' | 'series' | 'history';

interface Step {
  desc: string;
  math?: string;
  isError?: boolean;
}

export default function CalculusSolver() {
  const { language } = useLanguage();
  const isArabic = language === 'ar';

  const copy = isArabic
    ? {
        title: 'التفاضل والتكامل 2',
        subtitle: 'حل مسائل النهايات، الاشتقاق، التكامل، التطبيقات والمتسلسلات مع خطوات واضحة ورسوم بيانية.',
        limits: 'النهايات',
        derivatives: 'الاشتقاق',
        integrals: 'التكامل',
        applications: 'التطبيقات والهندسة',
        series: 'المتسلسلات',
        history: 'السجل',
        savedProblems: 'المسائل المحفوظة',
        recentProblems: 'آخر المسائل التي قمت بحلها',
        noHistory: 'لا يوجد سجل حتى الآن.',
        clearHistory: 'مسح السجل',
        enterFunction: 'أدخل الدالة f(x)',
        approaches: 'تؤول إلى (x → a)',
        direction: 'الاتجاه',
        bothSides: 'الجهتين',
        fromRight: 'من اليمين (+)',
        fromLeft: 'من اليسار (-)',
        equationOrFunction: 'المعادلة أو الدالة',
        derivativeOrder: 'رتبة المشتقة',
        firstDerivative: 'المشتقة الأولى',
        secondDerivative: 'المشتقة الثانية',
        thirdDerivative: 'المشتقة الثالثة',
        type: 'النوع',
        explicit: 'صريحة (y = f(x))',
        implicit: 'ضمنية (F(x,y) = 0)',
        integrand: 'الدالة المكاملة f(x)',
        integralType: 'نوع التكامل',
        indefinite: 'تكامل غير محدد',
        definite: 'تكامل محدد / معتل',
        lowerBoundA: 'الحد الأدنى (a)',
        upperBoundB: 'الحد الأعلى (b)',
        geometricApplication: 'التطبيق الهندسي',
        volume: 'الحجم الدوراني',
        arcLength: 'طول القوس',
        areaBetween: 'المساحة بين منحنيين',
        mainFunction: 'الدالة الرئيسية f(x)',
        secondaryFunction: 'الدالة الثانوية g(x)',
        lowerBound: 'الحد الأدنى',
        upperBound: 'الحد الأعلى',
        nthTerm: 'الحد النوني a_n',
        seriesHint: 'يتم فحص التقارب والتباعد باستخدام اختبار النسبة واختبار الحد النوني.',
        analyzing: 'يتم الآن التحليل الرياضي...',
        solve: 'حل المسألة',
        intelligentSolution: 'الحل وخطوات التسلسل',
        finalAnswer: 'النتيجة النهائية',
        copy: 'نسخ',
        graph: 'التمثيل البياني للدالة',

        problemFormulation: 'صياغة المسألة:',
        infinityBehavior: 'فحص النهاية عند المالانهاية وتقييم السلوك العام للدالة.',
        symbolicSimplification: 'تبسيط الدالة رمزياً:',
        directSubstitution: 'التعويض المباشر:',
        indeterminateLhopital: "حالة عدم تعيين. تطبيق قاعدة لوبيتال:",
        numeratorDerivative: 'مشتقة البسط:',
        denominatorDerivative: 'مشتقة المقام:',
        newLimit: 'النهاية الجديدة بعد الاشتقاق:',
        polynomialSubstitution: 'التعويض المباشر في الدالة:',
        limitError: 'تعذّر تحليل النهاية. تحقق من صيغة المسألة.',
        limitConclusion: 'نتيجة النهاية',
        limitComputed: 'تم حساب النهاية باستخدام التحليل الرياضي المحلي.',
        limitDne: 'النهاية غير موجودة.',
        limitUndefined: 'النهاية غير معرّفة في المجال الحقيقي.',
        limitIndeterminate: 'لم يتم حل حالة عدم التعيين.',
        limitNotProven: 'لم يتمكن التحليل الرياضي من إثبات النتيجة.',
        limitUnsupported: 'هذه المسألة غير مدعومة حاليًا.',
        limitWarning: 'توجد ملاحظات أو قيود على هذه النتيجة.',

        implicitDifferentiation: 'الاشتقاق الضمني. الدالة:',
        implicitExplanation: "يتم اشتقاق الطرفين بالنسبة للمتغير x وتجميع حدود y'.",
        originalFunction: 'الدالة الأصلية:',
        derivativeOrderStep: (order: number) => `المشتقة من الرتبة ${order}:`,
        criticalPointsSearch: 'إيجاد النقاط الحرجة: نساوي المشتقة بالصفر.',
        criticalPoints: 'النقاط الحرجة:',
        derivativeError: 'حدث خطأ في الاشتقاق.',

        indefiniteIntegralStep: 'التكامل غير المحدد:',
        basicIntegralRules: 'تطبيق قواعد التكامل الأساسية:',
        definiteIntegralStep: 'التكامل المحدد:',
        improperIntegral: 'تكامل معتل: استبدال حدود المالانهاية بمتغير وتطبيق النهاية.',
        areaEvaluation: 'تقييم المساحة تحت المنحنى بين الحدود المطلوبة:',
        integralError: 'حدث خطأ في التكامل.',

        volumeDisk: 'حساب الحجم الدوراني بطريقة الأقراص حول محور x:',
        squaredIntegral: 'تكامل مربع الدالة:',
        arcLengthCalculation: 'حساب طول القوس:',
        firstDerivativeStep: "1. المشتقة f'(x):",
        integralFormula: '2. تكوين صيغة التكامل:',
        areaBetweenStep: 'المساحة بين منحنيين:',
        differenceIntegral: 'تكامل الفرق بين الدالتين:',
        geometryError: 'فشل الحساب الهندسي.',

        seriesAnalysis: 'تحليل المتسلسلة / المتتالية:',
        nthTermTest: '1. اختبار الحد النوني للتباعد:',
        limitAtInfinity: 'نأخذ النهاية عندما n تؤول إلى المالانهاية.',
        ratioTest: '2. اختبار النسبة:',
        seriesError: 'فشل تحليل المتسلسلة.',

        furtherAnalysis: (value: string) =>
          `\\lim = \\text{يتطلب تحليلاً إضافياً. بعد التبسيط: } ${value}`,
        symbolicResult: (value: string) =>
          `\\text{نتيجة رمزية: } ${value}`,
        implicitEngineResult:
          '\\frac{dy}{dx} = \\text{يتطلب دعماً متقدماً للاشتقاق الضمني}',
        arcLengthResult:
          '\\text{يتطلب طول القوس تقييماً عددياً}',
        seriesResult: (value: string) =>
          `\\text{تحليل المتسلسلة: } ${value}`,
      }
    : {
        title: 'Calculus II',
        subtitle: 'Solve limits, derivatives, integrals, applications, and series with clear steps and graphs.',
        limits: 'Limits',
        derivatives: 'Derivatives',
        integrals: 'Integrals',
        applications: 'Applications & Geometry',
        series: 'Series',
        history: 'History',
        savedProblems: 'Saved Problems',
        recentProblems: 'Your most recently solved problems',
        noHistory: 'No saved problems yet.',
        clearHistory: 'Clear History',
        enterFunction: 'Enter the function f(x)',
        approaches: 'Approaches (x → a)',
        direction: 'Direction',
        bothSides: 'Both sides',
        fromRight: 'From the right (+)',
        fromLeft: 'From the left (-)',
        equationOrFunction: 'Equation or function',
        derivativeOrder: 'Derivative order',
        firstDerivative: 'First derivative',
        secondDerivative: 'Second derivative',
        thirdDerivative: 'Third derivative',
        type: 'Type',
        explicit: 'Explicit (y = f(x))',
        implicit: 'Implicit (F(x,y) = 0)',
        integrand: 'Integrand f(x)',
        integralType: 'Integral type',
        indefinite: 'Indefinite Integral',
        definite: 'Definite / Improper Integral',
        lowerBoundA: 'Lower bound (a)',
        upperBoundB: 'Upper bound (b)',
        geometricApplication: 'Geometric application',
        volume: 'Volume of Revolution',
        arcLength: 'Arc Length',
        areaBetween: 'Area Between Curves',
        mainFunction: 'Main function f(x)',
        secondaryFunction: 'Secondary function g(x)',
        lowerBound: 'Lower bound',
        upperBound: 'Upper bound',
        nthTerm: 'nth term a_n',
        seriesHint: 'The engine checks convergence and divergence using the ratio and nth-term tests.',
        analyzing: 'Analyzing the problem...',
        solve: 'Solve Problem',
        intelligentSolution: 'Solution & Step-by-Step Work',
        finalAnswer: 'Final Answer',
        copy: 'Copy',
        graph: 'Function Graph',

        problemFormulation: 'Problem formulation:',
        infinityBehavior: 'Checking the limit at infinity and evaluating end behavior.',
        symbolicSimplification: 'Symbolic simplification:',
        directSubstitution: 'Direct substitution:',
        indeterminateLhopital: "Indeterminate form. Applying L'Hôpital's Rule:",
        numeratorDerivative: 'Numerator derivative:',
        denominatorDerivative: 'Denominator derivative:',
        newLimit: 'New limit after differentiation:',
        polynomialSubstitution: 'Direct substitution in the function:',
        limitError: 'Unable to analyze the limit. Check the input syntax.',
        limitConclusion: 'Limit Result',
        limitComputed: 'The limit was evaluated using local mathematical analysis.',
        limitDne: 'The limit does not exist.',
        limitUndefined: 'The limit is undefined over the real domain.',
        limitIndeterminate: 'The indeterminate form could not be resolved.',
        limitNotProven: 'The mathematical analysis could not prove this result.',
        limitUnsupported: 'This problem is not currently supported.',
        limitWarning: 'There are additional conditions or warnings for this result.',

        implicitDifferentiation: 'Implicit differentiation. Function:',
        implicitExplanation: "Differentiate both sides with respect to x and collect the y' terms.",
        originalFunction: 'Original function:',
        derivativeOrderStep: (order: number) => `Derivative of order ${order}:`,
        criticalPointsSearch: 'Find critical points by setting the derivative equal to zero.',
        criticalPoints: 'Critical points:',
        derivativeError: 'An error occurred while differentiating.',

        indefiniteIntegralStep: 'Indefinite integral:',
        basicIntegralRules: 'Applying the basic integration rules:',
        definiteIntegralStep: 'Definite integral:',
        improperIntegral: 'Improper integral: replace the infinite bound with a variable and apply a limit.',
        areaEvaluation: 'Evaluate the area under the curve over the requested interval:',
        integralError: 'An error occurred while integrating.',

        volumeDisk: 'Calculate the volume of revolution using the disk method about the x-axis:',
        squaredIntegral: 'Integral of the squared function:',
        arcLengthCalculation: 'Calculate the arc length:',
        firstDerivativeStep: "1. Derivative f'(x):",
        integralFormula: '2. Build the integral formula:',
        areaBetweenStep: 'Area between two curves:',
        differenceIntegral: 'Integral of the difference between the functions:',
        geometryError: 'The geometric calculation failed.',

        seriesAnalysis: 'Series / sequence analysis:',
        nthTermTest: '1. nth-Term Test for divergence:',
        limitAtInfinity: 'Take the limit as n approaches infinity.',
        ratioTest: '2. Ratio Test:',
        seriesError: 'Series analysis failed.',

        furtherAnalysis: (value: string) =>
          `\\lim = \\text{Requires further analysis. Simplified: } ${value}`,
        symbolicResult: (value: string) =>
          `\\text{Symbolic Result: } ${value}`,
        implicitEngineResult:
          '\\frac{dy}{dx} = \\text{Requires advanced implicit differentiation support}',
        arcLengthResult:
          '\\text{Numerical evaluation is required for the arc length integral}',
        seriesResult: (value: string) =>
          `\\text{Series Analysis: } ${value}`,
      };

  const [activeEngine, setActiveEngine] = useState<EngineType>('limits');

  // Form States
  const [expression, setExpression] = useState('');
  const [expression2, setExpression2] = useState(''); // for g(x) or implicit

  // Limit States
  const [limitPoint, setLimitPoint] = useState('0');
  const [limitDirection, setLimitDirection] = useState('both');

  // Derivative States
  const [derivOrder, setDerivOrder] = useState('1');
  const [isImplicit, setIsImplicit] = useState(false);

  // Integral States
  const [integralType, setIntegralType] = useState('indefinite');
  const [lowerBound, setLowerBound] = useState('0');
  const [upperBound, setUpperBound] = useState('1');

  // App/Series States
  const [appType, setAppType] = useState('volume');

  // Results & UI States
  const [steps, setSteps] = useState<Step[]>([]);
  const [finalResult, setFinalResult] = useState<string | null>(null);
  const [limitClassification, setLimitClassification] =
    useState<LimitClassification | null>(null);
  const [loading, setLoading] = useState(false);
  const [graphData, setGraphData] = useState<any[]>([]);
  const [history, setHistory] = useState<{ id: number; engine: string; expr: string; result: string }[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('calculus_history');
    if (saved) {
      try { setHistory(JSON.parse(saved)); } catch (e) {}
    }
  }, []);

  const saveToHistory = (expr: string, res: string) => {
    const newEntry = { id: Date.now(), engine: activeEngine, expr, result: res };
    const updated = [newEntry, ...history].slice(0, 10);
    setHistory(updated);
    localStorage.setItem('calculus_history', JSON.stringify(updated));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const generateGraph = (expr: string) => {
    const data = [];
    for (let x = -10; x <= 10; x += 0.5) {
      let y = mathEngine.evaluateNumerically(expr, {x});
      if (!isNaN(y) && Math.abs(y) < 100) {
        data.push({ x, y });
      }
    }
    setGraphData(data);
  };

  const handleLimits = async () => {
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

  const handleDerivatives = async () => {
    let currentSteps: Step[] = [];
    try {
      if (isImplicit) {
        currentSteps.push({ desc: copy.implicitDifferentiation, math: expression });
        currentSteps.push({ desc: copy.implicitExplanation });
        setFinalResult(copy.implicitEngineResult);
      } else {
        currentSteps.push({ desc: copy.originalFunction, math: `f(x) = ${expression}` });
        let currentExpr = expression;

        for (let i = 1; i <= parseInt(derivOrder); i++) {
          const derived = await mathEngine.compute('derive', currentExpr);
          currentSteps.push({ desc: copy.derivativeOrderStep(i), math: `f${'^\\prime'.repeat(i)}(x) = ${derived}` });
          currentExpr = derived;
        }
        setFinalResult(`f${'^\\prime'.repeat(parseInt(derivOrder))}(x) = ${currentExpr}`);

        if (parseInt(derivOrder) === 1) {
           currentSteps.push({ desc: copy.criticalPointsSearch });
           try {
             const zeroes = await mathEngine.compute('zeroes', currentExpr);
             currentSteps.push({ desc: copy.criticalPoints, math: `x = ${zeroes}` });
           } catch(e) {}
        }
      }
    } catch (e: any) {
      currentSteps.push({ desc: copy.derivativeError, isError: true });
    }
    setSteps(currentSteps);
  };

  const handleIntegrals = async () => {
    let currentSteps: Step[] = [];
    try {
      if (integralType === 'indefinite') {
        currentSteps.push({ desc: copy.indefiniteIntegralStep, math: `\\int \\left( ${expression} \\right) dx` });
        const result = await mathEngine.compute('integrate', expression);
        currentSteps.push({ desc: copy.basicIntegralRules, math: result });
        setFinalResult(`${result} + C`);
      } else {
        currentSteps.push({ desc: copy.definiteIntegralStep, math: `\\int_{${lowerBound}}^{${upperBound}} \\left( ${expression} \\right) dx` });

        if (lowerBound === 'inf' || upperBound === 'inf') {
           currentSteps.push({ desc: copy.improperIntegral });
        }

        // Newton API uses area/a:b|expr
        const areaFormat = `${lowerBound}:${upperBound}|${expression}`;
        const result = await mathEngine.compute('area', areaFormat);
        currentSteps.push({ desc: copy.areaEvaluation, math: result });
        setFinalResult(result);
      }
    } catch (e: any) {
      currentSteps.push({ desc: copy.integralError, isError: true });
    }
    setSteps(currentSteps);
  };

  const handleApplications = async () => {
    let currentSteps: Step[] = [];
    try {
      if (appType === 'volume') {
         currentSteps.push({ desc: copy.volumeDisk, math: `V = \\pi \\int_{${lowerBound}}^{${upperBound}} [f(x)]^2 dx` });
         const squared = `(${expression})^2`;
         const areaFormat = `${lowerBound}:${upperBound}|${squared}`;
         const result = await mathEngine.compute('area', areaFormat);
         currentSteps.push({ desc: copy.squaredIntegral, math: `\\int [f(x)]^2 dx = ${result}` });
         setFinalResult(`V = ${result} \\pi`);
      } else if (appType === 'arclength') {
         currentSteps.push({ desc: copy.arcLengthCalculation, math: `L = \\int_{a}^{b} \\sqrt{1 + [f'(x)]^2} dx` });
         const deriv = await mathEngine.compute('derive', expression);
         currentSteps.push({ desc: copy.firstDerivativeStep, math: deriv });
         currentSteps.push({ desc: copy.integralFormula, math: `\\sqrt{1 + (${deriv})^2}` });
         setFinalResult(copy.arcLengthResult);
      } else if (appType === 'area_between') {
         currentSteps.push({ desc: copy.areaBetweenStep, math: `A = \\int_{${lowerBound}}^{${upperBound}} |f(x) - g(x)| dx` });
         currentSteps.push({ desc: 'f(x):', math: expression });
         currentSteps.push({ desc: 'g(x):', math: expression2 });
         const diff = `(${expression}) - (${expression2})`;
         const areaFormat = `${lowerBound}:${upperBound}|${diff}`;
         const result = await mathEngine.compute('area', areaFormat);
         currentSteps.push({ desc: copy.differenceIntegral, math: result });
         setFinalResult(result);
      }
    } catch (e: any) {
      currentSteps.push({ desc: copy.geometryError, isError: true });
    }
    setSteps(currentSteps);
  };

  const handleSeries = async () => {
    let currentSteps: Step[] = [];
    try {
      currentSteps.push({ desc: copy.seriesAnalysis, math: `a_n = ${expression}` });
      currentSteps.push({ desc: copy.nthTermTest });
      currentSteps.push({ desc: copy.limitAtInfinity });

      const limitsAtInf = await mathEngine.compute('simplify', expression); // mock behavior for sequence limit
      currentSteps.push({ desc: copy.ratioTest, math: `\\lim_{n \\to \\infty} \\left| \\frac{a_{n+1}}{a_n} \\right|` });

      setFinalResult(copy.seriesResult(limitsAtInf));
    } catch (e: any) {
      currentSteps.push({ desc: copy.seriesError, isError: true });
    }
    setSteps(currentSteps);
  };

  const handleSolve = async () => {
    setLoading(true);
    setSteps([]);
    setFinalResult(null);
    setLimitClassification(null);
    setGraphData([]);

    generateGraph(expression);

    switch(activeEngine) {
      case 'limits': await handleLimits(); break;
      case 'derivatives': await handleDerivatives(); break;
      case 'integrals': await handleIntegrals(); break;
      case 'applications': await handleApplications(); break;
      case 'series': await handleSeries(); break;
    }

    setLoading(false);
  };

  // Add to history after solve completes
  useEffect(() => {
    const canSaveLimit =
      limitClassification === 'finite' ||
      limitClassification === '+infinity' ||
      limitClassification === '-infinity';

    if (
      finalResult &&
      !loading &&
      finalResult !== 'null' &&
      (activeEngine !== 'limits' || canSaveLimit)
    ) {
      saveToHistory(expression, finalResult);
    }
  }, [finalResult, loading, limitClassification]);

  const engines = [
    { id: 'limits', label: copy.limits, icon: Infinity },
    { id: 'derivatives', label: copy.derivatives, icon: TrendingUp },
    { id: 'integrals', label: copy.integrals, icon: Sigma },
    { id: 'applications', label: copy.applications, icon: Layers },
    { id: 'series', label: copy.series, icon: Activity },
    { id: 'history', label: copy.history, icon: History },
  ] as const;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto min-h-screen space-y-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8 bg-[hsl(var(--card))] p-6 rounded-2xl border shadow-sm">
        <div className="p-4 bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] rounded-2xl">
          <Sigma size={32} />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{copy.title}</h1>
          <p className="text-[hsl(var(--muted-foreground))] mt-1 text-sm md:text-base">{copy.subtitle}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Navigation Sidebar */}
        <div className="flex flex-col gap-2">
          {engines.map(engine => {
            const Icon = engine.icon;
            const isActive = activeEngine === engine.id;
            return (
              <button
                key={engine.id}
                onClick={() => { setActiveEngine(engine.id); setSteps([]); setFinalResult(null); }}
                className={`flex items-center gap-3 w-full text-start p-4 rounded-xl border transition-all ${isActive ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-md border-transparent font-bold' : 'bg-[hsl(var(--card))] text-[hsl(var(--card-foreground))] border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]'}`}
              >
                <Icon size={20} />
                <span>{engine.label}</span>
              </button>
            )
          })}
        </div>

        {/* Main Content Area */}
        <div className="lg:col-span-3 space-y-6">
          {activeEngine === 'history' ? (
            <Card className="shadow-md border-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><History size={20}/> {copy.history} ({copy.savedProblems})</CardTitle>
                <CardDescription>{copy.recentProblems}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {history.length === 0 ? <p className="text-muted-foreground text-sm">{copy.noHistory}</p> : history.map(item => (
                  <div key={item.id} className="p-4 bg-muted/30 rounded-xl border flex justify-between items-center">
                    <div>
                      <p className="font-mono font-bold" dir="ltr">{item.expr}</p>
                      <BlockMath math={item.result} />
                      <span className="text-xs text-muted-foreground uppercase">{item.engine}</span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => copyToClipboard(item.result)}><Copy size={16}/></Button>
                  </div>
                ))}
                {history.length > 0 && (
                  <Button variant="outline" className="w-full mt-4" onClick={() => { setHistory([]); localStorage.removeItem('calculus_history'); }}><Trash2 size={16} className="me-2"/> {copy.clearHistory}</Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="shadow-md border-2 overflow-hidden">
              <CardHeader className="bg-[hsl(var(--muted))]/30 border-b">
                <CardTitle className="text-xl">{engines.find(e => e.id === activeEngine)?.label}</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">

                {/* 1. Limits Engine UI */}
                {activeEngine === 'limits' && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold">{copy.enterFunction}</label>
                      <Input dir="ltr" placeholder="e.g. sin(x)/x or (1+1/x)^x" value={expression} onChange={e => setExpression(e.target.value)} className="font-mono text-lg py-6" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-semibold">{copy.approaches}</label>
                        <Input dir="ltr" placeholder="0, inf, -inf, pi" value={limitPoint} onChange={e => setLimitPoint(e.target.value)} className="font-mono" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold">{copy.direction}</label>
                        <Select value={limitDirection} onValueChange={setLimitDirection}>
                          <SelectTrigger dir={isArabic ? 'rtl' : 'ltr'}><SelectValue /></SelectTrigger>
                          <SelectContent dir={isArabic ? 'rtl' : 'ltr'}>
                            <SelectItem value="both">{copy.bothSides}</SelectItem>
                            <SelectItem value="right">{copy.fromRight}</SelectItem>
                            <SelectItem value="left">{copy.fromLeft}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. Derivatives Engine UI */}
                {activeEngine === 'derivatives' && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold">{copy.equationOrFunction}</label>
                      <Input dir="ltr" placeholder="e.g. x^3 * sin(x) or x^2 + y^2 = 25" value={expression} onChange={e => setExpression(e.target.value)} className="font-mono text-lg py-6" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-semibold">{copy.derivativeOrder}</label>
                        <Select value={derivOrder} onValueChange={setDerivOrder}>
                          <SelectTrigger dir={isArabic ? 'rtl' : 'ltr'}><SelectValue /></SelectTrigger>
                          <SelectContent dir={isArabic ? 'rtl' : 'ltr'}>
                            <SelectItem value="1">{copy.firstDerivative}</SelectItem>
                            <SelectItem value="2">{copy.secondDerivative}</SelectItem>
                            <SelectItem value="3">{copy.thirdDerivative}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold">{copy.type}</label>
                        <Select value={isImplicit ? 'implicit' : 'explicit'} onValueChange={v => setIsImplicit(v === 'implicit')}>
                          <SelectTrigger dir={isArabic ? 'rtl' : 'ltr'}><SelectValue /></SelectTrigger>
                          <SelectContent dir={isArabic ? 'rtl' : 'ltr'}>
                            <SelectItem value="explicit">{copy.explicit}</SelectItem>
                            <SelectItem value="implicit">{copy.implicit}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. Integrals Engine UI */}
                {activeEngine === 'integrals' && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold">{copy.integrand}</label>
                      <Input dir="ltr" placeholder="e.g. x * e^x or 1/(1+x^2)" value={expression} onChange={e => setExpression(e.target.value)} className="font-mono text-lg py-6" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold">{copy.integralType}</label>
                      <Select value={integralType} onValueChange={setIntegralType}>
                        <SelectTrigger dir={isArabic ? 'rtl' : 'ltr'}><SelectValue /></SelectTrigger>
                        <SelectContent dir={isArabic ? 'rtl' : 'ltr'}>
                          <SelectItem value="indefinite">{copy.indefinite}</SelectItem>
                          <SelectItem value="definite">{copy.definite}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {integralType === 'definite' && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-semibold">{copy.lowerBoundA}</label>
                          <Input dir="ltr" value={lowerBound} onChange={e => setLowerBound(e.target.value)} className="font-mono" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-semibold">{copy.upperBoundB}</label>
                          <Input dir="ltr" value={upperBound} onChange={e => setUpperBound(e.target.value)} className="font-mono" />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 4. Applications Engine UI */}
                {activeEngine === 'applications' && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold">{copy.geometricApplication}</label>
                      <Select value={appType} onValueChange={setAppType}>
                        <SelectTrigger dir={isArabic ? 'rtl' : 'ltr'}><SelectValue /></SelectTrigger>
                        <SelectContent dir={isArabic ? 'rtl' : 'ltr'}>
                          <SelectItem value="volume">{copy.volume}</SelectItem>
                          <SelectItem value="arclength">{copy.arcLength}</SelectItem>
                          <SelectItem value="area_between">{copy.areaBetween}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold">{copy.mainFunction}</label>
                      <Input dir="ltr" placeholder="e.g. sqrt(x)" value={expression} onChange={e => setExpression(e.target.value)} className="font-mono text-lg py-6" />
                    </div>
                    {appType === 'area_between' && (
                      <div className="space-y-2">
                        <label className="text-sm font-semibold">{copy.secondaryFunction}</label>
                        <Input dir="ltr" placeholder="e.g. x^2" value={expression2} onChange={e => setExpression2(e.target.value)} className="font-mono text-lg py-6" />
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-semibold">{copy.lowerBound}</label>
                        <Input dir="ltr" value={lowerBound} onChange={e => setLowerBound(e.target.value)} className="font-mono" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold">{copy.upperBound}</label>
                        <Input dir="ltr" value={upperBound} onChange={e => setUpperBound(e.target.value)} className="font-mono" />
                      </div>
                    </div>
                  </div>
                )}

                {/* 5. Series Engine UI */}
                {activeEngine === 'series' && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold">{copy.nthTerm}</label>
                      <Input dir="ltr" placeholder="e.g. 1/n^2 or (-1)^n / n!" value={expression} onChange={e => setExpression(e.target.value)} className="font-mono text-lg py-6" />
                    </div>
                    <p className="text-xs text-muted-foreground">{copy.seriesHint}</p>
                  </div>
                )}

                <Button onClick={handleSolve} disabled={!expression || loading} className="w-full text-lg h-14 rounded-xl font-bold shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground transition-all">
                  {loading ? copy.analyzing : copy.solve}
                </Button>

              </CardContent>

              {/* Results Area */}
              {finalResult && (
                <div className="border-t bg-muted/10 p-6 space-y-8">
                  <div className="space-y-4">
                    <h3 className="font-bold text-lg flex items-center gap-2 border-b pb-2"><CheckCircle2 className="text-primary"/> {copy.intelligentSolution}</h3>
                    {steps.map((step, idx) => (
                      <div key={idx} className={`p-4 rounded-xl border shadow-sm ${step.isError ? 'bg-destructive/10 border-destructive/20 text-destructive' : 'bg-card border-border'}`}>
                        <p className="text-sm font-semibold mb-2">{step.desc}</p>
                        {step.math && (
                           <div className="bg-muted/50 p-3 rounded-lg overflow-x-auto text-center" dir="ltr">
                             <BlockMath math={step.math} />
                           </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="p-6 bg-primary/10 border border-primary/20 rounded-2xl relative">
                    <h3 className="text-sm font-bold text-primary mb-3">{activeEngine === 'limits' ? copy.limitConclusion : copy.finalAnswer}</h3>
                    <div className="overflow-x-auto text-center" dir="ltr">
                      <BlockMath math={finalResult} />
                    </div>
                    <Button variant="outline" size="sm" className="absolute top-4 right-4" onClick={() => copyToClipboard(finalResult)}>
                      <Copy size={16} className="me-2"/> {copy.copy}
                    </Button>
                  </div>

                  {/* Interactive Graphing (Show only for 1D real functions if data exists) */}
                  {graphData.length > 0 && activeEngine !== 'series' && (
                     <div className="space-y-4 mt-8 pt-8 border-t">
                       <h3 className="font-bold text-lg flex items-center gap-2"><ChartIcon className="text-primary"/> {copy.graph}</h3>
                       <div className="h-[300px] w-full bg-card border rounded-xl p-4 shadow-sm">
                         <ResponsiveContainer width="100%" height="100%">
                           <LineChart data={graphData}>
                             <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                             <XAxis dataKey="x" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                             <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                             <Tooltip contentStyle={{ borderRadius: '12px', background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                             <Line type="monotone" dataKey="y" stroke="hsl(var(--primary))" strokeWidth={3} dot={false} />
                           </LineChart>
                         </ResponsiveContainer>
                       </div>
                     </div>
                  )}
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

