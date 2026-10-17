import type {
  Dispatch,
  SetStateAction,
} from 'react';
import { supabase } from '@/utils/supabaseClient';
import { toast } from 'sonner';

interface DeleteExamDependencies {
  selectedExam: any | null;
  setSelectedExam: Dispatch<SetStateAction<any | null>>;
  loadData: () => Promise<void>;
}

export function createHandleDeleteExam({
  selectedExam,
  setSelectedExam,
  loadData,
}: DeleteExamDependencies) {
  return async (id: string) => {
    if (confirm('تأكيد الحذف؟')) {
      const { data, error } = await supabase.from('exams').delete().eq('id', id).select('id');
      // RLS-hidden and absent rows both return an empty successful response.
      // Advance the UI only when PostgreSQL confirms this exact row was deleted.
      if (error || data?.length !== 1 || data[0].id !== id) {
        toast.error('تعذر حذف الامتحان. حاول مرة أخرى.');
        return;
      }
      if (selectedExam?.id === id) setSelectedExam(null);
      loadData();
    }
  };
}
