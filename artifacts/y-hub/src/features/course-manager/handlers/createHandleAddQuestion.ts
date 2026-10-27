import type {
  Dispatch,
  SetStateAction,
} from 'react';
import { supabase } from '@/utils/supabaseClient';
import { toast } from 'sonner';

type QuestionType = 'mcq' | 'tf' | 'math';

interface AddQuestionDependencies {
  courseId: string;
  selectedExam: any | null;
  qType: QuestionType;
  qContent: string;
  qCorrect: string;
  qOptions: string[];
  setQContent: Dispatch<SetStateAction<string>>;
  setQCorrect: Dispatch<SetStateAction<string>>;
  setQOptions: Dispatch<SetStateAction<string[]>>;
  setIsAddQuestionOpen: Dispatch<SetStateAction<boolean>>;
  loadQuestions: (examId: string) => Promise<void>;
}

export function createHandleAddQuestion({
  courseId,
  selectedExam,
  qType,
  qContent,
  qCorrect,
  qOptions,
  setQContent,
  setQCorrect,
  setQOptions,
  setIsAddQuestionOpen,
  loadQuestions,
}: AddQuestionDependencies) {
  return async () => {
    if (!qContent || !qCorrect || !selectedExam) {
      toast.error('أكمل البيانات');
      return;
    }

    let optionsToSave = null;
    if (qType === 'mcq') {
      const validOptions = qOptions.filter(o => o.trim() !== '');
      if (validOptions.length < 2) {
        toast.error('أضف خيارين على الأقل');
        return;
      }
      optionsToSave = validOptions;
      // The chosen correct answer must be one of the saved options.
      if (!validOptions.includes(qCorrect)) {
        toast.error('الإجابة الصحيحة غير موجودة في الخيارات');
        return;
      }
    }

    if (qType === 'tf') {
      optionsToSave = ['صح', 'خطأ'];
      if (qCorrect !== 'صح' && qCorrect !== 'خطأ') {
        toast.error('يجب أن تكون الإجابة صح أو خطأ');
        return;
      }
    }

    const { error } = await supabase.from('questions').insert({
      course_id: courseId,
      exam_id: selectedExam.id,
      content: qContent,
      type: qType,
      options: optionsToSave,
      correct_answer: qCorrect
    });

    if (error) toast.error('فشل حفظ السؤال');
    else {
      toast.success('تم الحفظ');
      setQContent(''); setQCorrect(''); setQOptions(['', '', '', '']); setIsAddQuestionOpen(false);
      loadQuestions(selectedExam.id);
    }
  };
}
