import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import {
  LayoutDashboard,
  BookOpen,
  Calculator,
  FunctionSquare,
  LineChart,
  Activity,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/i18n/LanguageContext';

import { repository } from '../services/repository';
import type { StudentDashboardCourse, StudentDashboardProfile } from '../types';

export function useStudentDashboard() {
  const [, setLocation] = useLocation();
  const [courses, setCourses] = useState<StudentDashboardCourse[]>([]);
  const [enrolledIds, setEnrolledIds] = useState<Set<string>>(new Set());
  const [enrollingId, setEnrollingId] = useState<string | null>(null);
  const [profile, setProfile] = useState<StudentDashboardProfile | null>(null);
  const { t, language } = useLanguage();

  useEffect(() => {
    async function loadData() {
      const user = await repository.currentUser();
      if (!user) {
        setLocation('/login');
        return;
      }

      const profileData = await repository.profile(user.id);
      setProfile(profileData);

      const coursesData = await repository.publishedCourses();
      if (coursesData) setCourses(coursesData);

      const enrollmentsData = await repository.activeEnrollments(user.id);
      if (enrollmentsData) {
        setEnrolledIds(new Set(enrollmentsData.map(e => e.course_id)));
      }
    }
    loadData();
  }, [setLocation]);

  const handleEnroll = async (courseId: string) => {
    setEnrollingId(courseId);
    try {
      const user = await repository.currentUser();
      if (!user) return;

      const error = await repository.enroll(courseId, user.id);
      if (error) {
        if (error.code === '23505') {
          toast.info(t('alreadyEnrolled') || 'Already enrolled');
        } else {
          throw error;
        }
      } else {
        toast.success(t('enrolledSuccessfully') || 'Enrolled successfully!');
      }

      setEnrolledIds(prev => new Set([...prev, courseId]));
    } catch (e) {
      console.error(e);
      toast.error('Enrollment failed');
    } finally {
      setEnrollingId(null);
    }
  };

  const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard', active: true },
    { name: 'My Courses', icon: BookOpen, path: '/legacy-course', active: false },
    { name: 'Math Lab', icon: Calculator, path: '/math-solver', active: false },
  ];

  const tools = [
    { name: 'Graphing', icon: LineChart, path: '/calculus' },
    { name: 'Equations', icon: FunctionSquare, path: '/solver' },
    { name: 'Statistics', icon: Activity, path: '/lab' },
  ];

  const firstName = profile?.full_name?.split(' ')[0] || (language === 'ar' ? 'طالب' : 'Student');


return {t,firstName,enrolledIds,courses,enrollingId,handleEnroll,setLocation,tools};
}
