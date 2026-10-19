import { CourseManagerPage } from '@/features/course-manager';
import { SyllabusPanel } from '@/features/course-syllabus';
export default function CourseManager() {
  return <CourseManagerPage renderSyllabus={(id, editable) => <SyllabusPanel key={id} courseId={id} editable={editable} />} />;
}
