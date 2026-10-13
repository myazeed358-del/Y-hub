import * as React from 'react';

import {
  ArrowLeft,
  CheckCircle2,
  Info,
  RotateCcw,
  XCircle,
} from 'lucide-react';

import {
  SectionKicker,
} from '@/components/legacy/LegacyLearningWidgets';

import { useLegacyQuiz } from '../hooks/useLegacyQuiz';

export default function QuizPage() {
  const {
    questions,
    answers,
    submitted,
    finished,
    setFinished,
    score,
    answerQuestion,
    reset
  } = useLegacyQuiz();

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
