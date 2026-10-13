import { useMemo, useState } from 'react';
import {
  FlaskConical,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react';
import {
  membershipValue,
  sampleMembershipCurve,
  type MembershipFunctionType,
} from '@/utils/fuzzyLogic';
import { useLanguage } from '@/i18n/LanguageContext';
import {
  SectionKicker,
  MiniCurve,
} from '@/components/legacy/LegacyLearningWidgets';

type FunctionType = MembershipFunctionType;

const labCopy = {
  ar: {
    kicker: 'مختبر تفاعلي',
    title: 'شكّل دالتك بيدك',
    description: 'اختر نموذجاً، حرّك المعلمات، وراقب كيف تتغير درجة العضوية لحظياً.',
    trial: 'التجربة رقم ٠١',
    curve: 'منحنى العضوية',
    axis: 'المحور الأفقي: قيمة المتغير · العمودي: μ(x)',
    at: 'عند x',
    note: 'ملاحظة المختبر',
    membershipIs: 'تكون العضوية',
    meaning: 'أي أن القيمة تنتمي إلى مفهوم',
    degree: 'بهذه الدرجة.',
    functionType: 'نوع الدالة',
    parameters: 'المعلمات',
    reset: 'إعادة الضبط',
    center: 'المركز c',
    spread: 'الانتشار σ',
    start: 'بداية a',
    peak: 'القمة b',
    end: 'نهاية c',
    final: 'النهاية d',
    testValue: 'القيمة المراد اختبارها x',
    triangle: 'مثلثية',
    trapezoid: 'شبه منحرفة',
    gaussian: 'غاوسية',
  },
  en: {
    kicker: 'Interactive lab',
    title: 'Shape your function',
    description: 'Choose a model, move its parameters, and watch membership change in real time.',
    trial: 'Experiment 01',
    curve: 'Membership curve',
    axis: 'Horizontal: variable value · vertical: μ(x)',
    at: 'At x',
    note: 'Lab note',
    membershipIs: 'membership is',
    meaning: 'That means the value belongs to the concept',
    degree: 'at this degree.',
    functionType: 'Function type',
    parameters: 'Parameters',
    reset: 'Reset',
    center: 'Center c',
    spread: 'Spread σ',
    start: 'Start a',
    peak: 'Peak b',
    end: 'End c',
    final: 'Final d',
    testValue: 'Value to test x',
    triangle: 'Triangular',
    trapezoid: 'Trapezoidal',
    gaussian: 'Gaussian',
  },
} as const;

export default function Lab() {
  const { language } = useLanguage();
  const copy = labCopy[language];
  const isArabic = language === 'ar';
  const axisLabels = isArabic
    ? { zero: '٠', fifty: '٥٠', hundred: '١٠٠', one: '١' }
    : { zero: '0', fifty: '50', hundred: '100', one: '1' };
  const [functionType, setFunctionType] = useState<FunctionType>('triangle');
  const [params, setParams] = useState({ a: 20, b: 45, c: 72, d: 88, center: 55, spread: 16, x: 58 });
  const update = (key: keyof typeof params, value: number) => setParams((current) => ({ ...current, [key]: value }));
  const membership = useMemo(() => membershipValue(functionType, params.x, params), [functionType, params]);
  const curvePath = useMemo(() => {
    const points = sampleMembershipCurve(functionType, params).map(({ x, y }, index) =>
      `${index === 0 ? 'M' : 'L'} ${x * 3.9 + 10} ${194 - y * 160}`,
    );
    return points.join(' ');
  }, [functionType, params]);
  const functionNames: Record<FunctionType, string> = {
    triangle: copy.triangle,
    trapezoid: copy.trapezoid,
    gaussian: copy.gaussian,
  };
  return (
    <div className="mx-auto max-w-6xl" dir={isArabic ? 'rtl' : 'ltr'}>
      <div className="mb-9 flex flex-wrap items-end justify-between gap-5"><div><SectionKicker>{copy.kicker}</SectionKicker><h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">{copy.title}</h1><p className="mt-3 max-w-xl text-sm leading-7 text-[hsl(var(--muted-foreground))]">{copy.description}</p></div><div className="flex items-center gap-2 rounded-xl bg-[hsl(var(--primary)/.1)] px-3 py-2 text-xs font-bold text-[hsl(var(--primary))]"><FlaskConical size={16} /> {copy.trial}</div></div>
      <div className="grid gap-6 lg:grid-cols-[1fr_330px]">
        <div className="order-2 rounded-[1.75rem] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 md:p-8 lg:order-1">
           <div className="mb-6 flex items-center justify-between"><div><h2 className="text-lg font-extrabold">{copy.curve}</h2><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{copy.axis}</p></div><div className="rounded-xl bg-[hsl(var(--accent)/.2)] px-3 py-2 text-center"><div className="font-mono text-2xl font-bold text-[hsl(var(--accent-foreground))]">{membership.toFixed(2)}</div><div className="text-[10px] text-[hsl(var(--accent-foreground)/.7)]">{copy.at} = {params.x}</div></div></div>
          <div className="relative h-[300px] overflow-hidden rounded-2xl bg-[hsl(var(--background))] p-3 md:h-[360px]">
            <svg viewBox="0 0 410 220" className="h-full w-full overflow-visible">
              <defs><pattern id="grid" width="39" height="32" patternUnits="userSpaceOnUse"><path d="M 39 0 L 0 0 0 32" fill="none" stroke="hsl(var(--border))" strokeWidth=".8" /></pattern></defs>
              <rect x="10" y="10" width="390" height="184" fill="url(#grid)" rx="8" />
              <path d="M 10 194 H 400 M 10 194 V 10" stroke="hsl(var(--muted-foreground))" strokeWidth="1.5" />
              <path d={curvePath} fill="none" stroke="hsl(var(--primary))" strokeWidth="4" strokeLinecap="round" />
              <path d={`M ${params.x * 3.9 + 10} 194 V ${194 - membership * 160}`} stroke="hsl(var(--accent))" strokeWidth="1.5" strokeDasharray="5 5" />
              <circle cx={params.x * 3.9 + 10} cy={194 - membership * 160} r="6" fill="hsl(var(--accent))" stroke="hsl(var(--card))" strokeWidth="3" />
              <text x="10" y="211" fill="hsl(var(--muted-foreground))" fontSize="9">{axisLabels.zero}</text><text x="200" y="211" fill="hsl(var(--muted-foreground))" fontSize="9">{axisLabels.fifty}</text><text x="390" y="211" fill="hsl(var(--muted-foreground))" fontSize="9">{axisLabels.hundred}</text>
              <text x="2" y="17" fill="hsl(var(--muted-foreground))" fontSize="9">{axisLabels.one}</text><text x="2" y="198" fill="hsl(var(--muted-foreground))" fontSize="9">{axisLabels.zero}</text>
            </svg>
          </div>
           <div className="mt-6 rounded-2xl border border-dashed border-[hsl(var(--primary)/.3)] bg-[hsl(var(--primary)/.05)] p-4 text-sm leading-7"><span className="font-bold text-[hsl(var(--primary))]">{copy.note}: </span>{copy.at} = {params.x} {copy.membershipIs} <span className="font-mono font-bold">{membership.toFixed(2)}</span>{isArabic ? '؛' : ';'} {copy.meaning} «{functionNames[functionType]}» {copy.degree}</div>
        </div>
        <div className="order-1 space-y-4 lg:order-2">
          <div className="rounded-[1.75rem] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
             <div className="mb-4 flex items-center gap-2"><SlidersHorizontal size={17} className="text-[hsl(var(--primary))]" /><h2 className="font-extrabold">{copy.functionType}</h2></div>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(functionNames) as FunctionType[]).map((type) => <button key={type} onClick={() => setFunctionType(type)} data-testid={`button-function-${type}`} className={`rounded-xl border px-2 py-3 text-xs font-bold transition-all ${functionType === type ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/.1)] text-[hsl(var(--primary))]' : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary)/.3)]'}`}><div className="mb-2 h-8"><MiniCurve tone={type === 'gaussian' ? 'coral' : type === 'trapezoid' ? 'amber' : 'teal'} type={type} /></div>{functionNames[type]}</button>)}
            </div>
          </div>
           <div className="rounded-[1.75rem] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
             <div className="mb-5 flex items-center justify-between"><h2 className="font-extrabold">{copy.parameters}</h2><button onClick={() => setParams({ a: 20, b: 45, c: 72, d: 88, center: 55, spread: 16, x: 58 })} data-testid="button-reset-lab" className="inline-flex items-center gap-1.5 text-xs font-bold text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))]"><RotateCcw size={13} /> {copy.reset}</button></div>
             {functionType === 'gaussian' ? <><LabSlider label={copy.center} value={params.center} onChange={(value) => update('center', value)} /><LabSlider label={copy.spread} value={params.spread} min={5} max={30} onChange={(value) => update('spread', value)} /></> : <><LabSlider label={copy.start} value={params.a} max={Math.max(25, params.b - 5)} onChange={(value) => update('a', value)} /><LabSlider label={copy.peak} value={params.b} min={params.a + 5} max={Math.min(85, params.c - 5)} onChange={(value) => update('b', value)} /><LabSlider label={copy.end} value={params.c} min={params.b + 5} max={functionType === 'trapezoid' ? params.d - 5 : 98} onChange={(value) => update('c', value)} />{functionType === 'trapezoid' && <LabSlider label={copy.final} value={params.d} min={params.c + 5} max={100} onChange={(value) => update('d', value)} />}</>}
             <div className="mt-4 border-t border-[hsl(var(--border))] pt-4"><LabSlider label={copy.testValue} value={params.x} onChange={(value) => update('x', value)} /></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LabSlider({ label, value, min = 0, max = 100, onChange }: { label: string; value: number; min?: number; max?: number; onChange: (value: number) => void }) {
  return <label className="mb-4 block last:mb-0"><div className="mb-2 flex justify-between text-xs font-semibold"><span>{label}</span><span className="font-mono text-[hsl(var(--primary))]">{value}</span></div><input aria-label={label} data-testid={`input-${label}`} type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} className="w-full accent-[hsl(var(--primary))]" /></label>;
}
