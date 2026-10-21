import { Button } from "@workspace/y-hub-ds/components/ui/button";
import { Loader2 } from "lucide-react";
import { ExamRunnerHeader } from "../components/ExamRunnerHeader";
import { ExamResultSummary } from "../components/ExamResultSummary";
import { ExamQuestionList } from "../components/ExamQuestionList";
import { useExamRunner } from "../hooks/useExamRunner";

export default function ExamRunnerPage() {
  const {
    recoveryMessage,
    recoveryChoices,
    exam,
    questions,
    loading,
    answers,
    setAnswers,
    timeLeft,
    isSubmitted,
    result,
    phase,
    error,
    handleSubmit,
    formatTime,
  } = useExamRunner();

  if (loading)
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin" size={48} />
      </div>
    );

  if (!exam)
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold">
          {error || "الاختبار غير موجود أو غير متاح"}
        </h2>
      </div>
    );

  return (
    <div className="mx-auto max-w-4xl py-6 px-4 md:py-10 md:px-5" dir="rtl">
      <ExamRunnerHeader
        exam={exam}
        isSubmitted={isSubmitted}
        timeLeft={timeLeft}
        formatTime={formatTime}
      />

      {isSubmitted && result ? <ExamResultSummary result={result} /> : null}

      {recoveryMessage && <p role="status" className="mb-4">{recoveryMessage}</p>}
      {recoveryChoices.length > 1 && !isSubmitted && (
        <label className="block mb-4">نسخ الاستعادة / Recovery copies
          <select aria-label="Recovery copy" defaultValue="" onChange={event => {
            const draft = recoveryChoices.find(item => item.writer === event.target.value);
            if (draft && window.confirm("استبدال الإجابات المعروضة بهذه النسخة؟ Use this recovery copy?")) setAnswers(draft.answers);
          }}>
            <option value="" disabled>اختر نسخة / Choose a copy</option>
            {recoveryChoices.map(draft => <option key={draft.writer} value={draft.writer}>{new Date(draft.updated).toLocaleString()} — {draft.writer.slice(0, 8)}</option>)}
          </select>
        </label>
      )}
      {error && (
        <p role="alert" className="mb-4 text-destructive">
          {error}
        </p>
      )}
      {(phase === "expired" || (!isSubmitted && timeLeft === 0)) && (
        <p role="status" className="mb-4">
          انتهى الوقت المعروض. يحدد الخادم حالة المحاولة؛ لا توجد نتيجة محفوظة
          ما لم يتم تأكيد التسليم.
        </p>
      )}

      <ExamQuestionList
        questions={questions}
        isSubmitted={
          isSubmitted ||
          phase === "submitting" ||
          phase === "expired" ||
          timeLeft === 0
        }
        answers={answers}
        setAnswers={setAnswers}
      />

      {!isSubmitted && (
        <div className="mt-8 flex justify-end">
          <Button
            size="lg"
            onClick={handleSubmit}
            className="px-10 font-bold"
            disabled={loading || phase === "submitting" || phase === "expired"}
          >
            {phase === "submitting"
              ? "جارٍ التحقق والحفظ…"
              : phase === "failed"
                ? "التحقق وإعادة المحاولة"
                : timeLeft === 0
                  ? "التحقق من حالة المحاولة"
                  : "تسليم الاختبار"}
          </Button>
        </div>
      )}
    </div>
  );
}
