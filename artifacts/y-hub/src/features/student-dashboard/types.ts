export interface StudentDashboardCourse {
  id: string;
  title?: string;
  course_code?: string;
  enrollment_open?: boolean;
  [key: string]: unknown;
}
export interface StudentDashboardProfile {
  full_name?: string | null;
  major?: string | null;
}
