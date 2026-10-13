import { supabase } from '@/utils/supabaseClient';

interface ToggleExamPublishDependencies {
  loadData: () => Promise<void>;
}

export function createHandleToggleExamPublish({
  loadData,
}: ToggleExamPublishDependencies) {
  return async (exam: any) => {
    const { error } = await supabase.from('exams').update({ is_published: !exam.is_published }).eq('id', exam.id);
    if (!error) loadData();
  };
}
