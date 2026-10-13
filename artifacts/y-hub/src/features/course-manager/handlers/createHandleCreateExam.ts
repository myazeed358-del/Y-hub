import type {
  Dispatch,
  SetStateAction,
} from 'react';
import { supabase } from '@/utils/supabaseClient';
import { toast } from 'sonner';

interface CreateExamDependencies {
  courseId: string;
  examTitle: string;
  examTimeLimit: number;
  setExamTitle: Dispatch<SetStateAction<string>>;
  setIsAddExamOpen: Dispatch<SetStateAction<boolean>>;
  loadData: () => Promise<void>;
}

export function createHandleCreateExam({
  courseId,
  examTitle,
  examTimeLimit,
  setExamTitle,
  setIsAddExamOpen,
  loadData,
}: CreateExamDependencies) {
  return async () => {
    if (!examTitle) {
      toast.error('يرجى كتابة عنوان الاختبار');
      return;
    }
    const { error } = await supabase.from('exams').insert({
      course_id: courseId, title: examTitle, time_limit_minutes: examTimeLimit
    });
    if (error) toast.error('فشل إنشاء الاختبار');
    else {
      toast.success('تم الإنشاء');
      setExamTitle(''); setIsAddExamOpen(false); loadData();
    }
  };
}
