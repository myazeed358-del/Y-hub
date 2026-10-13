import { Link } from 'wouter';
import { Button } from '@workspace/y-hub-ds/components/ui/button';
import { Loader2 } from 'lucide-react';
import { StudentEnrollmentGate } from '../components/StudentEnrollmentGate';
import { StudentCourseContent } from '../components/StudentCourseContent';
import { useStudentCourse } from '../hooks/useStudentCourse';

export default function StudentCoursePage() {
  const { course, materials, exams, isEnrolled, loading, enrolling, handleEnroll } = useStudentCourse();
  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin" size={48} /></div>;
  }

  if (!course) {
    return (
      <div className="text-center py-20">
        <h3 className="text-xl font-bold">المقرر غير موجود أو غير متاح</h3>
        <Link href="/dashboard"><Button className="mt-4">العودة للوحة القيادة</Button></Link>
      </div>
    );
  }

  // Enrollment gate — course is visible but content is locked
  if (!isEnrolled) {
    return (
      <StudentEnrollmentGate
        course={course}
        enrolling={enrolling}
        handleEnroll={handleEnroll}
      />
    );
  }

  // Enrolled — render full course view
  return (
    <StudentCourseContent
      course={course}
      materials={materials}
      exams={exams}
    />
  );
}
