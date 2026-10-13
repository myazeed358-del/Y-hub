export interface Course {
  id: string;
  title: string;
  description?: string | null;
  course_code?: string | null;
  instructor_id?: string | null;
  is_published: boolean;
  created_at?: string | null;
}
