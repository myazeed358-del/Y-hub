import { useEffect, useState } from 'react';
import { useRoute } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { examRunnerRepository } from '../services/examRunnerRepository';
import { formatExamTime } from '../domain/formatExamTime';
import type { ExamInfo, ExamQuestion, ExamResult } from '../types';

export function useExamRunner() {
  const [, params] = useRoute('/exam/:id');
  const examId = params?.id || '';
  const { user } = useAuth();

  const [exam, setExam] = useState<ExamInfo | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [result, setResult] = useState<ExamResult | null>(null);

  useEffect(() => {
    async function loadExam() {
      if (!examId || !user) return;
      setLoading(true);

      // Check if already taken
      const existingResult =
        await examRunnerRepository.previousResult(examId, user.id);

      if (existingResult) {
        setResult(existingResult);
        setIsSubmitted(true);
      }

      const examData = await examRunnerRepository.getExam(examId);
      if (examData) {
        setExam(examData);
        if (!existingResult) setTimeLeft(examData.time_limit_minutes * 60);
      }

      // Fetch questions using SECURE RPC (no correct_answer field returned)
      const { data: qData, error: qError } = await examRunnerRepository.getQuestions(examId);
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
    const { data, error } = await examRunnerRepository.submitExam(examId, answers);

    if (!error && data) {
      setResult(data);
      toast.success('تم تسليم الاختبار بنجاح');
    } else {
      toast.error('حدث خطأ أثناء حفظ النتيجة');
      console.error(error);
    }
  };

  const formatTime = formatExamTime;


  return {
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
  };
}
