import type {
  Dispatch,
  SetStateAction,
} from 'react';
import { supabase } from '@/utils/supabaseClient';

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
      await supabase.from('exams').delete().eq('id', id);
      if (selectedExam?.id === id) setSelectedExam(null);
      loadData();
    }
  };
}
