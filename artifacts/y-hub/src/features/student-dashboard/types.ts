export interface StudentDashboardCourse {
  id: string;
  title?: string;
  section_label?: string | null;
  academic_term?: string | null;
  course_code?: string;
  enrollment_open?: boolean;
  [key: string]: unknown;
}
export interface StudentDashboardProfile {
  full_name?: string | null;
  major?: string | null;
}
