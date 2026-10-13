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

  createCourse(input: CreateCourseInput) {
    return supabase.from('courses').insert(input);
  },

  deleteCourse(id: string) {
    return supabase.from('courses').delete().eq('id', id);
  },

  setPublished(id: string, published: boolean) {
    return supabase.from('courses')
      .update({ is_published: published }).eq('id', id);
  },
};
