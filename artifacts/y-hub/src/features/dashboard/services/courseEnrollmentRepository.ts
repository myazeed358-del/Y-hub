import { supabase } from '@/utils/supabaseClient';

export interface CourseEnrollmentCount {
  course_id: string;
  enrollment_count: number;
}

export interface EnrollmentRosterStudent {
  student_id: string;
  full_name: string;
  user_number: string | null;
  enrolled_at: string;
}

type CountRow = {
  course_id: string;
  enrollment_count: number | string;
};

type RosterRow = {
  student_id: string;
  full_name: string;
  user_number: string | null;
  enrolled_at: string;
};

export const courseEnrollmentRepository = {
  async listCounts(): Promise<CourseEnrollmentCount[]> {
    const { data, error } = await supabase.rpc(
      'list_managed_course_enrollment_counts'
    );

    if (error) throw error;

    return ((data ?? []) as CountRow[]).map((row) => {
      const count = Number(row.enrollment_count);

      if (!Number.isSafeInteger(count) || count < 0) {
        throw new Error('Invalid enrollment count');
      }

      return {
        course_id: row.course_id,
        enrollment_count: count,
      };
    });
  },

  async getRoster(
    courseId: string
  ): Promise<EnrollmentRosterStudent[]> {
    if (!courseId.trim()) {
      throw new Error('Course ID is required');
    }

    const { data, error } = await supabase.rpc(
      'get_managed_course_enrollment_roster_v2',
      { p_course_id: courseId }
    );

    if (error) throw error;

    return ((data ?? []) as RosterRow[]).map((row) => ({
      student_id: row.student_id,
      full_name: row.full_name,
      user_number: row.user_number,
      enrolled_at: row.enrolled_at,
    }));
  },
};
