import { useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Info,
  RotateCcw,
  XCircle,
} from 'lucide-react';
import { SectionKicker } from '@/components/legacy/LegacyLearningWidgets';

const questions = [
  { question: 'ما المجال الصحيح لدرجة العضوية μ(x)؟', options: ['من −١ إلى ١', 'من ٠ إلى ١', 'أكبر من ١ فقط', 'قيمتان فقط: ٠ أو ١'], answer: 1, explanation: 'درجة العضوية قيمة حقيقية بين ٠ و١، وهذا ما يسمح بالانتماء الجزئي.' },
  { question: 'أي عملية تستخدم min لدرجات العضوية؟', options: ['الاتحاد', 'المتممة', 'التقاطع', 'القطع عند α'], answer: 2, explanation: 'التقاطع الضبابي يأخذ الدرجة الأصغر: μA∩B(x) = min(μA(x), μB(x)).' },
  { question: 'إذا كانت μA(x)=٠.٣، فما μAᶜ(x)؟', options: ['٠.٣', '٠.٧', '١.٣', '٠'], answer: 1, explanation: 'المتممة تحسب بطرح الدرجة من ١: 1 − 0.3 = 0.7.' },
  { question: 'ما القيمة اللغوية للمتغير «السرعة»؟', options: ['سريعة', 'كيلومتر', 'x = ٨٠', 'دالة مثلثية'], answer: 0, explanation: 'القيمة اللغوية وصف مثل «سريعة» يمثل مجموعة ضبابية ضمن المتغير.' },
  { question: 'ماذا يحدث للقطع عند α عندما نرفع قيمة α؟', options: ['تتسع المجموعة', 'تضيق المجموعة', 'لا تتغير أبداً', 'تصبح كل الدرجات صفراً'], answer: 1, explanation: 'رفع العتبة يعني الاحتفاظ بعناصر أقل، لذلك تضيق مجموعة القطع.' },
  { question: 'أي دالة انتقالها الأكثر نعومة؟', options: ['المثلثية', 'شبه المنحرفة', 'الغاوسية', 'دالة المؤشر'], answer: 2, explanation: 'الدالة الغاوسية تعطي منحنى ناعماً بلا زوايا حادة عند الانتقال.' },
];

export default function Quiz() {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState<Record<number, boolean>>({});
  const [finished, setFinished] = useState(false);
  const score = questions.reduce((total, question, index) => total + (answers[index] === question.answer ? 1 : 0), 0);
  const answerQuestion = (questionIndex: number, optionIndex: number) => {
    if (submitted[questionIndex]) return;
    setAnswers((current) => ({ ...current, [questionIndex]: optionIndex }));
    setSubmitted((current) => ({ ...current, [questionIndex]: true }));
  };
  const reset = () => { setAnswers({}); setSubmitted({}); setFinished(false); };
  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-9 flex flex-wrap items-end justify-between gap-5"><div><SectionKicker>مساحة التمرين</SectionKicker><h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">اختبر بوصلتك</h1><p className="mt-3 max-w-xl text-sm leading-7 text-[hsl(var(--muted-foreground))]">أجب، ثم اقرأ سبب الإجابة. الهدف هنا ليس الدرجة، بل أن تعرف أين يحتاج فهمك إلى سؤال آخر.</p></div><div className="flex items-center gap-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3"><div className="font-mono text-xl font-bold text-[hsl(var(--primary))]">{score}</div><div className="text-xs text-[hsl(var(--muted-foreground))]">من {questions.length}</div></div></div>
      {finished && <div className="mb-6 flex items-center justify-between rounded-2xl border border-[hsl(var(--primary)/.25)] bg-[hsl(var(--primary)/.08)] p-5"><div><div className="font-bold">اكتملت الجولة</div><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">نتيجتك {score} من {questions.length}. عد إلى أي سؤال لتقرأ منطقه بهدوء.</p></div><button onClick={reset} data-testid="button-reset-quiz" className="inline-flex items-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-3 py-2 text-xs font-bold text-[hsl(var(--primary-foreground))]"><RotateCcw size={14} /> إعادة الجولة</button></div>}
      <div className="space-y-4">
        {questions.map((question, index) => {
          const answered = submitted[index];
          return <div key={question.question} className={`rounded-[1.5rem] border bg-[hsl(var(--card))] p-5 md:p-7 ${answered ? 'border-[hsl(var(--border))]' : 'border-[hsl(var(--border))]'}`}>
            <div className="mb-5 flex gap-4"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--sidebar))] font-mono text-xs text-[hsl(var(--accent))]">{String(index + 1).padStart(2, '٠')}</div><h2 className="pt-1 text-base font-bold leading-7">{question.question}</h2></div>
            <div className="grid gap-2 sm:grid-cols-2">{question.options.map((option, optionIndex) => { const isCorrect = optionIndex === question.answer; const isChosen = answers[index] === optionIndex; return <button key={option} onClick={() => answerQuestion(index, optionIndex)} data-testid={`button-answer-${index}-${optionIndex}`} className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-right text-sm transition-all ${answered && isCorrect ? 'border-[hsl(var(--primary)/.55)] bg-[hsl(var(--primary)/.1)] text-[hsl(var(--primary))]' : answered && isChosen ? 'border-[hsl(var(--destructive)/.45)] bg-[hsl(var(--destructive)/.07)] text-[hsl(var(--destructive))]' : 'border-[hsl(var(--border))] hover:border-[hsl(var(--primary)/.35)] hover:bg-[hsl(var(--primary)/.04)]'}`}><span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg font-mono text-[10px] ${answered && isCorrect ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'bg-[hsl(var(--muted))]'}`}>{String.fromCharCode(1575 + optionIndex)}</span><span className="flex-1">{option}</span>{answered && isCorrect && <CheckCircle2 size={16} />}{answered && isChosen && !isCorrect && <XCircle size={16} />}</button>; })}</div>
            {answered && <div className={`mt-4 flex gap-2 rounded-xl p-3 text-xs leading-6 ${answers[index] === question.answer ? 'bg-[hsl(var(--primary)/.07)] text-[hsl(var(--primary))]' : 'bg-[hsl(var(--destructive)/.07)] text-[hsl(var(--destructive))]'}`}><Info size={15} className="mt-1 shrink-0" /><span>{question.explanation}</span></div>}
          </div>;
        })}
      </div>
      {Object.keys(submitted).length === questions.length && !finished && <button onClick={() => setFinished(true)} data-testid="button-finish-quiz" className="mt-7 inline-flex items-center gap-2 rounded-2xl bg-[hsl(var(--primary))] px-5 py-3.5 text-sm font-bold text-[hsl(var(--primary-foreground))]">إنهاء الجولة <ArrowLeft size={16} /></button>}
    </div>
  );
}
