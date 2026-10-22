export interface Course {
  id: string;
  title: string;
  section_label?: string | null;
  academic_term?: string | null;
  description?: string | null;
  course_code?: string | null;
  instructor_id?: string | null;
  is_published: boolean;
  enrollment_open: boolean;
  created_at?: string | null;
}
