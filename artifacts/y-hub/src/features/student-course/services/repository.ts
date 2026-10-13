import { supabase } from '@/utils/supabaseClient';

export const repository = {
  async course(id: string) {
    const { data } = await supabase.from('courses')
      .select('id, title, description, course_code, is_published')
      .eq('id', id).single();
    return data;
  },

  async enrollment(courseId: string, userId: string) {
    const { data } = await supabase.from('course_enrollments')
      .select('id').eq('course_id', courseId)
      .eq('student_id', userId).eq('status', 'active').maybeSingle();
    return data;
  },

  async materials(courseId: string) {
    const { data } = await supabase.from('course_materials')
      .select('*').eq('course_id', courseId)
      .order('created_at', { ascending: false });
    return data;
  },

  async exams(courseId: string) {
    const { data } = await supabase.from('exams')
      .select('*').eq('course_id', courseId)
      .eq('is_published', true)
      .order('created_at', { ascending: false });
    return data;
  },

  async enroll(courseId: string, userId: string) {
    const { error } = await supabase.from('course_enrollments')
      .insert({ course_id: courseId, student_id: userId, status: 'active' });
    return { error };
  },
};
