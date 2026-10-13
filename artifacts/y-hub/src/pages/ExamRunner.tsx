import { useState, useEffect } from 'react';
import { useRoute } from 'wouter';
import { supabase } from '@/utils/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@workspace/y-hub-ds/components/ui/button';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { ExamRunnerHeader } from '@/components/exam-runner/ExamRunnerHeader';
import { ExamResultSummary } from '@/components/exam-runner/ExamResultSummary';
import { ExamQuestionList } from '@/components/exam-runner/ExamQuestionList';

export default function ExamRunner() {
  const [, params] = useRoute('/exam/:id');
  const examId = params?.id || '';
  const { user } = useAuth();

  const [exam, setExam] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    async function loadExam() {
      if (!examId || !user) return;
      setLoading(true);

      // Check if already taken
      const { data: existingResult } = await supabase
        .from('student_results')
        .select('*')
        .eq('exam_id', examId)
        .eq('student_id', user.id)
        .maybeSingle();

      if (existingResult) {
        setResult(existingResult);
        setIsSubmitted(true);
      }

      const { data: examData } = await supabase.from('exams').select('*').eq('id', examId).single();
      if (examData) {
        setExam(examData);
        if (!existingResult) setTimeLeft(examData.time_limit_minutes * 60);
      }

      // Fetch questions using SECURE RPC (no correct_answer field returned)
      const { data: qData, error: qError } = await supabase.rpc('get_exam_questions', { p_exam_id: examId });
      if (qData) {
        setQuestions(qData);
      } else if (qError) {
        console.error("Failed to load questions safely", qError);
      }
      
      setLoading(false);
    }
    loadExam();
  }, [examId, user]);

  useEffect(() => {
    if (!isSubmitted && timeLeft > 0) {
      const timer = setInterval(() => setTimeLeft(t => t - 1), 1000);
      return () => clearInterval(timer);
    } else if (timeLeft === 0 && !isSubmitted && exam) {
      handleSubmit(); // Auto submit
    }
    return undefined;
  }, [timeLeft, isSubmitted, exam]);

  const handleSubmit = async () => {
    if (isSubmitted || !user) return;
    setIsSubmitted(true);

    // Call SECURE RPC for grading
    const { data, error } = await supabase.rpc('submit_exam', { 
      p_exam_id: examId, 
      p_answers: answers 
    });

    if (!error && data) {
      setResult(data);
      toast.success('تم تسليم الاختبار بنجاح');
    } else {
      toast.error('حدث خطأ أثناء حفظ النتيجة');
      console.error(error);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

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
