import { supabase } from '@/utils/supabaseClient';

interface DeleteQuestionDependencies {
  selectedExam: any | null;
  loadQuestions: (examId: string) => Promise<void>;
}

export function createHandleDeleteQuestion({
  selectedExam,
  loadQuestions,
}: DeleteQuestionDependencies) {
  return async (id: string) => {
    if (confirm('حذف السؤال؟')) {
      await supabase.from('questions').delete().eq('id', id);
      if (selectedExam) loadQuestions(selectedExam.id);
    }
  };
}
