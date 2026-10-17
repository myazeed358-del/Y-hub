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
      const { error } = await supabase.from('questions').delete().eq('id', id);
      if (error) {
        toast.error('تعذر حذف السؤال. حاول مرة أخرى.');
        return;
      }
      if (selectedExam) loadQuestions(selectedExam.id);
    }
  };
}
