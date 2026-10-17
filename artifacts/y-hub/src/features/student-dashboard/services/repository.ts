import { supabase } from '@/utils/supabaseClient';
import type { StudentDashboardCourse, StudentDashboardProfile } from '../types';

/** Supabase boundary: propagate read failures instead of pretending data is empty. */
export const repository = {
  async currentUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    return data.user;
  },
  async profile(id: string) {
    const { data, error } = await supabase.from('users').select('*').eq('id', id)
      .single<StudentDashboardProfile>();
    if (error) throw error;
    return data;
  },
  async publishedCourses() {
    const { data, error } = await supabase.from('courses').select('*').eq('is_published', true)
      .order('created_at', { ascending: false }).returns<StudentDashboardCourse[]>();
    if (error) throw error;
    return data;
  },
  async activeEnrollments(id: string) {
    const { data, error } = await supabase.from('course_enrollments').select('course_id')
      .eq('student_id', id).eq('status', 'active').returns<{ course_id: string }[]>();
    if (error) throw error;
    return data;
  },
  async enroll(courseId: string, studentId: string) {
    const { error } = await supabase.from('course_enrollments')
      .insert({ course_id: courseId, student_id: studentId, status: 'active' });
    return error;
  },
};
