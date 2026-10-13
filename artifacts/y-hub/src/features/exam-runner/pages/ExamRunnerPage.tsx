import { Button } from '@workspace/y-hub-ds/components/ui/button';
import { Loader2 } from 'lucide-react';
import { ExamRunnerHeader } from '../components/ExamRunnerHeader';
import { ExamResultSummary } from '../components/ExamResultSummary';
import { ExamQuestionList } from '../components/ExamQuestionList';
import { useExamRunner } from '../hooks/useExamRunner';

export default function ExamRunnerPage() {
  const {
    exam,
    questions,
    loading,
    answers,
    setAnswers,
    timeLeft,
    isSubmitted,
    result,
    handleSubmit,
    formatTime
  } = useExamRunner();

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin" size={48} /></div>;

  if (!exam) return <div className="text-center py-20"><h2 className="text-2xl font-bold">الاختبار غير موجود أو غير متاح</h2></div>;

  return (
    <div className="mx-auto max-w-4xl py-6 px-4 md:py-10 md:px-5" dir="rtl">
      <ExamRunnerHeader
        exam={exam}
        isSubmitted={isSubmitted}
        timeLeft={timeLeft}
        formatTime={formatTime}
      />

      {isSubmitted && result ? (
        <ExamResultSummary result={result} />
      ) : null}

      <ExamQuestionList
        questions={questions}
        isSubmitted={isSubmitted}
        answers={answers}
        setAnswers={setAnswers}
      />

      {!isSubmitted && (
        <div className="mt-8 flex justify-end">
          <Button size="lg" onClick={handleSubmit} className="px-10 font-bold" disabled={loading}>تسليم الاختبار</Button>
        </div>
      )}
    </div>
  );
}
