/** Catalog identity does not grant section access. IDs always come from the database. */
export interface CourseDefinition {
  id: string;
  code: string | null;
  title: string;
  description: string | null;
  department: string | null;
  academic_major: string | null;
  legacy_course_id: string | null;
  created_at: string;
}
/** courses is the physical compatibility store; course_sections is its invoker view.
 * Existing course_id foreign keys and /course/:id URLs contain this section ID. */
export interface CourseSection {
  id: string;
  course_definition_id: string;
  instructor_id: string | null;
  section_label: string | null;
  academic_term: string | null;
  title: string;
  description: string | null;
  course_code: string | null;
  is_published: boolean | null;
  enrollment_open: boolean;
  syllabus_source: 'manual' | 'ai';
  created_at: string | null;
}
