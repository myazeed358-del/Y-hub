import type {
  Dispatch,
  SetStateAction,
} from 'react';
import { supabase } from '@/utils/supabaseClient';

interface LoadDataDependencies {
  courseId: string;
  setCourse: Dispatch<SetStateAction<any>>;
  setMaterials: Dispatch<SetStateAction<any[]>>;
  setExams: Dispatch<SetStateAction<any[]>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
}

export function createLoadData({
  courseId,
  setCourse,
  setMaterials,
  setExams,
  setLoading,
}: LoadDataDependencies) {
  return async () => {
    setLoading(true);
    const { data: courseData } = await supabase.from('courses').select('*').eq('id', courseId).single();
    if (courseData) setCourse(courseData);

    const { data: materialsData } = await supabase.from('course_materials').select('*').eq('course_id', courseId).order('created_at', { ascending: false });
    if (materialsData) setMaterials(materialsData);

    const { data: examsData } = await supabase.from('exams').select('*').eq('course_id', courseId).order('created_at', { ascending: false });
    if (examsData) setExams(examsData);

    setLoading(false);
  };
}
