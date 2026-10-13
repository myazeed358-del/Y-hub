import { supabase } from '@/utils/supabaseClient';
import type {
  ExamAnswers,
  ExamInfo,
  ExamQuestion,
  ExamResult
} from '../types';

export const examRunnerRepository = {
  async previousResult(examId: string, studentId: string) {
    const { data } = await supabase
      .from('student_results')
      .select('*')
      .eq('exam_id', examId)
      .eq('student_id', studentId)
      .maybeSingle();

    return data as ExamResult | null;
  },

  async getExam(examId: string) {
    const { data } = await supabase
      .from('exams')
      .select('*')
      .eq('id', examId)
      .single();

    return data as ExamInfo | null;
  },

  async getQuestions(examId: string) {
    const { data, error } = await supabase.rpc(
      'get_exam_questions',
      { p_exam_id: examId }
    );

    return {
      data: data as ExamQuestion[] | null,
      error
    };
  },

  async submitExam(examId: string, answers: ExamAnswers) {
    const { data, error } = await supabase.rpc(
      'submit_exam',
      {
        p_exam_id: examId,
        p_answers: answers
      }
    );

    return {
      data: data as ExamResult | null,
      error
    };
  },
};
