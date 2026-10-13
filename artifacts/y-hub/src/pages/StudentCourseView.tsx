import { useState, useEffect } from 'react';
import { useRoute, Link } from 'wouter';
import { supabase } from '@/utils/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@workspace/y-hub-ds/components/ui/button';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { StudentEnrollmentGate } from '@/components/student-course/StudentEnrollmentGate';
import { StudentCourseContent } from '@/components/student-course/StudentCourseContent';

export default function StudentCourseView() {
  const [, params] = useRoute('/course/:id/view');
  const courseId = params?.id || '';
  const { user } = useAuth();

  const [course, setCourse] = useState<any>(null);
  const [materials, setMaterials] = useState<any[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [isEnrolled, setIsEnrolled] = useState<boolean | null>(null); // null = still checking
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);

  useEffect(() => {
    async function loadCourse() {
      if (!courseId || !user) return;
      setLoading(true);

      // Always fetch the course metadata (discoverable)
      const { data: courseData } = await supabase
        .from('courses')
        .select('id, title, description, course_code, is_published')
        .eq('id', courseId)
        .single();

      if (courseData) setCourse(courseData);

      // Check enrollment status
      const { data: enrollment } = await supabase
        .from('course_enrollments')
        .select('id')
        .eq('course_id', courseId)
        .eq('student_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      const enrolled = !!enrollment;
      setIsEnrolled(enrolled);

      if (enrolled) {
        // Only fetch protected content if enrolled — RLS enforces this server-side too
        const { data: materialsData } = await supabase
          .from('course_materials')
          .select('*')
          .eq('course_id', courseId)
          .order('created_at', { ascending: false });
        if (materialsData) setMaterials(materialsData);

        const { data: examsData } = await supabase
          .from('exams')
          .select('*')
          .eq('course_id', courseId)
          .eq('is_published', true)
          .order('created_at', { ascending: false });
        if (examsData) setExams(examsData);
      }

      setLoading(false);
    }
    loadCourse();
  }, [courseId, user]);

  const handleEnroll = async () => {
    if (!user || !courseId) return;
    setEnrolling(true);
    try {
      const { error } = await supabase.from('course_enrollments').insert({
        course_id: courseId,
        student_id: user.id,
        status: 'active',
      });

      if (error) {
        if (error.code === '23505') {
          toast.info('أنت مسجّل في هذا المساق مسبقاً');
          setIsEnrolled(true);
        } else {
          toast.error('فشل التسجيل: ' + error.message);
        }
      } else {
        toast.success('تم التسجيل في المساق بنجاح!');
        setIsEnrolled(true);
        // Reload materials & exams now that we're enrolled
        const { data: materialsData } = await supabase
          .from('course_materials')
          .select('*')
          .eq('course_id', courseId)
          .order('created_at', { ascending: false });
        if (materialsData) setMaterials(materialsData);

        const { data: examsData } = await supabase
          .from('exams')
          .select('*')
          .eq('course_id', courseId)
          .eq('is_published', true)
          .order('created_at', { ascending: false });
        if (examsData) setExams(examsData);
      }
    } catch (e: any) {
      toast.error('حدث خطأ غير متوقع');
    } finally {
      setEnrolling(false);
    }
  };

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
