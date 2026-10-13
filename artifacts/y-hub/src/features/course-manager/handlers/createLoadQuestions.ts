import type {
  Dispatch,
  SetStateAction,
} from 'react';
import { supabase } from '@/utils/supabaseClient';

interface LoadQuestionsDependencies {
  setQuestions: Dispatch<SetStateAction<any[]>>;
}

export function createLoadQuestions({
  setQuestions,
}: LoadQuestionsDependencies) {
  return async (examId: string) => {
    const { data } = await supabase.from('questions').select('*').eq('exam_id', examId).order('created_at', { ascending: true });
    if (data) setQuestions(data);
  };
}
