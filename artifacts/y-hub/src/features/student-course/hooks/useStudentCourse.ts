import { useEffect, useState } from 'react';
import { useRoute } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { repository } from '../services/repository';

export function useStudentCourse() {
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
      const courseData = await repository.course(courseId);

      if (courseData) setCourse(courseData);

      // Check enrollment status
      const enrollment = await repository.enrollment(courseId, user.id);

      const enrolled = !!enrollment;
      setIsEnrolled(enrolled);

      if (enrolled) {
        // Only fetch protected content if enrolled — RLS enforces this server-side too
        const materialsData = await repository.materials(courseId);
        if (materialsData) setMaterials(materialsData);

        const examsData = await repository.exams(courseId);
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
      const { error } = await repository.enroll(courseId, user.id);

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
        const materialsData = await repository.materials(courseId);
        if (materialsData) setMaterials(materialsData);

        const examsData = await repository.exams(courseId);
        if (examsData) setExams(examsData);
      }
    } catch (e: any) {
      toast.error('حدث خطأ غير متوقع');
    } finally {
      setEnrolling(false);
    }
  };


  return { course, materials, exams, isEnrolled, loading, enrolling, handleEnroll };
}
