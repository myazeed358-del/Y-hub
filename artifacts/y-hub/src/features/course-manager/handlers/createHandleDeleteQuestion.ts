import { supabase } from '@/utils/supabaseClient';
import { toast } from 'sonner';

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
      const { data, error } = await supabase.from('questions').delete().eq('id', id).select('id');
      // RLS-hidden and absent rows both return an empty successful response.
      // Advance the UI only when PostgreSQL confirms this exact row was deleted.
      if (error || data?.length !== 1 || data[0].id !== id) {
        toast.error('تعذر حذف السؤال. حاول مرة أخرى.');
        return;
      }
      if (selectedExam) loadQuestions(selectedExam.id);
    }
  };
}
