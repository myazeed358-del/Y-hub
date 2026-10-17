import { moduleRegistry, getModuleNavigation } from '@/modules';
import { MODULE_ICON_COMPONENTS } from '@/shared/ui/moduleIcons';
import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
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
    let active = true;
    async function loadData() {
      try {
        const user = await repository.currentUser();
        if (!active) return;
        if (!user) {
          setLocation('/login');
          return;
        }
        const [profileData, coursesData, enrollmentsData] = await Promise.all([
          repository.profile(user.id), repository.publishedCourses(), repository.activeEnrollments(user.id),
        ]);
        if (!active) return;
        setProfile(profileData);
        setCourses(coursesData ?? []);
        setEnrolledIds(new Set((enrollmentsData ?? []).map(enrollment => enrollment.course_id)));
      } catch (error) {
        if (!active) return;
        console.error('Student dashboard load failed:', error);
        toast.error('Unable to load dashboard / تعذر تحميل لوحة الطالب');
      }
    }
    void loadData();
    return () => { active = false; };
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

  const tools = getModuleNavigation(moduleRegistry, { role: 'student', major: profile?.major }, 'dashboard')
    .map(item => ({ name: item.title[language], icon: MODULE_ICON_COMPONENTS[item.iconId], path: item.href }));

  const firstName = profile?.full_name?.split(' ')[0] || (language === 'ar' ? 'طالب' : 'Student');


return {t,firstName,enrolledIds,courses,enrollingId,handleEnroll,setLocation,tools};
}
