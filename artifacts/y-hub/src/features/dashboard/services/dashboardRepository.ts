import { supabase } from '@/utils/supabaseClient';

export type CreateCourseInput = {
  title: string;
  description: string | null;
  course_code: string | null;
  instructor_id: string;
  is_published: boolean;
};

export const dashboardRepository = {
  listInstructorCourses(instructorId: string) {
    return supabase.from('courses').select('*')
      .eq('instructor_id', instructorId)
      .order('created_at', { ascending: false });
  },

  listManagedCourses(userId: string, role: string | null) {
    if (role === 'admin' || role === 'super_admin') {
      return supabase.from('courses').select('*')
        .order('created_at', { ascending: false });
    }
    return supabase.from('courses').select('*')
      .eq('instructor_id', userId)
      .order('created_at', { ascending: false });
  },

  createCourse(input: CreateCourseInput) {
    return supabase.from('courses').insert(input);
  },

  deleteCourse(id: string) {
    return supabase.rpc('delete_course_confirmed', { p_course_id: id });
  },

  setPublished(id: string, published: boolean) {
    return supabase.from('courses')
      .update({ is_published: published }).eq('id', id);
  },

  async setEnrollmentOpen(id: string, open: boolean) {
    const { data, error } = await supabase.from('courses')
      .update({ enrollment_open: open })
      .eq('id', id)
      .select('id, enrollment_open')
      .maybeSingle();
    return {
      error: error ?? (!data ? new Error('Enrollment update was not authorized') : null),
    };
  },
};
