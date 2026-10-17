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
      const { error } = await supabase.from('exams').delete().eq('id', id);
      if (error) {
        toast.error('تعذر حذف الامتحان. حاول مرة أخرى.');
        return;
      }
      if (selectedExam?.id === id) setSelectedExam(null);
      loadData();
    }
  };
}
