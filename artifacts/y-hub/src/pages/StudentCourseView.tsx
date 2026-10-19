import { StudentCoursePage } from '@/features/student-course';
import { SyllabusPanel } from '@/features/course-syllabus';
export default function StudentCourseView() {
  return <StudentCoursePage renderSyllabus={id => <SyllabusPanel key={id} courseId={id} />} />;
}
